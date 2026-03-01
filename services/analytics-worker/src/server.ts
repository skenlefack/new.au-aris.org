import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { buildApp } from './app';

async function main(): Promise<void> {
  const app = await buildApp();
  const port = parseInt(process.env['ANALYTICS_WORKER_PORT'] ?? '3043', 10);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Analytics worker service running on port ${port}`);
}

main().catch((err) => {
  console.error('Failed to start analytics worker service:', err);
  process.exit(1);
});
