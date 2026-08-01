import { config } from '../config.js';

/**
 * No-op unless REQUIRE_API_KEY=true and API_KEY is set — this app has no
 * auth by default because it's meant to run on localhost only. When enabled,
 * checks the `x-api-key` header against API_KEY.
 */
export function optionalApiKey(req, res, next) {
  if (!config.requireApiKey) return next();

  if (!config.apiKey) {
    return res
      .status(500)
      .json({ error: 'REQUIRE_API_KEY is true but API_KEY is not set on the server' });
  }

  const provided = req.header('x-api-key');
  if (provided !== config.apiKey) {
    return res.status(401).json({ error: 'Invalid or missing x-api-key header' });
  }

  next();
}
