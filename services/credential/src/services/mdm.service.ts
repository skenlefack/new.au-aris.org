import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyKafka } from '@aris/kafka-client';
import {
  TenantLevel, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT,
  TOPIC_SYS_CREDENTIAL_MDM_DEVICE_ENROLLED,
  TOPIC_SYS_CREDENTIAL_MDM_HEARTBEAT_RECEIVED,
  TOPIC_SYS_CREDENTIAL_MDM_COMMAND_ISSUED,
  TOPIC_SYS_CREDENTIAL_MDM_COMMAND_EXECUTED,
  TOPIC_SYS_CREDENTIAL_MDM_RELEASE_PUBLISHED,
  TOPIC_SYS_CREDENTIAL_MDM_ALERT_TRIGGERED,
} from '@aris/shared-types';
import type { PaginatedResponse, ApiResponse, KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  EnrollDeviceInput,
  HeartbeatInput,
  AcknowledgeCommandInput,
  SendCommandInput,
  CreateReleaseInput,
  UpdateReleaseInput,
  ListDevicesQueryInput,
  LocationHistoryQueryInput,
  CreatePolicyInput,
  UpdatePolicyInput,
  EnrollmentSettingsInput,
  UpdateProgressInput,
} from '../schemas/mdm.schemas.js';
import type { MdmAlertEngine } from './mdm-alert.engine.js';
import type { MdmComplianceEngine } from './mdm-compliance.engine.js';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

const COMMAND_EXPIRY_DAYS = 7;

export class MdmService {
  private heartbeatCounter = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: FastifyKafka,
    private readonly alertEngine: MdmAlertEngine,
    private readonly complianceEngine: MdmComplianceEngine,
  ) {}

  // ── Fire-and-forget Kafka publish ──
  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: crypto.randomUUID(), sourceService: 'credential', tenantId, userId,
      schemaVersion: '1', timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }

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
      this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_DEVICE_ENROLLED, updated.id, { device: updated, action: 're-enroll' }, user.tenantId, user.userId);
      return { data: updated };
    }

    // Check tenant enrollment mode
    const tenantSettings = await (this.prisma as any).mdmTenantSettings.findUnique({
      where: { tenantId: user.tenantId },
    }).catch(() => null);
    const enrollmentStatus = tenantSettings?.enrollmentMode === 'APPROVAL_REQUIRED'
      ? 'PENDING_APPROVAL' : 'APPROVED';

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
        enrollmentStatus,
      },
    });
    this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_DEVICE_ENROLLED, device.id, { device, action: 'enroll', enrollmentStatus }, user.tenantId, user.userId);
    return { data: device };
  }

  // ── Heartbeat (mobile calls this every 5 min) ──
  async heartbeat(dto: HeartbeatInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({
      where: { deviceToken: dto.deviceToken },
    });
    if (!device) throw new HttpError(404, 'Device not found');
    if (device.userId !== user.userId) throw new HttpError(403, 'Device does not belong to this user');

    // Unapproved devices: accept heartbeat for monitoring but don't deliver commands/updates
    if (device.enrollmentStatus && device.enrollmentStatus !== 'APPROVED') {
      return { data: { commands: [], enrollmentStatus: device.enrollmentStatus } };
    }

    const now = new Date();

    // Update dynamic fields on device and get fresh data back
    const updatedDevice = await (this.prisma as any).mdmDevice.update({
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

    // Run alert engine against fresh device state
    const newAlerts = await this.alertEngine.evaluate(updatedDevice);
    for (const alert of newAlerts) {
      this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_ALERT_TRIGGERED, alert.id, alert, updatedDevice.tenantId, user.userId);
    }

    // Evaluate compliance
    await this.complianceEngine.evaluate(updatedDevice);

    // Publish heartbeat event every 10th heartbeat per device
    const count = (this.heartbeatCounter.get(device.id) ?? 0) + 1;
    this.heartbeatCounter.set(device.id, count);
    if (count % 10 === 0) {
      this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_HEARTBEAT_RECEIVED, device.id, { deviceId: device.id, heartbeatCount: count }, updatedDevice.tenantId, user.userId);
    }

    // Save location history if moved >100m or >15min since last record
    if (dto.location) {
      const lastLoc = await (this.prisma as any).mdmLocationHistory.findFirst({
        where: { deviceId: device.id },
        orderBy: { recordedAt: 'desc' },
      });
      let shouldSave = !lastLoc;
      if (lastLoc) {
        const dist = this.haversineDistance(lastLoc.latitude, lastLoc.longitude, dto.location.latitude, dto.location.longitude);
        const minsSince = (Date.now() - new Date(lastLoc.recordedAt).getTime()) / 60000;
        shouldSave = dist > 100 || minsSince > 15;
      }
      if (shouldSave) {
        await (this.prisma as any).mdmLocationHistory.create({
          data: {
            deviceId: device.id,
            tenantId: device.tenantId,
            latitude: dto.location.latitude,
            longitude: dto.location.longitude,
            accuracy: dto.location.accuracy ?? null,
            recordedAt: now,
          },
        });
      }
    }

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

    if (update) {
      await (this.prisma as any).mdmUpdateTracking.upsert({
        where: { deviceId_releaseId: { deviceId: device.id, releaseId: update.id } },
        create: { deviceId: device.id, releaseId: update.id, tenantId: device.tenantId, status: 'NOTIFIED' },
        update: {},  // don't overwrite if already exists
      }).catch(() => {}); // ignore unique constraint if concurrent
    }

    // Fetch active policies for this tenant
    const policies = await this.getActivePolicies(device.tenantId);

    return {
      data: {
        commands: pendingCommands,
        update: update ?? undefined,
        policies,
      },
    };
  }

  // ── Command acknowledgment (mobile calls this) ──
  async acknowledgeCommand(commandId: string, dto: AcknowledgeCommandInput, user: AuthenticatedUser): Promise<ApiResponse<{ acknowledged: boolean }>> {
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

    // Publish command executed event
    this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_COMMAND_EXECUTED, commandId, { commandId, type: command.type, status: dto.status, result: dto.result ?? null }, user.tenantId, user.userId);

    // If command failed, create an alert
    if (dto.status === 'FAILED') {
      const device = await (this.prisma as any).mdmDevice.findUnique({ where: { id: command.deviceId } });
      if (device) {
        const alert = await this.alertEngine.onCommandFailed(device, { ...command, result: dto.result ?? command.result });
        if (alert) {
          this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_ALERT_TRIGGERED, alert.id, alert, device.tenantId, user.userId);
        }
      }
    }

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

    // Flatten user info onto each device for frontend convenience
    const enriched = data.map((d: any) => ({
      ...d,
      userEmail: d.user?.email ?? null,
      userName: d.user ? `${d.user.firstName ?? ''} ${d.user.lastName ?? ''}`.trim() : null,
      userRole: d.user?.role ?? null,
    }));

    return { data: enriched, meta: { total, page, limit } };
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
    return {
      data: {
        ...device,
        userEmail: device.user?.email ?? null,
        userName: device.user ? `${device.user.firstName ?? ''} ${device.user.lastName ?? ''}`.trim() : null,
        userRole: device.user?.role ?? null,
      },
    };
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

    this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_COMMAND_ISSUED, command.id, { command, deviceId, type: dto.type }, user.tenantId, user.userId);

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

    this.publishEvent(TOPIC_SYS_CREDENTIAL_MDM_RELEASE_PUBLISHED, release.id, { release }, user.tenantId, user.userId);

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

  // ── Admin: list alerts ──
  async listAlerts(user: AuthenticatedUser, query: { page?: number; limit?: number; type?: string; severity?: string; isResolved?: string }): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { ...this.buildTenantFilter(user) };
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.isResolved !== undefined) where.isResolved = query.isResolved === 'true';

    const [data, total] = await Promise.all([
      (this.prisma as any).mdmAlert.findMany({
        where,
        include: { device: { select: { id: true, deviceName: true, deviceModel: true } } },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).mdmAlert.count({ where }),
    ]);
    return { data, meta: { total, page, limit } };
  }

  // ── Admin: resolve alert ──
  async resolveAlert(alertId: string, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const alert = await (this.prisma as any).mdmAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new HttpError(404, 'Alert not found');
    const updated = await (this.prisma as any).mdmAlert.update({
      where: { id: alertId },
      data: { isResolved: true, resolvedAt: new Date(), resolvedBy: user.userId },
    });
    return { data: updated };
  }

  // ── Location History ──
  async getLocationHistory(deviceId: string, query: LocationHistoryQueryInput): Promise<ApiResponse<any[]>> {
    const limit = Math.min(query.limit ?? 100, 500);
    const where: Record<string, unknown> = { deviceId };
    if (query.from || query.to) {
      where.recordedAt = {};
      if (query.from) (where.recordedAt as any).gte = new Date(query.from);
      if (query.to) (where.recordedAt as any).lte = new Date(query.to);
    }
    const data = await (this.prisma as any).mdmLocationHistory.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
    return { data };
  }

  // ── Policy CRUD ──
  async listPolicies(user: AuthenticatedUser): Promise<ApiResponse<any[]>> {
    const where: Record<string, unknown> = {};
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where.tenantId = user.tenantId;
    }
    const data = await (this.prisma as any).mdmPolicy.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return { data };
  }

  async createPolicy(dto: CreatePolicyInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const policy = await (this.prisma as any).mdmPolicy.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        rules: dto.rules,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
      },
    });
    return { data: policy };
  }

  async updatePolicy(id: string, dto: UpdatePolicyInput): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).mdmPolicy.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Policy not found');
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.rules !== undefined) updateData.rules = dto.rules;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    const policy = await (this.prisma as any).mdmPolicy.update({ where: { id }, data: updateData });
    return { data: policy };
  }

  async deletePolicy(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const existing = await (this.prisma as any).mdmPolicy.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Policy not found');
    await (this.prisma as any).mdmPolicy.delete({ where: { id } });
    return { data: { deleted: true } };
  }

  async getActivePolicies(tenantId: string): Promise<any[]> {
    return (this.prisma as any).mdmPolicy.findMany({
      where: { tenantId, isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  /** Haversine distance in meters between two lat/lng points */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Enrollment: approve / reject / revoke ──
  async approveDevice(deviceId: string, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new HttpError(404, 'Device not found');
    if (device.enrollmentStatus === 'APPROVED') throw new HttpError(400, 'Device already approved');
    const updated = await (this.prisma as any).mdmDevice.update({
      where: { id: deviceId },
      data: { enrollmentStatus: 'APPROVED' },
    });
    return { data: updated };
  }

  async rejectDevice(deviceId: string, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new HttpError(404, 'Device not found');
    const updated = await (this.prisma as any).mdmDevice.update({
      where: { id: deviceId },
      data: { enrollmentStatus: 'REJECTED' },
    });
    return { data: updated };
  }

  async revokeDevice(deviceId: string, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const device = await (this.prisma as any).mdmDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new HttpError(404, 'Device not found');
    const updated = await (this.prisma as any).mdmDevice.update({
      where: { id: deviceId },
      data: { enrollmentStatus: 'REVOKED' },
    });
    return { data: updated };
  }

  // ── Enrollment Settings ──
  async getEnrollmentSettings(user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const settings = await (this.prisma as any).mdmTenantSettings.findUnique({
      where: { tenantId: user.tenantId },
    });
    return { data: settings ?? { tenantId: user.tenantId, enrollmentMode: 'AUTO' } };
  }

  async updateEnrollmentSettings(dto: EnrollmentSettingsInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const settings = await (this.prisma as any).mdmTenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, enrollmentMode: dto.enrollmentMode },
      update: { enrollmentMode: dto.enrollmentMode },
    });
    return { data: settings };
  }

  // ── Device Compliance ──
  async getDeviceCompliance(deviceId: string): Promise<ApiResponse<any[]>> {
    const checks = await (this.prisma as any).mdmComplianceCheck.findMany({
      where: { deviceId },
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });
    return { data: checks };
  }

  // ── OTA Update Progress (mobile calls this) ──
  async reportUpdateProgress(dto: UpdateProgressInput, user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const data: Record<string, unknown> = { status: dto.status };
    if (dto.downloadProgress != null) data.downloadProgress = dto.downloadProgress;
    if (dto.failureReason) data.failureReason = dto.failureReason;
    if (dto.status === 'DOWNLOADED') data.downloadedAt = new Date();
    if (dto.status === 'INSTALLED') data.installedAt = new Date();

    const tracking = await (this.prisma as any).mdmUpdateTracking.upsert({
      where: { deviceId_releaseId: { deviceId: dto.deviceId, releaseId: dto.releaseId } },
      create: { deviceId: dto.deviceId, releaseId: dto.releaseId, tenantId: user.tenantId, ...data },
      update: data,
    });
    return { data: tracking };
  }

  // ── Release Rollout Status ──
  async getRolloutStatus(releaseId: string): Promise<ApiResponse<any>> {
    const tracking = await (this.prisma as any).mdmUpdateTracking.findMany({
      where: { releaseId },
      include: {
        device: { select: { id: true, deviceName: true, deviceModel: true, appVersion: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const summary = {
      total: tracking.length,
      notified: tracking.filter((t: any) => t.status === 'NOTIFIED').length,
      downloading: tracking.filter((t: any) => t.status === 'DOWNLOADING').length,
      installed: tracking.filter((t: any) => t.status === 'INSTALLED').length,
      failed: tracking.filter((t: any) => t.status === 'FAILED').length,
    };
    return { data: { tracking, summary } };
  }

  // ── Dashboard Stats ──
  async getStats(user: AuthenticatedUser): Promise<ApiResponse<any>> {
    const tenantFilter = this.buildTenantFilter(user);
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);

    const [total, online, offline, lowBattery, activeAlerts, compliant, nonCompliant, pendingEnrollment] = await Promise.all([
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE' } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE', lastHeartbeatAt: { gte: fiveMinAgo } } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE', OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: thirtyMinAgo } }] } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE', batteryLevel: { lt: 20 } } }),
      (this.prisma as any).mdmAlert.count({ where: { ...tenantFilter, isResolved: false } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, complianceStatus: 'COMPLIANT' } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, complianceStatus: 'NON_COMPLIANT' } }),
      (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, enrollmentStatus: 'PENDING_APPROVAL' } }),
    ]);

    return {
      data: { total, online, offline, lowBattery, activeAlerts, compliant, nonCompliant, pendingEnrollment },
    };
  }

  // ── Dashboard Charts ──
  async getChartData(user: AuthenticatedUser, metric: string, from?: string, to?: string): Promise<ApiResponse<any>> {
    const tenantFilter = this.buildTenantFilter(user);

    switch (metric) {
      case 'device-status': {
        const [active, inactive] = await Promise.all([
          (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE' } }),
          (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: { not: 'ACTIVE' } } }),
        ]);
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
        const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
        const online = await (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE', lastHeartbeatAt: { gte: fiveMinAgo } } });
        const offline = await (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, status: 'ACTIVE', OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: thirtyMinAgo } }] } });
        const idle = active - online - offline;
        return { data: { labels: ['Online', 'Idle', 'Offline', 'Inactive'], values: [online, Math.max(0, idle), offline, inactive] } };
      }

      case 'battery-distribution': {
        const devices = await (this.prisma as any).mdmDevice.findMany({
          where: { ...tenantFilter, status: 'ACTIVE', batteryLevel: { not: null } },
          select: { batteryLevel: true },
        });
        const buckets = { critical: 0, low: 0, medium: 0, good: 0, full: 0 };
        for (const d of devices) {
          const l = d.batteryLevel;
          if (l < 15) buckets.critical++;
          else if (l < 30) buckets.low++;
          else if (l < 60) buckets.medium++;
          else if (l < 90) buckets.good++;
          else buckets.full++;
        }
        return { data: { labels: ['Critical (<15%)', 'Low (15-29%)', 'Medium (30-59%)', 'Good (60-89%)', 'Full (90%+)'], values: [buckets.critical, buckets.low, buckets.medium, buckets.good, buckets.full] } };
      }

      case 'os-versions': {
        const devices = await (this.prisma as any).mdmDevice.findMany({
          where: { ...tenantFilter, status: 'ACTIVE' },
          select: { osVersion: true },
        });
        const map = new Map<string, number>();
        for (const d of devices) {
          const v = d.osVersion || 'Unknown';
          map.set(v, (map.get(v) ?? 0) + 1);
        }
        const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        return { data: { labels: sorted.map(e => e[0]), values: sorted.map(e => e[1]) } };
      }

      case 'network-types': {
        const devices = await (this.prisma as any).mdmDevice.findMany({
          where: { ...tenantFilter, status: 'ACTIVE' },
          select: { networkType: true },
        });
        const map = new Map<string, number>();
        for (const d of devices) {
          const t = d.networkType || 'Unknown';
          map.set(t, (map.get(t) ?? 0) + 1);
        }
        const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
        return { data: { labels: sorted.map(e => e[0]), values: sorted.map(e => e[1]) } };
      }

      case 'compliance-status': {
        const [compliant, nonCompliant, unknown] = await Promise.all([
          (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, complianceStatus: 'COMPLIANT' } }),
          (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, complianceStatus: 'NON_COMPLIANT' } }),
          (this.prisma as any).mdmDevice.count({ where: { ...tenantFilter, complianceStatus: 'UNKNOWN' } }),
        ]);
        return { data: { labels: ['Compliant', 'Non-Compliant', 'Unknown'], values: [compliant, nonCompliant, unknown] } };
      }

      default:
        return { data: { labels: [], values: [] } };
    }
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
