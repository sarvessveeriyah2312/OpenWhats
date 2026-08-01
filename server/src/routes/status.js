import { Router } from 'express';
import { sessionManager } from '../whatsapp/session-manager.js';
import * as rateGate from '../whatsapp/rate-gate.js';

export const statusRouter = Router();

statusRouter.get('/status', (req, res) => {
  res.json(sessionManager.getStatus());
});

statusRouter.get('/rate-gate/status', (req, res) => {
  res.json(rateGate.getStatus());
});

statusRouter.get('/qr', (req, res) => {
  const qr = sessionManager.getQr();
  if (!qr) {
    return res.status(404).json({ error: 'No QR available (not in qr_pending state)' });
  }
  res.json({ qr });
});

statusRouter.post('/logout', async (req, res) => {
  try {
    await sessionManager.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
