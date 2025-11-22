import type { FastifyInstance } from 'fastify';
import { config } from '../services/config';

interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
  dependencies: {
    sparky: 'ok' | 'error';
    resend: 'ok' | 'error';
  };
  nodeVersion?: string;
}

/**
 * Health check endpoint for monitoring service status
 * Returns service health information and dependency status
 * No external network calls - just validates config is present
 */
export default async function healthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    // Check if dependencies are configured (lightweight check, no network calls)
    const sparkyStatus = config.sparkyLlmUrl && config.sparkyLlmUrl.length > 0 ? 'ok' : 'error';
    const resendStatus = config.resendApiKey && config.resendApiKey.length > 0 ? 'ok' : 'error';

    const response: HealthResponse = {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        sparky: sparkyStatus,
        resend: resendStatus,
      },
      nodeVersion: process.version,
    };

    return reply.code(200).send(response);
  });
}
