import { describe, it, expect, beforeEach } from 'vitest';
import { TenantLevel } from '@aris/shared-types';
import { RoomManagerService } from './room-manager.service';
import type { ConnectedClient } from './room-manager.service';

function makeClient(
  overrides: Partial<ConnectedClient> = {},
): ConnectedClient {
  return {
    socketId: 'socket-1',
    userId: 'user-1',
    email: 'test@aris.africa',
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    role: 'DATA_STEWARD',
    connectedAt: new Date(),
    rooms: new Set(),
    ...overrides,
  };
}

describe('RoomManagerService', () => {
  let service: RoomManagerService;

  beforeEach(() => {
    service = new RoomManagerService();
  });

  // ── Registration ──

  describe('registerClient / unregisterClient', () => {
    it('should register a client and auto-join tenant room', () => {
      service.registerClient(makeClient());

      const client = service.getClient('socket-1');
      expect(client).toBeDefined();
      expect(client!.userId).toBe('user-1');

      // Auto-joined tenant room
      const tenantClients = service.getClientsInRoom('tenant:tenant-ke');
      expect(tenantClients).toContain('socket-1');
    });

    it('should unregister a client and leave all rooms', () => {
      service.registerClient(makeClient());
      service.joinRoom('socket-1', 'outbreaks:tenant-ke');

      service.unregisterClient('socket-1');

      expect(service.getClient('socket-1')).toBeUndefined();
      expect(service.getClientsInRoom('tenant:tenant-ke')).toHaveLength(0);
      expect(service.getClientsInRoom('outbreaks:tenant-ke')).toHaveLength(0);
    });

    it('should handle unregistering an unknown socket gracefully', () => {
      expect(() => service.unregisterClient('unknown')).not.toThrow();
    });
  });

  // ── Room Join / Leave ──

  describe('joinRoom / leaveRoom', () => {
    it('should join a room and track membership', () => {
      service.registerClient(makeClient());
      const joined = service.joinRoom('socket-1', 'workflow:tenant-ke');

      expect(joined).toBe(true);
      expect(service.getClientsInRoom('workflow:tenant-ke')).toContain(
        'socket-1',
      );
    });

    it('should leave a room and clean up empty rooms', () => {
      service.registerClient(makeClient());
      service.joinRoom('socket-1', 'workflow:tenant-ke');

      const left = service.leaveRoom('socket-1', 'workflow:tenant-ke');

      expect(left).toBe(true);
      expect(service.getClientsInRoom('workflow:tenant-ke')).toHaveLength(0);

      // Room should be removed from the internal map
      const rooms = service.getAllRooms();
      const workflowRoom = rooms.find(
        (r) => r.name === 'workflow:tenant-ke',
      );
      expect(workflowRoom).toBeUndefined();
    });

    it('should return false when joining with unknown socket', () => {
      expect(service.joinRoom('unknown', 'some-room')).toBe(false);
    });

    it('should return false when leaving with unknown socket', () => {
      expect(service.leaveRoom('unknown', 'some-room')).toBe(false);
    });
  });

  // ── Channel Subscriptions ──

  describe('subscribeToChannel / unsubscribeFromChannel', () => {
    it('should subscribe to a channel scoped to tenant', () => {
      service.registerClient(makeClient());
      const room = service.subscribeToChannel('socket-1', 'outbreaks');

      expect(room).toBe('outbreaks:tenant-ke');
      expect(service.getClientsInRoom('outbreaks:tenant-ke')).toContain(
        'socket-1',
      );
    });

    it('should unsubscribe from a channel', () => {
      service.registerClient(makeClient());
      service.subscribeToChannel('socket-1', 'outbreaks');

      const room = service.unsubscribeFromChannel('socket-1', 'outbreaks');

      expect(room).toBe('outbreaks:tenant-ke');
      expect(service.getClientsInRoom('outbreaks:tenant-ke')).toHaveLength(0);
    });

    it('should return null for unknown socket', () => {
      expect(service.subscribeToChannel('unknown', 'outbreaks')).toBeNull();
    });
  });

  // ── User Room ──

  describe('subscribeToUserRoom', () => {
    it('should subscribe to a user-specific room', () => {
      service.registerClient(makeClient());
      const room = service.subscribeToUserRoom('socket-1', 'notifications');

      expect(room).toBe('notifications:user-1');
      expect(service.getClientsInRoom('notifications:user-1')).toContain(
        'socket-1',
      );
    });
  });

  // ── Queries ──

  describe('getClientsByTenant', () => {
    it('should return all clients for a given tenant', () => {
      service.registerClient(makeClient({ socketId: 'socket-1', userId: 'user-1' }));
      service.registerClient(
        makeClient({ socketId: 'socket-2', userId: 'user-2', tenantId: 'tenant-ke' }),
      );
      service.registerClient(
        makeClient({ socketId: 'socket-3', userId: 'user-3', tenantId: 'tenant-ng' }),
      );

      const keClients = service.getClientsByTenant('tenant-ke');
      expect(keClients).toHaveLength(2);

      const ngClients = service.getClientsByTenant('tenant-ng');
      expect(ngClients).toHaveLength(1);
    });
  });

  describe('getClientByUserId', () => {
    it('should find a client by user ID', () => {
      service.registerClient(makeClient());
      const client = service.getClientByUserId('user-1');
      expect(client).toBeDefined();
      expect(client!.socketId).toBe('socket-1');
    });

    it('should return undefined for unknown user', () => {
      expect(service.getClientByUserId('unknown')).toBeUndefined();
    });
  });

  // ── Channel Validation ──

  describe('isValidChannel', () => {
    it('should accept valid channels', () => {
      expect(service.isValidChannel('outbreaks')).toBe(true);
      expect(service.isValidChannel('workflow')).toBe(true);
      expect(service.isValidChannel('notifications')).toBe(true);
      expect(service.isValidChannel('sync-status')).toBe(true);
      expect(service.isValidChannel('alerts')).toBe(true);
    });

    it('should reject invalid channels', () => {
      expect(service.isValidChannel('invalid')).toBe(false);
      expect(service.isValidChannel('')).toBe(false);
      expect(service.isValidChannel('admin')).toBe(false);
    });
  });

  // ── Stats ──

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.registerClient(makeClient({ socketId: 'socket-1' }));
      service.registerClient(
        makeClient({ socketId: 'socket-2', userId: 'user-2' }),
      );
      service.incrementMessageCount();
      service.incrementMessageCount();

      const stats = service.getStats();

      expect(stats.connectedClients).toBe(2);
      expect(stats.activeRooms).toBeGreaterThan(0); // At least tenant rooms
      expect(stats.totalMessages).toBe(2);
      expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllRooms', () => {
    it('should return all rooms with client counts', () => {
      service.registerClient(makeClient({ socketId: 'socket-1' }));
      service.subscribeToChannel('socket-1', 'outbreaks');
      service.subscribeToChannel('socket-1', 'workflow');

      const rooms = service.getAllRooms();

      expect(rooms.length).toBeGreaterThanOrEqual(3); // tenant + outbreaks + workflow
      const outbreaks = rooms.find((r) => r.name === 'outbreaks:tenant-ke');
      expect(outbreaks).toBeDefined();
      expect(outbreaks!.clientCount).toBe(1);
    });
  });

  // ── Multiple clients in same room ──

  describe('multi-client rooms', () => {
    it('should track multiple clients in the same room', () => {
      service.registerClient(
        makeClient({ socketId: 'socket-1', userId: 'user-1' }),
      );
      service.registerClient(
        makeClient({ socketId: 'socket-2', userId: 'user-2' }),
      );
      service.subscribeToChannel('socket-1', 'outbreaks');
      service.subscribeToChannel('socket-2', 'outbreaks');

      const members = service.getClientsInRoom('outbreaks:tenant-ke');
      expect(members).toHaveLength(2);
      expect(members).toContain('socket-1');
      expect(members).toContain('socket-2');
    });

    it('should not delete room when one client leaves but another stays', () => {
      service.registerClient(
        makeClient({ socketId: 'socket-1', userId: 'user-1' }),
      );
      service.registerClient(
        makeClient({ socketId: 'socket-2', userId: 'user-2' }),
      );
      service.subscribeToChannel('socket-1', 'outbreaks');
      service.subscribeToChannel('socket-2', 'outbreaks');

      service.unsubscribeFromChannel('socket-1', 'outbreaks');

      const members = service.getClientsInRoom('outbreaks:tenant-ke');
      expect(members).toHaveLength(1);
      expect(members).toContain('socket-2');
    });
  });
});
