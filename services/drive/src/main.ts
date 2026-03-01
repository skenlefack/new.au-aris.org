import { buildApp } from './app';

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env['DRIVE_PORT'] ?? 3007);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Drive service running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start Drive service:', err);
  process.exit(1);
});
