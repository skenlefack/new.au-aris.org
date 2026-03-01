import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'interop-v2',
    timestamp: new Date().toISOString(),
  }));

  app.get('/metrics', async (_request, reply) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = (Date.now() - startTime) / 1000;

    const lines = [
      `# HELP process_uptime_seconds Time since service start`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds{service="interop-v2"} ${uptimeSeconds.toFixed(1)}`,
      `# HELP process_resident_memory_bytes Resident memory size in bytes`,
      `# TYPE process_resident_memory_bytes gauge`,
      `process_resident_memory_bytes{service="interop-v2"} ${mem.rss}`,
      `# HELP process_heap_used_bytes Heap used size in bytes`,
      `# TYPE process_heap_used_bytes gauge`,
      `process_heap_used_bytes{service="interop-v2"} ${mem.heapUsed}`,
      `# HELP process_heap_total_bytes Heap total size in bytes`,
      `# TYPE process_heap_total_bytes gauge`,
      `process_heap_total_bytes{service="interop-v2"} ${mem.heapTotal}`,
    ];

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n'));
  });
}
