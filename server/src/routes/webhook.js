import { Router } from 'express';
import { listWebhooks, getWebhook, createWebhook, deleteWebhook } from '../store/webhooks.js';
import { listMessages } from '../store/messages.js';

export const webhookRouter = Router();

const MAX_PAGE_SIZE = 100;

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || 10));
  return { page, pageSize };
}

webhookRouter.get('/config/webhooks', (req, res) => {
  res.json(listWebhooks(parsePagination(req.query)));
});

webhookRouter.post('/config/webhooks', (req, res) => {
  const { url, events } = req.body || {};
  if (!url) {
    return res.status(400).json({ success: false, error: '"url" is required' });
  }
  const webhook = createWebhook({ url, events: Array.isArray(events) ? events : [] });
  res.status(201).json({ success: true, webhook });
});

webhookRouter.delete('/config/webhooks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getWebhook(id)) {
    return res.status(404).json({ success: false, error: 'Webhook not found' });
  }
  deleteWebhook(id);
  res.json({ success: true });
});

webhookRouter.get('/logs', (req, res) => {
  const direction = ['inbound', 'outbound'].includes(req.query.direction)
    ? req.query.direction
    : null;
  res.json(listMessages({ ...parsePagination(req.query), direction }));
});
