import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load environment variables before tests run
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
