import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // GET /health — public health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /ready — readiness probe
  app.get('/ready', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /api/v1/realtime/health — API-namespaced health
  app.get('/api/v1/realtime/health', async () => ({
    status: 'ok',
    service: 'realtime',
    timestamp: new Date().toISOString(),
  }));

  // GET /api/v1/realtime/stats — authenticated stats endpoint
  app.get('/api/v1/realtime/stats', {
    preHandler: [app.authHookFn],
  }, async () => {
    const stats = app.roomManager.getStats();
    const rooms = app.roomManager.getAllRooms();
    const totalOnlineUsers = app.presenceService.getAllOnlineCount();

    return {
      data: {
        ...stats,
        rooms,
        totalOnlineUsers,
      },
    };
  });
}
