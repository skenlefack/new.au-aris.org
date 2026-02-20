import { Injectable, Logger } from '@nestjs/common';
import type { TenantLevel } from '@aris/shared-types';

export interface ConnectedClient {
  socketId: string;
  userId: string;
  email: string;
  tenantId: string;
  tenantLevel: TenantLevel;
  role: string;
  connectedAt: Date;
  rooms: Set<string>;
}

export interface RoomStats {
  name: string;
  clientCount: number;
}

/** Valid channel prefixes for subscription requests */
export const VALID_CHANNELS = [
  'outbreaks',
  'workflow',
  'notifications',
  'sync-status',
  'alerts',
] as const;

export type Channel = (typeof VALID_CHANNELS)[number];

@Injectable()
export class RoomManagerService {
  private readonly logger = new Logger(RoomManagerService.name);

  /** socketId → client metadata */
  private readonly clients = new Map<string, ConnectedClient>();

  /** roomName → set of socketIds */
  private readonly rooms = new Map<string, Set<string>>();

  /** Message counter for throughput stats */
  private messageCount = 0;
  private readonly startTime = Date.now();

  registerClient(client: ConnectedClient): void {
    this.clients.set(client.socketId, client);

    // Auto-join tenant room
    const tenantRoom = `tenant:${client.tenantId}`;
    this.joinRoom(client.socketId, tenantRoom);

    this.logger.log(
      `Client ${client.socketId} registered (user=${client.userId}, tenant=${client.tenantId})`,
    );
  }

  unregisterClient(socketId: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    // Leave all rooms
    for (const room of client.rooms) {
      this.leaveRoom(socketId, room);
    }

    this.clients.delete(socketId);
    this.logger.log(`Client ${socketId} unregistered (user=${client.userId})`);
  }

  joinRoom(socketId: string, room: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) return false;

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
    client.rooms.add(room);
    return true;
  }

  leaveRoom(socketId: string, room: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) return false;

    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(socketId);
      if (roomSet.size === 0) {
        this.rooms.delete(room);
      }
    }
    client.rooms.delete(room);
    return true;
  }

  /**
   * Subscribe a client to a channel scoped to their tenant.
   * Returns the full room name (e.g. "outbreaks:tenant-uuid").
   */
  subscribeToChannel(socketId: string, channel: Channel): string | null {
    const client = this.clients.get(socketId);
    if (!client) return null;

    const room = `${channel}:${client.tenantId}`;
    this.joinRoom(socketId, room);
    return room;
  }

  unsubscribeFromChannel(socketId: string, channel: Channel): string | null {
    const client = this.clients.get(socketId);
    if (!client) return null;

    const room = `${channel}:${client.tenantId}`;
    this.leaveRoom(socketId, room);
    return room;
  }

  /**
   * Subscribe to user-specific room (e.g. notifications).
   */
  subscribeToUserRoom(socketId: string, channel: string): string | null {
    const client = this.clients.get(socketId);
    if (!client) return null;

    const room = `${channel}:${client.userId}`;
    this.joinRoom(socketId, room);
    return room;
  }

  getClient(socketId: string): ConnectedClient | undefined {
    return this.clients.get(socketId);
  }

  getClientsInRoom(room: string): string[] {
    return Array.from(this.rooms.get(room) ?? []);
  }

  getClientsByTenant(tenantId: string): ConnectedClient[] {
    const result: ConnectedClient[] = [];
    for (const client of this.clients.values()) {
      if (client.tenantId === tenantId) {
        result.push(client);
      }
    }
    return result;
  }

  getClientByUserId(userId: string): ConnectedClient | undefined {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        return client;
      }
    }
    return undefined;
  }

  getAllRooms(): RoomStats[] {
    const stats: RoomStats[] = [];
    for (const [name, members] of this.rooms) {
      stats.push({ name, clientCount: members.size });
    }
    return stats;
  }

  incrementMessageCount(): void {
    this.messageCount++;
  }

  getStats(): {
    connectedClients: number;
    activeRooms: number;
    totalMessages: number;
    uptimeSeconds: number;
    messagesPerSecond: number;
  } {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
      totalMessages: this.messageCount,
      uptimeSeconds,
      messagesPerSecond:
        uptimeSeconds > 0
          ? Math.round((this.messageCount / uptimeSeconds) * 100) / 100
          : 0,
    };
  }

  isValidChannel(channel: string): channel is Channel {
    return (VALID_CHANNELS as readonly string[]).includes(channel);
  }
}
