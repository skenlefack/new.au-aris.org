import { buildApp } from './app';

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env['FORM_BUILDER_PORT'] ?? 3010);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Form Builder service running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start Form Builder service:', err);
  process.exit(1);
});
