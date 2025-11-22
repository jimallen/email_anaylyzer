import Fastify from 'fastify';
import { app, options } from './app';
import { config } from './services/config';

/**
 * Server entry point with PM2 process management support
 * Implements graceful shutdown for zero-downtime deployments
 * Logger configuration is defined in app.ts options
 */

// Create Fastify instance with options (includes logger config from app.ts)
const fastify = Fastify(options);

/**
 * Graceful shutdown handler for SIGTERM and SIGINT signals
 * Ensures in-flight requests complete before process exits
 * Max wait time: 30 seconds for in-flight requests
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  fastify.log.info(`Received ${signal}, closing server gracefully...`);

  try {
    // Create a timeout promise for 30 seconds
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout after 30 seconds')), 30000);
    });

    // Race between closing the server and timeout
    // Fastify.close() stops accepting new connections and waits for in-flight requests
    await Promise.race([fastify.close(), timeoutPromise]);

    fastify.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    fastify.log.error(error, 'Error during graceful shutdown');
    process.exit(1);
  }
};

// Register signal handlers for PM2 reload
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the server
 */
const start = async (): Promise<void> => {
  try {
    // Register the application plugin
    await fastify.register(app, options);

    // Start listening
    const address = await fastify.listen({
      port: config.port,
      host: '0.0.0.0', // Listen on all interfaces for Docker/remote access
    });

    fastify.log.info(`Server listening at ${address}`);
    fastify.log.info(`Health check available at ${address}/health`);
  } catch (error) {
    fastify.log.error(error, 'Error starting server');
    process.exit(1);
  }
};

// Start the server
start();
