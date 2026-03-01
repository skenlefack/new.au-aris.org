import { config } from 'dotenv';
import { resolve } from 'path';

const envResult = config({ path: resolve(__dirname, '../../../.env') });
if (envResult.error) {
  console.warn('Warning: could not load .env file:', envResult.error.message);
}

import { buildApp } from './app.js';

const SERVICE_NAME = 'interop-v2';

async function main(): Promise<void> {
  const app = await buildApp();
  const port = parseInt(process.env['INTEROP_V2_PORT'] ?? process.env['INTEROP_PORT'] ?? '3042', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Interop V2 service running on port ${port}`);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      console.error(
        `\n[${SERVICE_NAME}] Port ${port} is already in use.\n` +
        `Another instance may be running. To fix:\n` +
        `  1. Find the process:  lsof -i :${port}  (or:  netstat -ano | findstr ${port})\n` +
        `  2. Kill it:           kill <PID>         (or:  taskkill /PID <PID> /F)\n` +
        `  3. Or change port:    INTEROP_V2_PORT=<other> in .env\n`,
      );
      process.exit(1);
    }
    throw err;
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start interop-v2 service:', err);
  process.exit(1);
});
