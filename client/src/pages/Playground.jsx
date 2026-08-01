import { useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import { IconSend, IconPaperclip, IconUsers } from '../icons.jsx';

const MODES = [
  { value: 'text', label: 'Text', icon: IconSend },
  { value: 'media', label: 'Media', icon: IconPaperclip },
  { value: 'bulk', label: 'Bulk', icon: IconUsers },
];

function toJid(input) {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

function parseRecipients(text) {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(toJid);
}

function ResultBanner({ result }) {
  if (!result) return null;
  if (result.success) {
    return (
      <p className="inline-success">
        Sent{result.messageId ? ` — messageId: ${result.messageId}` : ''}
      </p>
    );
  }
  if (result.queued) {
    return (
      <p className="inline-success">
        Queued (position {result.position}) — rate gate caps reached, will send automatically
        once capacity frees up.
      </p>
    );
  }
  return <p className="inline-error">{result.error}</p>;
}

function TextPanel() {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await api.sendText({ to: toJid(to), message });
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Phone number</span>
        <input
          type="text"
          placeholder="+60123456789"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Message</span>
        <textarea
          rows={4}
          placeholder="Type a message to send"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </label>

      <ResultBanner result={result} />

      <button className="btn btn-primary" type="submit" disabled={sending}>
        <IconSend width={15} height={15} />
        {sending ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}

const MEDIA_TYPES = ['image', 'video', 'document'];

function MediaPanel() {
  const [to, setTo] = useState('');
  const [type, setType] = useState('image');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('to', toJid(to));
      form.append('type', type);
      if (caption) form.append('caption', caption);
      if (file) {
        form.append('file', file);
      } else {
        form.append('mediaUrl', mediaUrl);
      }
      const res = await api.sendMedia(form);
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Phone number</span>
        <input
          type="text"
          placeholder="+60123456789"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Type</span>
        <div className="pill-toggle-group">
          {MEDIA_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className={`pill-toggle ${type === t ? 'active' : ''}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span className="field-label">File</span>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : undefined}
        />
      </label>

      {!file && (
        <label className="field">
          <span className="field-label">...or a media URL</span>
          <input
            type="url"
            placeholder="https://example.com/file.jpg"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span className="field-label">Caption (optional)</span>
        <input
          type="text"
          placeholder="Optional caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>

      <ResultBanner result={result} />

      <button className="btn btn-primary" type="submit" disabled={sending || (!file && !mediaUrl)}>
        <IconSend width={15} height={15} />
        {sending ? 'Sending...' : 'Send media'}
      </button>
    </form>
  );
}

function BulkPanel() {
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [delayMs, setDelayMs] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const parsed = parseRecipients(recipients);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResults(null);
    try {
      const res = await api.sendBulk({
        recipients: parsed,
        message,
        ...(delayMs ? { delayMs: Number(delayMs) } : {}),
      });
      setResults(res.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Recipients ({parsed.length} parsed) — one per line or comma-separated</span>
        <textarea
          rows={4}
          placeholder={'+60123456789\n+60198765432'}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Message</span>
        <textarea
          rows={3}
          placeholder="Message to send to every recipient"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Delay between sends (ms) — floor of 1000ms enforced server-side</span>
        <input
          type="number"
          min={1000}
          placeholder="1500 (default)"
          value={delayMs}
          onChange={(e) => setDelayMs(e.target.value)}
        />
      </label>

      {error && <p className="inline-error">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={sending || parsed.length === 0}>
        <IconSend width={15} height={15} />
        {sending ? `Sending (${parsed.length})...` : `Send to ${parsed.length || ''} recipient${parsed.length === 1 ? '' : 's'}`}
      </button>

      {results && (
        <div className="table-scroll" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>To</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.to}</td>
                  <td className={r.success ? 'status-success' : r.queued ? 'status-neutral' : 'status-danger'}>
                    {r.success
                      ? `Sent (${r.messageId})`
                      : r.queued
                        ? `Queued (position ${r.position})`
                        : r.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}

export default function Playground() {
  const [mode, setMode] = useState('text');

  return (
    <>
      <PageHeader
        title="Playground"
        subtitle="Test sending text, media, or bulk messages against the live API."
      />

      <div className="card">
        <div className="segmented">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              className={mode === value ? 'active' : ''}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'text' && <TextPanel />}
        {mode === 'media' && <MediaPanel />}
        {mode === 'bulk' && <BulkPanel />}
      </div>
    </>
  );
}
