import { buildApp } from './app';

async function main(): Promise<void> {
  const app = await buildApp();

  const port = parseInt(process.env['REALTIME_PORT'] ?? '3008', 10);
  const host = process.env['HOST'] ?? '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`Realtime service listening on ${host}:${port}`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down…`);
      await app.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('Failed to start realtime service:', err);
  process.exit(1);
});
