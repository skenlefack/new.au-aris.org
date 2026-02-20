import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload, AuthModuleOptions } from '@aris/auth-middleware';
import { AUTH_MODULE_OPTIONS } from '@aris/auth-middleware';
import { RoomManagerService } from './room-manager.service';
import { PresenceService } from '../presence/presence.service';

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly authOptions: AuthModuleOptions,
    private readonly roomManager: RoomManagerService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Connection rejected: no token (${client.id})`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload = this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Connection rejected: invalid token (${client.id})`);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect(true);
        return;
      }

      this.roomManager.registerClient({
        socketId: client.id,
        userId: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        tenantLevel: payload.tenantLevel,
        role: payload.role,
        connectedAt: new Date(),
        rooms: new Set(),
      });

      // Join Socket.IO room for tenant
      await client.join(`tenant:${payload.tenantId}`);

      // Auto-subscribe to user-specific notifications
      const notifRoom = this.roomManager.subscribeToUserRoom(
        client.id,
        'notifications',
      );
      if (notifRoom) {
        await client.join(notifRoom);
      }

      // Update presence
      this.presenceService.setOnline(payload.tenantId, payload.sub, payload.email);

      // Broadcast presence update to tenant
      const presence = this.presenceService.getTenantPresence(payload.tenantId);
      this.server
        .to(`tenant:${payload.tenantId}`)
        .emit('presence:updated', presence);

      client.emit('connected', {
        socketId: client.id,
        userId: payload.sub,
        tenantId: payload.tenantId,
      });

      this.logger.log(
        `Client connected: ${client.id} (user=${payload.sub}, tenant=${payload.tenantId})`,
      );
    } catch (error) {
      this.logger.error(
        `Connection error: ${error instanceof Error ? error.message : String(error)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const clientInfo = this.roomManager.getClient(client.id);
    if (clientInfo) {
      this.presenceService.setOffline(clientInfo.tenantId, clientInfo.userId);

      // Broadcast presence update
      const presence = this.presenceService.getTenantPresence(
        clientInfo.tenantId,
      );
      this.server
        .to(`tenant:${clientInfo.tenantId}`)
        .emit('presence:updated', presence);
    }

    this.roomManager.unregisterClient(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ): Promise<{ success: boolean; room?: string; error?: string }> {
    if (!data?.channel) {
      return { success: false, error: 'Channel is required' };
    }

    if (!this.roomManager.isValidChannel(data.channel)) {
      return {
        success: false,
        error: `Invalid channel. Valid: ${['outbreaks', 'workflow', 'notifications', 'sync-status', 'alerts'].join(', ')}`,
      };
    }

    const room = this.roomManager.subscribeToChannel(client.id, data.channel);
    if (!room) {
      return { success: false, error: 'Client not registered' };
    }

    await client.join(room);
    return { success: true, room };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ): Promise<{ success: boolean }> {
    if (!data?.channel || !this.roomManager.isValidChannel(data.channel)) {
      return { success: false };
    }

    const room = this.roomManager.unsubscribeFromChannel(
      client.id,
      data.channel,
    );
    if (room) {
      await client.leave(room);
    }
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: { time: number } } {
    return { event: 'pong', data: { time: Date.now() } };
  }

  /**
   * Broadcast an event to a specific room.
   * Called by the Kafka consumer service.
   */
  broadcastToRoom(room: string, event: string, payload: unknown): void {
    this.server.to(room).emit(event, payload);
    this.roomManager.incrementMessageCount();
  }

  /**
   * Broadcast to all connected clients (e.g. continental alerts).
   */
  broadcastToAll(event: string, payload: unknown): void {
    this.server.emit(event, payload);
    this.roomManager.incrementMessageCount();
  }

  private extractToken(client: Socket): string | null {
    // Check auth.token in handshake
    const authToken = client.handshake.auth?.['token'] as string | undefined;
    if (authToken) return authToken;

    // Check Authorization header
    const authHeader = client.handshake.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Check query param
    const queryToken = client.handshake.query['token'] as string | undefined;
    if (queryToken) return queryToken;

    return null;
  }

  private verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.authOptions.publicKey, {
        algorithms: (this.authOptions.algorithms as jwt.Algorithm[]) ?? [
          'RS256',
        ],
      }) as JwtPayload;
    } catch {
      return null;
    }
  }
}
