import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { buildApp } from './app';

async function main(): Promise<void> {
  const app = await buildApp();
  const port = parseInt(process.env['CLIMATE_ENV_PORT'] ?? '3027', 10);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Climate-Env service running on port ${port}`);
}

main().catch((err) => {
  console.error('Failed to start climate-env service:', err);
  process.exit(1);
});
