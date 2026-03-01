import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', service: 'tenant', timestamp: new Date().toISOString() };
  });

  // Prometheus-compatible metrics endpoint
  app.get('/metrics', async (_request, reply) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = (Date.now() - startTime) / 1000;

    const lines = [
      '# HELP process_uptime_seconds Time since service started',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds{service="tenant"} ${uptimeSeconds.toFixed(1)}`,
      '# HELP process_resident_memory_bytes Resident memory size in bytes',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes{service="tenant"} ${mem.rss}`,
      '# HELP process_heap_used_bytes Heap memory used in bytes',
      '# TYPE process_heap_used_bytes gauge',
      `process_heap_used_bytes{service="tenant"} ${mem.heapUsed}`,
      '# HELP process_heap_total_bytes Total heap memory in bytes',
      '# TYPE process_heap_total_bytes gauge',
      `process_heap_total_bytes{service="tenant"} ${mem.heapTotal}`,
      '# HELP nodejs_eventloop_lag_seconds Event loop lag',
      '# TYPE nodejs_eventloop_lag_seconds gauge',
      `nodejs_eventloop_lag_seconds{service="tenant"} 0`,
      '',
    ];

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n'));
  });
}
