import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import { optionalApiKey } from './src/middleware/optional-api-key.js';
import { statusRouter } from './src/routes/status.js';
import { sendRouter } from './src/routes/send.js';
import { webhookRouter } from './src/routes/webhook.js';
import { sessionManager } from './src/whatsapp/session-manager.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', optionalApiKey);

app.use('/api', statusRouter);
app.use('/api', sendRouter);
app.use('/api', webhookRouter);

app.listen(config.port, config.host, () => {
  console.log(`reverse-whatsapp-web server listening on http://${config.host}:${config.port}`);

  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn(
      `WARNING: server is bound to ${config.host}, which may expose it beyond localhost. ` +
        `Set REQUIRE_API_KEY=true and API_KEY to protect it.`
    );
  }

  if (config.requireApiKey && !config.apiKey) {
    console.warn('WARNING: REQUIRE_API_KEY=true but API_KEY is not set — all requests will fail.');
  }
});

sessionManager.start().catch((err) => {
  console.error('Failed to start WhatsApp session:', err);
});

sessionManager.on('state', ({ state, phoneNumber }) => {
  console.log(`[whatsapp] state -> ${state}${phoneNumber ? ` (${phoneNumber})` : ''}`);
});
