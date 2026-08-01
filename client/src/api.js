const BASE = '/api';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: isFormData ? undefined : { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getStatus: () => request('/status'),
  getRateGateStatus: () => request('/rate-gate/status'),
  getQr: () => request('/qr'),
  logout: () => request('/logout', { method: 'POST' }),
  getLogs: (page, pageSize, direction) =>
    request(
      `/logs?page=${page}&pageSize=${pageSize}${direction ? `&direction=${direction}` : ''}`
    ),
  listWebhooks: (page, pageSize) => request(`/config/webhooks?page=${page}&pageSize=${pageSize}`),
  createWebhook: (body) =>
    request('/config/webhooks', { method: 'POST', body: JSON.stringify(body) }),
  deleteWebhook: (id) => request(`/config/webhooks/${id}`, { method: 'DELETE' }),
  sendText: (body) => request('/send/text', { method: 'POST', body: JSON.stringify(body) }),
  sendMedia: (formData) => request('/send/media', { method: 'POST', body: formData }),
  sendBulk: (body) => request('/send/bulk', { method: 'POST', body: JSON.stringify(body) }),
};
