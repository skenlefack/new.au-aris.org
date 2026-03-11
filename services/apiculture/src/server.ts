import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { buildApp } from './app';

async function main(): Promise<void> {
  const app = await buildApp();
  const port = parseInt(process.env['APICULTURE_PORT'] ?? '3024', 10);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Apiculture service running on port ${port}`);
}

main().catch((err) => {
  console.error('Failed to start apiculture service:', err);
  process.exit(1);
});
