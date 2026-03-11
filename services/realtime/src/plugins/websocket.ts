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

/** Heartbeat interval (30s) and timeout (90s) */
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;

export default fp(async (app: FastifyInstance) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/ws',
    pingInterval: HEARTBEAT_INTERVAL_MS,
    pingTimeout: HEARTBEAT_TIMEOUT_MS,
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

  const roomManager = app.roomManager;
  const presence = app.presenceService;

  // ── Server-side heartbeat: disconnect stale clients every 30s ──

  const heartbeatTimer = setInterval(() => {
    const stale = roomManager.getStaleClients(HEARTBEAT_TIMEOUT_MS);
    for (const socketId of stale) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        app.log.info(`Heartbeat timeout for socket ${socketId}, disconnecting`);
        sock.emit('message', { type: 'ERROR', code: 'HEARTBEAT_TIMEOUT', message: 'No heartbeat received within 90s' });
        sock.disconnect(true);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ── Connection handler ──

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
      lastHeartbeat: Date.now(),
    });

    // Update presence
    await presence.setOnline(user.tenantId, user.userId, user.email);
    await presence.recordHeartbeat(socket.id);

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

    // ── JOIN_ROOM handler (hierarchical rooms with RBAC) ──

    socket.on('JOIN_ROOM', async (data: { roomId?: string; token?: string }, callback?: (res: unknown) => void) => {
      const roomId = data?.roomId;
      if (!roomId) {
        const res = { type: 'ERROR', code: 'BAD_REQUEST', message: 'roomId is required' };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      // Validate room format
      if (!roomManager.isValidHierarchicalRoom(roomId)) {
        const res = { type: 'ERROR', code: 'BAD_REQUEST', message: `Invalid room format: ${roomId}` };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      // If a token is provided in the message, re-validate it
      if (data.token) {
        try {
          jwt.verify(data.token, app.jwtPublicKey, { algorithms: ['RS256'] });
        } catch {
          const res = { type: 'ERROR', code: 'UNAUTHORIZED', message: 'Invalid token' };
          callback?.(res);
          socket.emit('message', res);
          return;
        }
      }

      // RBAC authorization
      const auth = roomManager.authorizeRoom(socket.id, roomId);
      if (!auth.authorized) {
        const res = { type: 'ERROR', code: 'UNAUTHORIZED', message: auth.reason };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      // Join the room
      roomManager.joinRoom(socket.id, roomId);
      await socket.join(roomId);
      await presence.incrementRoomCount(roomId);

      const memberCount = roomManager.getRoomMemberCount(roomId);
      const res = { type: 'ROOM_JOINED', roomId, memberCount };
      callback?.(res);
      socket.emit('message', res);

      app.log.debug(`Socket ${socket.id} joined ${roomId} (members: ${memberCount})`);
    });

    // ── LEAVE_ROOM handler ──

    socket.on('LEAVE_ROOM', async (data: { roomId?: string }, callback?: (res: unknown) => void) => {
      const roomId = data?.roomId;
      if (!roomId) {
        callback?.({ type: 'ERROR', code: 'BAD_REQUEST', message: 'roomId is required' });
        return;
      }

      roomManager.leaveRoom(socket.id, roomId);
      await socket.leave(roomId);
      await presence.decrementRoomCount(roomId);

      callback?.({ type: 'ROOM_LEFT', roomId });
    });

    // ── PING handler ──

    socket.on('PING', (data: { timestamp?: number }, callback?: (res: unknown) => void) => {
      roomManager.updateHeartbeat(socket.id);
      presence.recordHeartbeat(socket.id);

      const res = { type: 'PONG', timestamp: data?.timestamp ?? Date.now() };
      callback?.(res);
      socket.emit('message', res);
    });

    // ── Legacy subscribe handler (backward compatibility) ──

    socket.on('subscribe', async (data: { channel: string }, callback?: (res: unknown) => void) => {
      if (!data?.channel) {
        callback?.({ success: false, error: 'Channel is required' });
        return;
      }

      if (!roomManager.isValidChannel(data.channel)) {
        callback?.({
          success: false,
          error: 'Invalid channel. Valid: outbreaks, workflow, notifications, sync-status, alerts',
        });
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

    // ── Legacy unsubscribe handler ──

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

    // ── Legacy ping handler ──

    socket.on('ping', (callback?: (res: unknown) => void) => {
      roomManager.updateHeartbeat(socket.id);
      callback?.({ event: 'pong', data: { time: Date.now() } });
    });

    // ── Disconnect handler ──

    socket.on('disconnect', async () => {
      const clientInfo = roomManager.getClient(socket.id);
      if (clientInfo) {
        await presence.setOffline(clientInfo.tenantId, clientInfo.userId);
        await presence.removeHeartbeat(socket.id);

        // Decrement room counts for all hierarchical rooms
        for (const room of clientInfo.rooms) {
          if (roomManager.isValidHierarchicalRoom(room)) {
            await presence.decrementRoomCount(room);
          }
        }

        // Broadcast presence update
        const updatedPresence = presence.getTenantPresence(clientInfo.tenantId);
        io.to(`tenant:${clientInfo.tenantId}`).emit('presence:updated', updatedPresence);
      }

      roomManager.unregisterClient(socket.id);
    });
  });

  app.decorate('io', io);
  app.addHook('onClose', () => {
    clearInterval(heartbeatTimer);
    io.close();
  });
}, { name: 'websocket-plugin' });
