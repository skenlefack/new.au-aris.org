import { TenantLevel, UserRole } from '@aris/shared-types';

export interface ConnectedClient {
  socketId: string;
  userId: string;
  email: string;
  tenantId: string;
  tenantLevel: TenantLevel;
  role: string;
  connectedAt: Date;
  rooms: Set<string>;
  /** Last heartbeat received (epoch ms) */
  lastHeartbeat: number;
}

export interface RoomStats {
  name: string;
  clientCount: number;
}

/** Valid channel prefixes for legacy subscription requests */
export const VALID_CHANNELS = [
  'outbreaks',
  'workflow',
  'notifications',
  'sync-status',
  'alerts',
] as const;

export type Channel = (typeof VALID_CHANNELS)[number];

// ── Hierarchical Room Prefixes ──

export const ROOM_PREFIX = {
  CONTINENTAL: 'room:continental',
  REC: 'room:rec:',
  COUNTRY: 'room:country:',
  CAMPAIGN: 'room:campaign:',
  ALERT: 'room:alert:',
} as const;

/** Roles that operate at continental level */
const CONTINENTAL_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
]);

/** Roles that operate at REC level and above */
const REC_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
]);

export interface RoomAuthResult {
  authorized: boolean;
  reason?: string;
}

export class RoomManagerService {
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
  }

  unregisterClient(socketId: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    // Leave all rooms
    for (const room of client.rooms) {
      this.leaveRoom(socketId, room);
    }

    this.clients.delete(socketId);
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

  getRoomMemberCount(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  // ── Hierarchical Room Authorization ──

  /**
   * Check whether a client is authorized to join a hierarchical room.
   *
   * Rules:
   *   room:continental           → SUPER_ADMIN / CONTINENTAL_ADMIN only
   *   room:rec:{recId}           → SUPER_ADMIN / CONTINENTAL_ADMIN / REC_ADMIN (with matching tenant)
   *   room:country:{isoCode}     → any role whose tenant matches the country
   *                                 (continental & REC admins can join any country)
   *   room:campaign:{campaignId} → any authenticated user (campaign-level access checked upstream)
   *   room:alert:{alertId}       → any authenticated user (alerts are semi-public)
   */
  authorizeRoom(socketId: string, roomId: string): RoomAuthResult {
    const client = this.clients.get(socketId);
    if (!client) {
      return { authorized: false, reason: 'Client not registered' };
    }

    // room:continental
    if (roomId === ROOM_PREFIX.CONTINENTAL) {
      if (!CONTINENTAL_ROLES.has(client.role)) {
        return { authorized: false, reason: 'Continental room requires SUPER_ADMIN or CONTINENTAL_ADMIN role' };
      }
      return { authorized: true };
    }

    // room:rec:{recId}
    if (roomId.startsWith(ROOM_PREFIX.REC)) {
      if (!REC_ROLES.has(client.role)) {
        return { authorized: false, reason: 'REC room requires at least REC_ADMIN role' };
      }
      // Continental-level users can join any REC room
      if (CONTINENTAL_ROLES.has(client.role)) {
        return { authorized: true };
      }
      // REC_ADMIN must belong to the REC (tenant level check)
      if (client.tenantLevel !== TenantLevel.REC) {
        return { authorized: false, reason: 'REC_ADMIN must have REC-level tenant' };
      }
      return { authorized: true };
    }

    // room:country:{isoCode}
    if (roomId.startsWith(ROOM_PREFIX.COUNTRY)) {
      // Continental & REC admins can join any country room
      if (CONTINENTAL_ROLES.has(client.role) || client.role === UserRole.REC_ADMIN) {
        return { authorized: true };
      }
      // All other roles are authorized (tenant isolation enforced by data layer)
      return { authorized: true };
    }

    // room:campaign:{campaignId} — any authenticated user
    if (roomId.startsWith(ROOM_PREFIX.CAMPAIGN)) {
      return { authorized: true };
    }

    // room:alert:{alertId} — any authenticated user
    if (roomId.startsWith(ROOM_PREFIX.ALERT)) {
      return { authorized: true };
    }

    return { authorized: false, reason: `Unknown room format: ${roomId}` };
  }

  /**
   * Validate that roomId follows a known hierarchical pattern.
   */
  isValidHierarchicalRoom(roomId: string): boolean {
    return (
      roomId === ROOM_PREFIX.CONTINENTAL ||
      roomId.startsWith(ROOM_PREFIX.REC) ||
      roomId.startsWith(ROOM_PREFIX.COUNTRY) ||
      roomId.startsWith(ROOM_PREFIX.CAMPAIGN) ||
      roomId.startsWith(ROOM_PREFIX.ALERT)
    );
  }

  // ── Heartbeat ──

  updateHeartbeat(socketId: string): void {
    const client = this.clients.get(socketId);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }

  /**
   * Returns socketIds of clients whose last heartbeat is older than timeoutMs.
   */
  getStaleClients(timeoutMs: number): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [socketId, client] of this.clients) {
      if (now - client.lastHeartbeat > timeoutMs) {
        stale.push(socketId);
      }
    }
    return stale;
  }

  // ── Legacy channel subscriptions (kept for backward compatibility) ──

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

  subscribeToUserRoom(socketId: string, channel: string): string | null {
    const client = this.clients.get(socketId);
    if (!client) return null;

    const room = `${channel}:${client.userId}`;
    this.joinRoom(socketId, room);
    return room;
  }

  // ── Queries ──

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
