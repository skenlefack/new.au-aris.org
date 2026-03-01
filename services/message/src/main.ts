import { buildApp } from './app';

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env['MESSAGE_PORT'] ?? 3006);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Message service running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start message service:', err);
  process.exit(1);
});
