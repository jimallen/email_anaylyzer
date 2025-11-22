import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import healthRoute from './health';

describe('Health Check Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(healthRoute);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return HTTP 200 status code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return JSON response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return all required fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('dependencies');
      expect(body.dependencies).toHaveProperty('sparky');
      expect(body.dependencies).toHaveProperty('resend');
    });

    it('should return status "ok"', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });

    it('should return uptime as a positive number', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return uptime from process.uptime()', async () => {
      const beforeUptime = Math.floor(process.uptime());

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      const afterUptime = Math.floor(process.uptime());

      // Uptime should be within range (allowing for test execution time)
      expect(body.uptime).toBeGreaterThanOrEqual(beforeUptime);
      expect(body.uptime).toBeLessThanOrEqual(afterUptime + 1);
    });

    it('should return timestamp in ISO 8601 format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(body.timestamp).toMatch(iso8601Regex);
    });

    it('should return timestamp in UTC timezone', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      // UTC timestamps end with 'Z'
      expect(body.timestamp).toMatch(/Z$/);
    });

    it('should return current timestamp', async () => {
      const beforeTime = new Date().getTime();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const afterTime = new Date().getTime();
      const body = JSON.parse(response.body);
      const responseTime = new Date(body.timestamp).getTime();

      // Timestamp should be within request timeframe
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });

    it('should check sparky dependency status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(['ok', 'error']).toContain(body.dependencies.sparky);
    });

    it('should check resend dependency status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(['ok', 'error']).toContain(body.dependencies.resend);
    });

    it('should report sparky as "ok" when configured', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      // Since we have SPARKY_LLM_URL configured in .env, should be ok
      expect(body.dependencies.sparky).toBe('ok');
    });

    it('should report resend as "ok" when configured', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      // Since we have RESEND_API_KEY configured in .env, should be ok
      expect(body.dependencies.resend).toBe('ok');
    });

    it('should respond in less than 100ms', async () => {
      const startTime = Date.now();

      await app.inject({
        method: 'GET',
        url: '/health',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should not require authentication', async () => {
      // Request without any auth headers
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Should succeed without authentication
      expect(response.statusCode).toBe(200);
    });

    it('should include Node.js version for debugging', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('nodeVersion');
      expect(body.nodeVersion).toBe(process.version);
    });
  });
});
