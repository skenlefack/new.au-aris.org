import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root
const envResult = config({ path: resolve(__dirname, '../../../.env') });
if (envResult.error) {
  console.warn('Warning: could not load .env file:', envResult.error.message);
}

// Initialize OpenTelemetry tracing BEFORE any other imports
import { initTracing } from '@aris/observability/tracing';
initTracing('collecte', '0.1.0');

import { buildApp } from './app';

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env['COLLECTE_PORT'] ?? 3011);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Collecte service running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start Collecte service:', err);
  process.exit(1);
});
