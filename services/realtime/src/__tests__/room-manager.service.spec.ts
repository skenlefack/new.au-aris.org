import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManagerService, ROOM_PREFIX, VALID_CHANNELS } from '../services/room-manager.service';

describe('RoomManagerService', () => {
  let service: RoomManagerService;

  const makeClient = (overrides: Partial<Parameters<RoomManagerService['registerClient']>[0]> = {}) => ({
    socketId: overrides.socketId ?? 'socket-1',
    userId: overrides.userId ?? 'user-1',
    email: overrides.email ?? 'user@test.com',
    tenantId: overrides.tenantId ?? 'tenant-ke',
    tenantLevel: overrides.tenantLevel ?? ('MEMBER_STATE' as any),
    role: overrides.role ?? 'NATIONAL_ADMIN',
    connectedAt: new Date(),
    rooms: new Set<string>(),
    lastHeartbeat: Date.now(),
  });

  beforeEach(() => {
    service = new RoomManagerService();
  });

  describe('registerClient / unregisterClient', () => {
    it('registers a client and auto-joins tenant room', () => {
      service.registerClient(makeClient());
      const client = service.getClient('socket-1');
      expect(client).toBeDefined();
      expect(client!.rooms.has('tenant:tenant-ke')).toBe(true);
    });

    it('unregisters and leaves all rooms', () => {
      service.registerClient(makeClient());
      service.joinRoom('socket-1', 'room:campaign:c1');
      service.unregisterClient('socket-1');
      expect(service.getClient('socket-1')).toBeUndefined();
      expect(service.getRoomMemberCount('room:campaign:c1')).toBe(0);
    });
  });

  describe('joinRoom / leaveRoom', () => {
    it('joins and counts members correctly', () => {
      service.registerClient(makeClient({ socketId: 's1' }));
      service.registerClient(makeClient({ socketId: 's2', userId: 'u2' }));
      service.joinRoom('s1', 'room:campaign:c1');
      service.joinRoom('s2', 'room:campaign:c1');
      expect(service.getRoomMemberCount('room:campaign:c1')).toBe(2);
    });

    it('leaves a room and cleans up empty rooms', () => {
      service.registerClient(makeClient());
      service.joinRoom('socket-1', 'room:campaign:c1');
      service.leaveRoom('socket-1', 'room:campaign:c1');
      expect(service.getRoomMemberCount('room:campaign:c1')).toBe(0);
    });

    it('returns false for unknown socket', () => {
      expect(service.joinRoom('unknown', 'room:campaign:c1')).toBe(false);
      expect(service.leaveRoom('unknown', 'room:campaign:c1')).toBe(false);
    });
  });

  describe('isValidHierarchicalRoom', () => {
    it('validates known room patterns', () => {
      expect(service.isValidHierarchicalRoom(ROOM_PREFIX.CONTINENTAL)).toBe(true);
      expect(service.isValidHierarchicalRoom('room:rec:IGAD')).toBe(true);
      expect(service.isValidHierarchicalRoom('room:country:KE')).toBe(true);
      expect(service.isValidHierarchicalRoom('room:campaign:uuid-123')).toBe(true);
      expect(service.isValidHierarchicalRoom('room:alert:alert-1')).toBe(true);
    });

    it('rejects invalid room patterns', () => {
      expect(service.isValidHierarchicalRoom('invalid')).toBe(false);
      expect(service.isValidHierarchicalRoom('tenant:abc')).toBe(false);
      expect(service.isValidHierarchicalRoom('outbreaks:ke')).toBe(false);
    });
  });

  describe('authorizeRoom', () => {
    it('allows SUPER_ADMIN to join continental room', () => {
      service.registerClient(makeClient({ role: 'SUPER_ADMIN', tenantLevel: 'CONTINENTAL' as any }));
      const result = service.authorizeRoom('socket-1', ROOM_PREFIX.CONTINENTAL);
      expect(result.authorized).toBe(true);
    });

    it('allows CONTINENTAL_ADMIN to join continental room', () => {
      service.registerClient(makeClient({ role: 'CONTINENTAL_ADMIN', tenantLevel: 'CONTINENTAL' as any }));
      const result = service.authorizeRoom('socket-1', ROOM_PREFIX.CONTINENTAL);
      expect(result.authorized).toBe(true);
    });

    it('rejects NATIONAL_ADMIN from continental room', () => {
      service.registerClient(makeClient({ role: 'NATIONAL_ADMIN' }));
      const result = service.authorizeRoom('socket-1', ROOM_PREFIX.CONTINENTAL);
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('SUPER_ADMIN');
    });

    it('allows REC_ADMIN to join REC room', () => {
      service.registerClient(makeClient({ role: 'REC_ADMIN', tenantLevel: 'REC' as any }));
      const result = service.authorizeRoom('socket-1', 'room:rec:IGAD');
      expect(result.authorized).toBe(true);
    });

    it('rejects NATIONAL_ADMIN from REC room', () => {
      service.registerClient(makeClient({ role: 'NATIONAL_ADMIN' }));
      const result = service.authorizeRoom('socket-1', 'room:rec:IGAD');
      expect(result.authorized).toBe(false);
    });

    it('allows SUPER_ADMIN to join any REC room', () => {
      service.registerClient(makeClient({ role: 'SUPER_ADMIN', tenantLevel: 'CONTINENTAL' as any }));
      const result = service.authorizeRoom('socket-1', 'room:rec:ECOWAS');
      expect(result.authorized).toBe(true);
    });

    it('allows any authenticated user to join country room', () => {
      service.registerClient(makeClient({ role: 'FIELD_AGENT' }));
      const result = service.authorizeRoom('socket-1', 'room:country:KE');
      expect(result.authorized).toBe(true);
    });

    it('allows any authenticated user to join campaign room', () => {
      service.registerClient(makeClient({ role: 'ANALYST' }));
      const result = service.authorizeRoom('socket-1', 'room:campaign:uuid-1');
      expect(result.authorized).toBe(true);
    });

    it('allows any authenticated user to join alert room', () => {
      service.registerClient(makeClient({ role: 'DATA_STEWARD' }));
      const result = service.authorizeRoom('socket-1', 'room:alert:alert-1');
      expect(result.authorized).toBe(true);
    });

    it('rejects unknown room format', () => {
      service.registerClient(makeClient());
      const result = service.authorizeRoom('socket-1', 'unknown:format');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Unknown room format');
    });

    it('rejects unregistered client', () => {
      const result = service.authorizeRoom('unknown-socket', ROOM_PREFIX.CONTINENTAL);
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('not registered');
    });
  });

  describe('heartbeat', () => {
    it('updates heartbeat timestamp', () => {
      service.registerClient(makeClient());
      const before = service.getClient('socket-1')!.lastHeartbeat;
      // Advance time slightly
      service.updateHeartbeat('socket-1');
      const after = service.getClient('socket-1')!.lastHeartbeat;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('detects stale clients', () => {
      const client = makeClient();
      client.lastHeartbeat = Date.now() - 100_000; // 100s ago
      service.registerClient(client);
      const stale = service.getStaleClients(90_000); // 90s timeout
      expect(stale).toContain('socket-1');
    });

    it('excludes active clients from stale list', () => {
      service.registerClient(makeClient());
      const stale = service.getStaleClients(90_000);
      expect(stale).not.toContain('socket-1');
    });
  });

  describe('legacy channels', () => {
    it('validates known channels', () => {
      for (const ch of VALID_CHANNELS) {
        expect(service.isValidChannel(ch)).toBe(true);
      }
      expect(service.isValidChannel('invalid-channel')).toBe(false);
    });

    it('subscribes to channel with tenant scoping', () => {
      service.registerClient(makeClient());
      const room = service.subscribeToChannel('socket-1', 'outbreaks');
      expect(room).toBe('outbreaks:tenant-ke');
      expect(service.getClient('socket-1')!.rooms.has('outbreaks:tenant-ke')).toBe(true);
    });

    it('unsubscribes from channel', () => {
      service.registerClient(makeClient());
      service.subscribeToChannel('socket-1', 'workflow');
      const room = service.unsubscribeFromChannel('socket-1', 'workflow');
      expect(room).toBe('workflow:tenant-ke');
    });

    it('subscribes to user-specific room', () => {
      service.registerClient(makeClient());
      const room = service.subscribeToUserRoom('socket-1', 'notifications');
      expect(room).toBe('notifications:user-1');
    });
  });

  describe('queries', () => {
    it('getClientsByTenant returns matching clients', () => {
      service.registerClient(makeClient({ socketId: 's1', tenantId: 'ke' }));
      service.registerClient(makeClient({ socketId: 's2', userId: 'u2', tenantId: 'ke' }));
      service.registerClient(makeClient({ socketId: 's3', userId: 'u3', tenantId: 'ng' }));
      const keClients = service.getClientsByTenant('ke');
      expect(keClients).toHaveLength(2);
    });

    it('getClientByUserId finds the right client', () => {
      service.registerClient(makeClient({ socketId: 's1', userId: 'target-user' }));
      const client = service.getClientByUserId('target-user');
      expect(client).toBeDefined();
      expect(client!.socketId).toBe('s1');
    });

    it('getAllRooms returns stats', () => {
      service.registerClient(makeClient());
      service.joinRoom('socket-1', 'room:campaign:c1');
      const rooms = service.getAllRooms();
      expect(rooms.length).toBeGreaterThanOrEqual(2); // tenant room + campaign
      expect(rooms.find((r) => r.name === 'room:campaign:c1')?.clientCount).toBe(1);
    });

    it('getStats returns throughput data', () => {
      service.registerClient(makeClient());
      service.incrementMessageCount();
      service.incrementMessageCount();
      const stats = service.getStats();
      expect(stats.connectedClients).toBe(1);
      expect(stats.totalMessages).toBe(2);
      expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
