// Load environment variables first
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
// Import config to trigger validation on startup
import './services/config';
// Import whitelist manager for hot-reload capability
import { whitelistManager } from './services/whitelist-manager';

// Import plugins
import sensiblePlugin from './plugins/sensible';
import supportPlugin from './plugins/support';

// Import routes
import healthRoute from './routes/health';
import rootRoute from './routes/root';
import webhookRoute from './routes/webhook';

export interface AppOptions extends FastifyServerOptions {}

const options: AppOptions = {
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    // Structured logging with pino - includes automatic correlation IDs (request.id)
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.ip,
        // Include correlation ID
        id: req.id,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Start whitelist file watcher for hot-reload capability
  whitelistManager.startWatching(fastify.log);

  // Stop watcher on server close
  fastify.addHook('onClose', async () => {
    whitelistManager.stopWatching();
  });

  // Register plugins manually (instead of AutoLoad)
  await fastify.register(sensiblePlugin);
  await fastify.register(supportPlugin);

  // Register routes manually (instead of AutoLoad)
  await fastify.register(healthRoute, opts);
  await fastify.register(rootRoute, opts);
  await fastify.register(webhookRoute, opts);
};

export default app;
export { app, options };
