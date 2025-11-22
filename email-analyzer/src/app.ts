// Load environment variables first
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
// Import config to trigger validation on startup
import './services/config'
// Import whitelist manager for hot-reload capability
import { whitelistManager } from './services/whitelist-manager'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
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
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!

  // Start whitelist file watcher for hot-reload capability
  whitelistManager.startWatching(fastify.log);

  // Stop watcher on server close
  fastify.addHook('onClose', async () => {
    whitelistManager.stopWatching();
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })
}

export default app
export { app, options }
