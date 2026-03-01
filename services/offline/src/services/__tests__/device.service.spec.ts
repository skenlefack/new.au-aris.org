import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceService } from '../device.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const DEVICE_ID = 'device-android-001';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    deviceRegistry: {
      upsert: vi.fn().mockImplementation(async ({ create }: any) => ({
        id: '00000000-0000-0000-0000-000000000050',
        device_id: create.device_id,
        user_id: create.user_id,
        tenant_id: create.tenant_id,
        platform: create.platform,
        app_version: create.app_version,
        last_sync_at: null,
        is_active: true,
        registered_at: new Date(),
      })),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      ...overrides,
    },
  } as any;
}

describe('DeviceService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: DeviceService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new DeviceService(prisma);
  });

  describe('register', () => {
    it('should register a new device', async () => {
      const result = await service.register(
        { deviceId: DEVICE_ID, platform: 'android', appVersion: '1.0.0' },
        USER_ID,
        TENANT_ID,
      );

      expect(result.deviceId).toBe(DEVICE_ID);
      expect(result.platform).toBe('android');
      expect(result.isActive).toBe(true);
      expect(prisma.deviceRegistry.upsert).toHaveBeenCalledOnce();
    });

    it('should upsert on re-registration', async () => {
      await service.register(
        { deviceId: DEVICE_ID, platform: 'android', appVersion: '2.0.0' },
        USER_ID,
        TENANT_ID,
      );

      expect(prisma.deviceRegistry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { device_id: DEVICE_ID },
          update: expect.objectContaining({ app_version: '2.0.0' }),
        }),
      );
    });
  });

  describe('getDevice', () => {
    it('should return device info', async () => {
      prisma.deviceRegistry.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000050',
        device_id: DEVICE_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        platform: 'android',
        app_version: '1.0.0',
        last_sync_at: null,
        is_active: true,
        registered_at: new Date(),
      });

      const result = await service.getDevice(DEVICE_ID, TENANT_ID);

      expect(result.deviceId).toBe(DEVICE_ID);
      expect(result.platform).toBe('android');
    });

    it('should throw 404 for unknown device', async () => {
      await expect(
        service.getDevice('missing', TENANT_ID),
      ).rejects.toThrow(/not found/);
    });

    it('should throw 403 for different tenant', async () => {
      prisma.deviceRegistry.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000050',
        device_id: DEVICE_ID,
        tenant_id: 'other-tenant',
      });

      await expect(
        service.getDevice(DEVICE_ID, TENANT_ID),
      ).rejects.toThrow(/different tenant/);
    });
  });

  describe('updateLastSync', () => {
    it('should update last_sync_at', async () => {
      await service.updateLastSync(DEVICE_ID, { sessionId: 'sess-1' });

      expect(prisma.deviceRegistry.update).toHaveBeenCalledWith({
        where: { device_id: DEVICE_ID },
        data: expect.objectContaining({
          last_sync_at: expect.any(Date),
        }),
      });
    });

    it('should not throw if device is not registered', async () => {
      prisma.deviceRegistry.update.mockRejectedValue(new Error('Not found'));

      // Should not throw
      await service.updateLastSync('missing-device', {});
    });
  });
});
