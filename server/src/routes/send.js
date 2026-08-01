import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { sessionManager } from '../whatsapp/session-manager.js';
import * as rateGate from '../whatsapp/rate-gate.js';
import { logMessage, updateMessageStatus } from '../store/messages.js';

export const sendRouter = Router();

// Memory storage: files are only ever forwarded to Baileys, never written
// to disk, matching the "don't persist things we don't have to" approach
// used elsewhere (e.g. the QR code).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

sendRouter.post('/send/text', async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ success: false, error: '"to" and "message" are required' });
  }

  let sock;
  try {
    sock = sessionManager.requireSocket();
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }

  const logId = logMessage({ direction: 'outbound', chatId: to, type: 'text', body: message });

  const check = rateGate.checkAndReserve(to);
  if (!check.ok) {
    const position = rateGate.enqueueDeferred({
      to,
      logId,
      sendFn: () => sessionManager.requireSocket().sendMessage(to, { text: message }),
    });
    return res.status(202).json({ success: false, queued: true, position, reason: check.reason });
  }

  try {
    const result = await rateGate.executeSend({ sendFn: () => sock.sendMessage(to, { text: message }) });
    updateMessageStatus(logId, 'sent');
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    updateMessageStatus(logId, 'failed', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const MEDIA_KEYS = { image: 'image', video: 'video', document: 'document' };

sendRouter.post('/send/media', upload.single('file'), async (req, res) => {
  const { to, mediaUrl, caption, type } = req.body || {};
  const file = req.file;

  if (!to || !type || (!mediaUrl && !file)) {
    return res
      .status(400)
      .json({ success: false, error: '"to", "type" and either "mediaUrl" or a file are required' });
  }
  const mediaKey = MEDIA_KEYS[type];
  if (!mediaKey) {
    return res
      .status(400)
      .json({ success: false, error: 'type must be one of: image, video, document' });
  }

  let sock;
  try {
    sock = sessionManager.requireSocket();
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }

  const content = file
    ? { [mediaKey]: file.buffer, caption, mimetype: file.mimetype }
    : { [mediaKey]: { url: mediaUrl }, caption };
  if (type === 'document') {
    content.fileName = file ? file.originalname : mediaUrl.split('/').pop() || 'file';
  }

  const logId = logMessage({
    direction: 'outbound',
    chatId: to,
    type,
    body: caption || null,
    mediaUrl: file ? `upload:${file.originalname}` : mediaUrl,
  });

  const check = rateGate.checkAndReserve(to);
  if (!check.ok) {
    const position = rateGate.enqueueDeferred({
      to,
      logId,
      sendFn: () => sessionManager.requireSocket().sendMessage(to, content),
    });
    return res.status(202).json({ success: false, queued: true, position, reason: check.reason });
  }

  try {
    const result = await rateGate.executeSend({ sendFn: () => sock.sendMessage(to, content) });
    updateMessageStatus(logId, 'sent');
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    updateMessageStatus(logId, 'failed', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Accepts either plain string recipients (uses `message` verbatim for all of
// them) or `{ to, ...vars }` objects combined with a `template` string
// containing {{placeholders}} — the recommended path, since identical
// repeated text is itself an anti-ban risk signal.
function normalizeRecipients(recipients, message, template) {
  return recipients.map((r) => {
    if (typeof r === 'string') {
      return { to: r, text: message };
    }
    const { to, ...vars } = r;
    return { to, text: template ? rateGate.interpolateTemplate(template, vars) : message };
  });
}

sendRouter.post('/send/bulk', async (req, res) => {
  const { recipients, message, template } = req.body || {};
  if (!Array.isArray(recipients) || recipients.length === 0 || (!message && !template)) {
    return res.status(400).json({
      success: false,
      error: '"recipients" (non-empty array) and "message" or "template" are required',
    });
  }

  let sock;
  try {
    sock = sessionManager.requireSocket();
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }

  const items = normalizeRecipients(recipients, message, template);
  const { bulkChunkSize } = config.rateGate;
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const { to, text } = items[i];
    const logId = logMessage({ direction: 'outbound', chatId: to, type: 'text', body: text });

    const check = rateGate.checkAndReserve(to);
    if (!check.ok) {
      const position = rateGate.enqueueDeferred({
        to,
        logId,
        sendFn: () => sessionManager.requireSocket().sendMessage(to, { text }),
      });
      results.push({ to, success: false, queued: true, position, reason: check.reason });
    } else {
      try {
        const result = await rateGate.executeSend({ sendFn: () => sock.sendMessage(to, { text }) });
        updateMessageStatus(logId, 'sent');
        results.push({ to, success: true, messageId: result.messageId });
      } catch (err) {
        updateMessageStatus(logId, 'failed', err.message);
        results.push({ to, success: false, error: err.message });
      }
    }

    const isChunkBoundary = (i + 1) % bulkChunkSize === 0;
    const isLast = i === items.length - 1;
    if (isChunkBoundary && !isLast) {
      await sleep(rateGate.randomChunkPause());
    }
  }

  res.json({ success: results.every((r) => r.success), results });
});
