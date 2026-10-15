import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { TenantLevel, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  EnrollDeviceInput,
  HeartbeatInput,
  AcknowledgeCommandInput,
  SendCommandInput,
  CreateReleaseInput,
  UpdateReleaseInput,
  ListDevicesQueryInput,
} from '../schemas/mdm.schemas.js';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

const COMMAND_EXPIRY_DAYS = 7;

export class MdmService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Device enrollment (mobile calls this) ──
  async enroll(dto: EnrollDeviceInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).mdmDevice.findUnique({
      where: { hardwareId: dto.hardwareId },
    });

    if (existing) {
      // Re-enroll: update device info, keep same token if same user
      const updated = await (this.prisma as any).mdmDevice.update({
        where: { id: existing.id },
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          deviceName: dto.deviceName,
          deviceModel: dto.deviceModel,
          manufacturer: dto.manufacturer ?? '',
          osVersion: dto.osVersion,
          appVersion: dto.appVersion,
          screenResolution: dto.screenResolution ?? null,
          totalStorageMb: dto.totalStorageMb ?? null,
          totalRamMb: dto.totalRamMb ?? null,
          status: 'ACTIVE',
        },
      });
      return { data: updated };
    }

    // New enrollment
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const device = await (this.prisma as any).mdmDevice.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        deviceToken,
        hardwareId: dto.hardwareId,
        deviceName: dto.deviceName,
        deviceModel: dto.deviceModel,
        manufacturer: dto.manufacturer ?? '',
        osVersion: dto.osVersion,
        appVersion: dto.appVersion,
        screenResolution: dto.screenResolution ?? null,
        totalStorageMb: dto.totalStorageMb ?? null,
        totalRamMb: dto.totalRamMb ?? null,
      },
    });
    return { data: device };
  }

  // ── Heartbeat (mobile calls this every 5 min) ──
  async heartbeat(dto: HeartbeatInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({
      where: { deviceToken: dto.deviceToken },
    });
    if (!device) throw new HttpError(404, 'Device not found');
    if (device.userId !== user.userId) throw new HttpError(403, 'Device does not belong to this user');

    const now = new Date();

    // Update dynamic fields on device
    await (this.prisma as any).mdmDevice.update({
      where: { id: device.id },
      data: {
        batteryLevel: dto.batteryLevel ?? device.batteryLevel,
        isCharging: dto.isCharging ?? device.isCharging,
        networkType: dto.networkType ?? device.networkType,
        storageFreeMb: dto.storageFreeMb ?? device.storageFreeMb,
        appVersion: dto.appVersion ?? device.appVersion,
        pendingSyncItems: dto.pendingSyncItems ?? device.pendingSyncItems,
        lastSyncAt: dto.lastSyncAt ? new Date(dto.lastSyncAt) : device.lastSyncAt,
        lastLocation: dto.location ?? device.lastLocation,
        lastHeartbeatAt: now,
      },
    });

    // Log heartbeat
    await (this.prisma as any).mdmHeartbeat.create({
      data: {
        deviceId: device.id,
        batteryLevel: dto.batteryLevel ?? null,
        isCharging: dto.isCharging ?? false,
        networkType: dto.networkType ?? null,
        storageFreeMb: dto.storageFreeMb ?? null,
        appVersion: dto.appVersion ?? null,
        pendingSyncItems: dto.pendingSyncItems ?? 0,
        location: dto.location ?? null,
      },
    });

    // Fetch pending commands (not expired)
    const pendingCommands = await (this.prisma as any).mdmCommand.findMany({
      where: {
        deviceId: device.id,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { issuedAt: 'asc' },
    });

    // Mark pending commands as DELIVERED
    if (pendingCommands.length > 0) {
      const ids = pendingCommands.map((c: any) => c.id);
      await (this.prisma as any).mdmCommand.updateMany({
        where: { id: { in: ids } },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
    }

    // Check for app update
    const currentVersionCode = parseInt(device.appVersion, 10) || 0;
    const update = await this.checkVersion(currentVersionCode, device.id);

    return {
      data: {
        commands: pendingCommands,
        update: update ?? undefined,
      },
    };
  }

  // ── Command acknowledgment (mobile calls this) ──
  async acknowledgeCommand(commandId: string, dto: AcknowledgeCommandInput): Promise<ApiResponse<{ acknowledged: boolean }>> {
    const command = await (this.prisma as any).mdmCommand.findUnique({
      where: { id: commandId },
    });
    if (!command) throw new HttpError(404, 'Command not found');

    await (this.prisma as any).mdmCommand.update({
      where: { id: commandId },
      data: {
        status: dto.status,
        result: dto.result ?? null,
        executedAt: new Date(),
      },
    });

    return { data: { acknowledged: true } };
  }

  // ── Admin: list devices ──
  async listDevices(user: AuthenticatedUser, query: ListDevicesQueryInput): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : { enrolledAt: 'desc' as const };

    const where: Record<string, unknown> = { ...this.buildTenantFilter(user) };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const q = query.search;
      (where as any).OR = [
        { deviceName: { contains: q, mode: 'insensitive' } },
        { deviceModel: { contains: q, mode: 'insensitive' } },
        { hardwareId: { contains: q, mode: 'insensitive' } },
        { user: { OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ] } },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).mdmDevice.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).mdmDevice.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ── Admin: get device detail ──
  async getDevice(id: string): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        commands: {
          orderBy: { issuedAt: 'desc' },
          take: 50,
        },
        heartbeats: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!device) throw new HttpError(404, 'Device not found');
    return { data: device };
  }

  // ── Admin: send command ──
  async sendCommand(deviceId: string, dto: SendCommandInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new HttpError(404, 'Device not found');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + COMMAND_EXPIRY_DAYS);

    const command = await (this.prisma as any).mdmCommand.create({
      data: {
        deviceId,
        type: dto.type,
        payload: dto.payload ?? {},
        issuedBy: user.userId,
        expiresAt,
      },
    });

    return { data: command };
  }

  // ── Admin: list releases ──
  async listReleases(user: AuthenticatedUser): Promise<ApiResponse<any[]>> {
    const where: Record<string, unknown> = {};
    // Continental sees all, otherwise filter by tenant
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where.tenantId = user.tenantId;
    }

    const releases = await (this.prisma as any).mdmAppRelease.findMany({
      where,
      orderBy: { versionCode: 'desc' },
    });
    return { data: releases };
  }

  // ── Admin: create release ──
  async createRelease(dto: CreateReleaseInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const release = await (this.prisma as any).mdmAppRelease.create({
      data: {
        tenantId: user.tenantId,
        versionName: dto.versionName,
        versionCode: dto.versionCode,
        releaseNotes: dto.releaseNotes ?? null,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        fileSha256: dto.fileSha256,
        fileUrl: dto.fileUrl,
        packageName: dto.packageName ?? 'org.auibar.aris',
        isRequired: dto.isRequired ?? false,
        targetDevices: dto.targetDevices ?? null,
        publishedBy: user.userId,
      },
    });
    return { data: release };
  }

  // ── Admin: update release ──
  async updateRelease(id: string, dto: UpdateReleaseInput): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).mdmAppRelease.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Release not found');

    const updateData: Record<string, unknown> = {};
    if (dto.releaseNotes !== undefined) updateData.releaseNotes = dto.releaseNotes;
    if (dto.isRequired !== undefined) updateData.isRequired = dto.isRequired;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.targetDevices !== undefined) updateData.targetDevices = dto.targetDevices;

    const release = await (this.prisma as any).mdmAppRelease.update({
      where: { id },
      data: updateData,
    });
    return { data: release };
  }

  // ── Admin: delete release ──
  async deleteRelease(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const existing = await (this.prisma as any).mdmAppRelease.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Release not found');

    await (this.prisma as any).mdmAppRelease.delete({ where: { id } });
    return { data: { deleted: true } };
  }

  // ── Version check (mobile calls this) ──
  async checkVersion(currentVersionCode: number, deviceId?: string): Promise<any | null> {
    const where: Record<string, unknown> = {
      isActive: true,
      versionCode: { gt: currentVersionCode },
    };

    const release = await (this.prisma as any).mdmAppRelease.findFirst({
      where,
      orderBy: { versionCode: 'desc' },
    });

    if (!release) return null;

    // If targetDevices is set, check if this device is targeted
    if (release.targetDevices && Array.isArray(release.targetDevices) && deviceId) {
      if (!release.targetDevices.includes(deviceId)) return null;
    }

    return release;
  }

  private buildTenantFilter(caller: AuthenticatedUser): Record<string, unknown> {
    switch (caller.tenantLevel) {
      case TenantLevel.CONTINENTAL: return {};
      case TenantLevel.REC: return {
        OR: [
          { tenantId: caller.tenantId },
          { user: { tenant: { parentId: caller.tenantId } } },
        ],
      };
      case TenantLevel.MEMBER_STATE: return { tenantId: caller.tenantId };
      default: return { tenantId: caller.tenantId };
    }
  }
}
