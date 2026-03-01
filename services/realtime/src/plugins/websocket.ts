import { Server as SocketIOServer } from 'socket.io';
import fp from 'fastify-plugin';
import * as jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '@aris/auth-middleware';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export default fp(async (app: FastifyInstance) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/ws',
  });

  // JWT auth middleware on Socket.IO handshake
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.['token'] as string | undefined) ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      (socket.handshake.query?.['token'] as string | undefined);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, app.jwtPublicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      socket.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantLevel: payload.tenantLevel,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Connection/disconnection handlers using RoomManagerService and PresenceService
  const roomManager = app.roomManager;
  const presence = app.presenceService;

  io.on('connection', async (socket) => {
    const user = socket.data.user;

    roomManager.registerClient({
      socketId: socket.id,
      userId: user.userId,
      email: user.email,
      tenantId: user.tenantId,
      tenantLevel: user.tenantLevel,
      role: user.role,
      connectedAt: new Date(),
      rooms: new Set(),
    });

    // Update presence
    presence.setOnline(user.tenantId, user.userId, user.email);

    // Join Socket.IO rooms
    await socket.join(`tenant:${user.tenantId}`);

    // Auto-subscribe to user-specific notifications
    const notifRoom = roomManager.subscribeToUserRoom(socket.id, 'notifications');
    if (notifRoom) {
      await socket.join(notifRoom);
    }

    // Broadcast presence update to tenant
    io.to(`tenant:${user.tenantId}`).emit(
      'presence:updated',
      presence.getTenantPresence(user.tenantId),
    );

    socket.emit('connected', {
      socketId: socket.id,
      userId: user.userId,
      tenantId: user.tenantId,
    });

    // ── Subscribe handler ──
    socket.on('subscribe', async (data: { channel: string }, callback?: (res: unknown) => void) => {
      if (!data?.channel) {
        const res = { success: false, error: 'Channel is required' };
        callback?.(res);
        return;
      }

      if (!roomManager.isValidChannel(data.channel)) {
        const res = {
          success: false,
          error: `Invalid channel. Valid: outbreaks, workflow, notifications, sync-status, alerts`,
        };
        callback?.(res);
        return;
      }

      const room = roomManager.subscribeToChannel(socket.id, data.channel);
      if (!room) {
        callback?.({ success: false, error: 'Client not registered' });
        return;
      }

      await socket.join(room);
      callback?.({ success: true, room });
    });

    // ── Unsubscribe handler ──
    socket.on('unsubscribe', async (data: { channel: string }, callback?: (res: unknown) => void) => {
      if (!data?.channel || !roomManager.isValidChannel(data.channel)) {
        callback?.({ success: false });
        return;
      }

      const room = roomManager.unsubscribeFromChannel(socket.id, data.channel);
      if (room) {
        await socket.leave(room);
      }
      callback?.({ success: true });
    });

    // ── Ping handler ──
    socket.on('ping', (callback?: (res: unknown) => void) => {
      callback?.({ event: 'pong', data: { time: Date.now() } });
    });

    // ── Disconnect handler ──
    socket.on('disconnect', () => {
      const clientInfo = roomManager.getClient(socket.id);
      if (clientInfo) {
        presence.setOffline(clientInfo.tenantId, clientInfo.userId);

        // Broadcast presence update
        const updatedPresence = presence.getTenantPresence(clientInfo.tenantId);
        io.to(`tenant:${clientInfo.tenantId}`).emit('presence:updated', updatedPresence);
      }

      roomManager.unregisterClient(socket.id);
    });
  });

  app.decorate('io', io);
  app.addHook('onClose', () => io.close());
}, { name: 'websocket-plugin' });
