/**
 * Device Service — Manages device registration and lookup for offline sync.
 */

import type { PrismaClient } from '@prisma/client';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface DeviceInfo {
  id: string;
  deviceId: string;
  userId: string;
  tenantId: string;
  platform: string;
  appVersion: string;
  lastSyncAt: string | null;
  isActive: boolean;
  registeredAt: string;
}

export class DeviceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register or update a device for a user/tenant.
   * Uses upsert — re-registering updates platform/version.
   */
  async register(
    dto: { deviceId: string; platform: string; appVersion: string },
    userId: string,
    tenantId: string,
  ): Promise<DeviceInfo> {
    const device = await (this.prisma as any).deviceRegistry.upsert({
      where: { device_id: dto.deviceId },
      create: {
        device_id: dto.deviceId,
        user_id: userId,
        tenant_id: tenantId,
        platform: dto.platform,
        app_version: dto.appVersion,
      },
      update: {
        user_id: userId,
        tenant_id: tenantId,
        platform: dto.platform,
        app_version: dto.appVersion,
        is_active: true,
      },
    });

    return this.toDeviceInfo(device);
  }

  /**
   * Get device info by deviceId. Verifies tenant ownership.
   */
  async getDevice(deviceId: string, tenantId: string): Promise<DeviceInfo> {
    const device = await (this.prisma as any).deviceRegistry.findUnique({
      where: { device_id: deviceId },
    });

    if (!device) {
      throw new HttpError(404, `Device ${deviceId} not found`);
    }

    if (device.tenant_id !== tenantId) {
      throw new HttpError(403, 'Device belongs to a different tenant');
    }

    return this.toDeviceInfo(device);
  }

  /**
   * Update last_sync_at and last_known_offset when a session completes.
   */
  async updateLastSync(
    deviceId: string,
    offset: Record<string, unknown>,
  ): Promise<void> {
    try {
      await (this.prisma as any).deviceRegistry.update({
        where: { device_id: deviceId },
        data: {
          last_sync_at: new Date(),
          last_known_offset: offset as any,
        },
      });
    } catch {
      // Device may not be registered yet — silently skip
    }
  }

  private toDeviceInfo(device: any): DeviceInfo {
    return {
      id: device.id,
      deviceId: device.device_id,
      userId: device.user_id,
      tenantId: device.tenant_id,
      platform: device.platform,
      appVersion: device.app_version,
      lastSyncAt: device.last_sync_at ? device.last_sync_at.toISOString() : null,
      isActive: device.is_active,
      registeredAt: device.registered_at.toISOString(),
    };
  }
}
