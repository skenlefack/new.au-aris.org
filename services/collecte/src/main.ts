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
