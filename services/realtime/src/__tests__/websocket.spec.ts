import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';
import { RoomManagerService } from '../services/room-manager.service';
import { PresenceService } from '../services/presence.service';

/**
 * Integration tests for realtime WebSocket server.
 *
 * We build a minimal Fastify + Socket.IO server that mirrors the real
 * websocket plugin logic, but without Redis or Kafka dependencies.
 * This lets us test the Socket.IO handshake, JOIN_ROOM / LEAVE_ROOM /
 * PING message flows, RBAC, and heartbeat lifecycle.
 */

// RSA key pair for JWT tests (generated once, deterministic)
const { privateKey, publicKey } = (() => {
  const crypto = require('crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
})();

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
}

const SUPER_ADMIN_TOKEN = signToken({
  sub: 'user-admin',
  email: 'admin@au-aris.org',
  role: 'SUPER_ADMIN',
  tenantId: 'tenant-au',
  tenantLevel: 'CONTINENTAL',
});

const NATIONAL_ADMIN_TOKEN = signToken({
  sub: 'user-national',
  email: 'admin@ke.au-aris.org',
  role: 'NATIONAL_ADMIN',
  tenantId: 'tenant-ke',
  tenantLevel: 'MEMBER_STATE',
});

const REC_ADMIN_TOKEN = signToken({
  sub: 'user-rec',
  email: 'admin@igad.au-aris.org',
  role: 'REC_ADMIN',
  tenantId: 'tenant-igad',
  tenantLevel: 'REC',
});

let app: FastifyInstance;
let port: number;

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', (err) => reject(err));
    // Timeout after 5s
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function waitForEvent(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function emitWithAck(socket: ClientSocket, event: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ack for: ${event}`)), 3000);
    socket.emit(event, data, (response: any) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

beforeAll(async () => {
  app = Fastify({ logger: false });

  const roomManager = new RoomManagerService();
  const presenceService = new PresenceService();

  app.decorate('roomManager', roomManager);
  app.decorate('presenceService', presenceService);
  app.decorate('jwtPublicKey', publicKey);
  app.decorate('authHookFn', async () => {});

  // Mount Socket.IO with same config as production
  const ioServer = new Server(app.server, {
    cors: { origin: '*', credentials: true },
    transports: ['websocket', 'polling'],
    path: '/ws',
    pingInterval: 30_000,
    pingTimeout: 90_000,
  });

  // JWT auth middleware
  ioServer.use((socket, next) => {
    const token =
      (socket.handshake.auth?.['token'] as string | undefined) ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
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

  ioServer.on('connection', async (socket) => {
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

    await presenceService.setOnline(user.tenantId, user.userId, user.email);

    socket.emit('connected', {
      socketId: socket.id,
      userId: user.userId,
      tenantId: user.tenantId,
    });

    // JOIN_ROOM
    socket.on('JOIN_ROOM', async (data: { roomId?: string }, callback?: (res: unknown) => void) => {
      const roomId = data?.roomId;
      if (!roomId) {
        const res = { type: 'ERROR', code: 'BAD_REQUEST', message: 'roomId is required' };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      if (!roomManager.isValidHierarchicalRoom(roomId)) {
        const res = { type: 'ERROR', code: 'BAD_REQUEST', message: `Invalid room format: ${roomId}` };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      const auth = roomManager.authorizeRoom(socket.id, roomId);
      if (!auth.authorized) {
        const res = { type: 'ERROR', code: 'UNAUTHORIZED', message: auth.reason };
        callback?.(res);
        socket.emit('message', res);
        return;
      }

      roomManager.joinRoom(socket.id, roomId);
      await socket.join(roomId);

      const memberCount = roomManager.getRoomMemberCount(roomId);
      const res = { type: 'ROOM_JOINED', roomId, memberCount };
      callback?.(res);
      socket.emit('message', res);
    });

    // LEAVE_ROOM
    socket.on('LEAVE_ROOM', async (data: { roomId?: string }, callback?: (res: unknown) => void) => {
      const roomId = data?.roomId;
      if (!roomId) {
        callback?.({ type: 'ERROR', code: 'BAD_REQUEST', message: 'roomId is required' });
        return;
      }
      roomManager.leaveRoom(socket.id, roomId);
      await socket.leave(roomId);
      callback?.({ type: 'ROOM_LEFT', roomId });
    });

    // PING
    socket.on('PING', (data: { timestamp?: number }, callback?: (res: unknown) => void) => {
      roomManager.updateHeartbeat(socket.id);
      const res = { type: 'PONG', timestamp: data?.timestamp ?? Date.now() };
      callback?.(res);
      socket.emit('message', res);
    });

    // Legacy subscribe
    socket.on('subscribe', async (data: { channel: string }, callback?: (res: unknown) => void) => {
      if (!data?.channel || !roomManager.isValidChannel(data.channel)) {
        callback?.({ success: false, error: 'Invalid channel' });
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

    // Disconnect
    socket.on('disconnect', async () => {
      const clientInfo = roomManager.getClient(socket.id);
      if (clientInfo) {
        await presenceService.setOffline(clientInfo.tenantId, clientInfo.userId);
      }
      roomManager.unregisterClient(socket.id);
    });
  });

  app.decorate('io', ioServer);
  app.addHook('onClose', () => {
    ioServer.close();
  });

  await app.listen({ port: 0 }); // Random available port
  const address = app.server.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  await app.close();
});

describe('WebSocket Integration', () => {
  let client: ClientSocket;

  afterAll(async () => {
    // Any lingering connections
  });

  describe('Authentication', () => {
    it('connects with a valid JWT token', async () => {
      client = await connectClient(SUPER_ADMIN_TOKEN);
      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it('receives "connected" event with user info', async () => {
      const connected = new Promise<any>((resolve) => {
        const c = ioClient(`http://localhost:${port}`, {
          path: '/ws',
          transports: ['websocket'],
          auth: { token: NATIONAL_ADMIN_TOKEN },
        });
        c.on('connected', (data) => {
          resolve({ data, client: c });
        });
      });

      const result = await connected;
      expect(result.data.userId).toBe('user-national');
      expect(result.data.tenantId).toBe('tenant-ke');
      result.client.disconnect();
    });

    it('rejects connection without token', async () => {
      await expect(
        new Promise<void>((resolve, reject) => {
          const c = ioClient(`http://localhost:${port}`, {
            path: '/ws',
            transports: ['websocket'],
            auth: {},
          });
          c.on('connect', () => {
            c.disconnect();
            reject(new Error('Should not connect'));
          });
          c.on('connect_error', (err) => {
            resolve();
          });
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects connection with invalid token', async () => {
      await expect(
        new Promise<void>((resolve, reject) => {
          const c = ioClient(`http://localhost:${port}`, {
            path: '/ws',
            transports: ['websocket'],
            auth: { token: 'invalid.jwt.token' },
          });
          c.on('connect', () => {
            c.disconnect();
            reject(new Error('Should not connect'));
          });
          c.on('connect_error', () => resolve());
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('JOIN_ROOM', () => {
    it('joins a campaign room successfully', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:campaign:test-campaign' });
      expect(response.type).toBe('ROOM_JOINED');
      expect(response.roomId).toBe('room:campaign:test-campaign');
      expect(response.memberCount).toBe(1);

      client.disconnect();
    });

    it('joins a country room', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:country:KE' });
      expect(response.type).toBe('ROOM_JOINED');
      expect(response.roomId).toBe('room:country:KE');

      client.disconnect();
    });

    it('SUPER_ADMIN joins continental room', async () => {
      client = await connectClient(SUPER_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:continental' });
      expect(response.type).toBe('ROOM_JOINED');
      expect(response.roomId).toBe('room:continental');

      client.disconnect();
    });

    it('rejects NATIONAL_ADMIN from continental room (RBAC)', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:continental' });
      expect(response.type).toBe('ERROR');
      expect(response.code).toBe('UNAUTHORIZED');

      client.disconnect();
    });

    it('rejects NATIONAL_ADMIN from REC room (RBAC)', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:rec:IGAD' });
      expect(response.type).toBe('ERROR');
      expect(response.code).toBe('UNAUTHORIZED');

      client.disconnect();
    });

    it('REC_ADMIN joins REC room', async () => {
      client = await connectClient(REC_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:rec:IGAD' });
      expect(response.type).toBe('ROOM_JOINED');

      client.disconnect();
    });

    it('rejects invalid room format', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', { roomId: 'invalid-room' });
      expect(response.type).toBe('ERROR');
      expect(response.code).toBe('BAD_REQUEST');

      client.disconnect();
    });

    it('returns error when roomId is missing', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'JOIN_ROOM', {});
      expect(response.type).toBe('ERROR');
      expect(response.code).toBe('BAD_REQUEST');
      expect(response.message).toContain('roomId is required');

      client.disconnect();
    });
  });

  describe('LEAVE_ROOM', () => {
    it('leaves a joined room', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:campaign:c2' });
      const response = await emitWithAck(client, 'LEAVE_ROOM', { roomId: 'room:campaign:c2' });
      expect(response.type).toBe('ROOM_LEFT');
      expect(response.roomId).toBe('room:campaign:c2');

      client.disconnect();
    });
  });

  describe('PING / PONG', () => {
    it('responds with PONG and echoes timestamp', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const ts = Date.now();
      const response = await emitWithAck(client, 'PING', { timestamp: ts });
      expect(response.type).toBe('PONG');
      expect(response.timestamp).toBe(ts);

      client.disconnect();
    });

    it('uses current timestamp when none provided', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const before = Date.now();
      const response = await emitWithAck(client, 'PING', {});
      const after = Date.now();
      expect(response.type).toBe('PONG');
      expect(response.timestamp).toBeGreaterThanOrEqual(before);
      expect(response.timestamp).toBeLessThanOrEqual(after);

      client.disconnect();
    });
  });

  describe('Legacy subscribe', () => {
    it('subscribes to outbreaks channel with tenant scoping', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'subscribe', { channel: 'outbreaks' });
      expect(response.success).toBe(true);
      expect(response.room).toBe('outbreaks:tenant-ke');

      client.disconnect();
    });

    it('rejects invalid channel', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);

      const response = await emitWithAck(client, 'subscribe', { channel: 'invalid' });
      expect(response.success).toBe(false);

      client.disconnect();
    });
  });

  describe('Multi-client room isolation', () => {
    it('two clients in same campaign room see correct member count', async () => {
      const client1 = await connectClient(NATIONAL_ADMIN_TOKEN);
      const client2 = await connectClient(SUPER_ADMIN_TOKEN);

      const res1 = await emitWithAck(client1, 'JOIN_ROOM', { roomId: 'room:campaign:shared' });
      expect(res1.memberCount).toBe(1);

      const res2 = await emitWithAck(client2, 'JOIN_ROOM', { roomId: 'room:campaign:shared' });
      expect(res2.memberCount).toBe(2);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe('Disconnect cleanup', () => {
    it('cleans up client state on disconnect', async () => {
      client = await connectClient(NATIONAL_ADMIN_TOKEN);
      await emitWithAck(client, 'JOIN_ROOM', { roomId: 'room:campaign:cleanup-test' });

      // Disconnect
      client.disconnect();

      // Wait a moment for server-side cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify through a new connection's room member count
      const client2 = await connectClient(SUPER_ADMIN_TOKEN);
      const res = await emitWithAck(client2, 'JOIN_ROOM', { roomId: 'room:campaign:cleanup-test' });
      expect(res.memberCount).toBe(1); // Only client2
      client2.disconnect();
    });
  });
});
