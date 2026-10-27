import { Type, type Static } from '@sinclair/typebox';

// ── Enroll Device ──
export const EnrollDeviceSchema = Type.Object({
  hardwareId: Type.String({ minLength: 1, maxLength: 255 }),
  deviceName: Type.String({ minLength: 1, maxLength: 255 }),
  deviceModel: Type.String({ minLength: 1, maxLength: 255 }),
  manufacturer: Type.Optional(Type.String({ maxLength: 100 })),
  osVersion: Type.String({ minLength: 1, maxLength: 50 }),
  appVersion: Type.String({ minLength: 1, maxLength: 50 }),
  screenResolution: Type.Optional(Type.String({ maxLength: 30 })),
  totalStorageMb: Type.Optional(Type.Integer({ minimum: 0 })),
  totalRamMb: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type EnrollDeviceInput = Static<typeof EnrollDeviceSchema>;

// ── Heartbeat ──
export const HeartbeatSchema = Type.Object({
  deviceToken: Type.String({ minLength: 1, maxLength: 64 }),
  batteryLevel: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  isCharging: Type.Optional(Type.Boolean()),
  networkType: Type.Optional(Type.String({ maxLength: 20 })),
  storageFreeMb: Type.Optional(Type.Integer({ minimum: 0 })),
  appVersion: Type.Optional(Type.String({ maxLength: 50 })),
  pendingSyncItems: Type.Optional(Type.Integer({ minimum: 0 })),
  lastSyncAt: Type.Optional(Type.String({ format: 'date-time' })),
  location: Type.Optional(Type.Object({
    latitude: Type.Number(),
    longitude: Type.Number(),
    accuracy: Type.Optional(Type.Number()),
  })),
});
export type HeartbeatInput = Static<typeof HeartbeatSchema>;

// ── Command Acknowledge ──
export const AcknowledgeCommandSchema = Type.Object({
  status: Type.Union([Type.Literal('EXECUTED'), Type.Literal('FAILED')]),
  result: Type.Optional(Type.Any()),
});
export type AcknowledgeCommandInput = Static<typeof AcknowledgeCommandSchema>;

// ── Send Command (Admin) ──
export const SendCommandSchema = Type.Object({
  type: Type.Union([
    Type.Literal('FORCE_LOGOUT'),
    Type.Literal('FORCE_SYNC'),
    Type.Literal('SEND_MESSAGE'),
    Type.Literal('FORCE_UPDATE'),
    Type.Literal('WIPE_DATA'),
  ]),
  payload: Type.Optional(Type.Any()),
});
export type SendCommandInput = Static<typeof SendCommandSchema>;

// ── Create Release (Admin) ──
export const CreateReleaseSchema = Type.Object({
  versionName: Type.String({ minLength: 1, maxLength: 50 }),
  versionCode: Type.Integer({ minimum: 1 }),
  releaseNotes: Type.Optional(Type.String()),
  fileName: Type.String({ minLength: 1, maxLength: 255 }),
  fileSize: Type.Integer({ minimum: 1 }),
  fileSha256: Type.String({ minLength: 64, maxLength: 64 }),
  fileUrl: Type.String({ minLength: 1 }),
  packageName: Type.Optional(Type.String({ maxLength: 200 })),
  isRequired: Type.Optional(Type.Boolean()),
  targetDevices: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});
export type CreateReleaseInput = Static<typeof CreateReleaseSchema>;

// ── Update Release (Admin) ──
export const UpdateReleaseSchema = Type.Object({
  releaseNotes: Type.Optional(Type.String()),
  isRequired: Type.Optional(Type.Boolean()),
  isActive: Type.Optional(Type.Boolean()),
  targetDevices: Type.Optional(Type.Union([
    Type.Array(Type.String({ format: 'uuid' })),
    Type.Null(),
  ])),
});
export type UpdateReleaseInput = Static<typeof UpdateReleaseSchema>;

// ── List Devices Query ──
export const ListDevicesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});
export type ListDevicesQueryInput = Static<typeof ListDevicesQuerySchema>;

// ── Version Check Query ──
export const VersionCheckQuerySchema = Type.Object({
  currentVersionCode: Type.Integer({ minimum: 0 }),
  deviceId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type VersionCheckQueryInput = Static<typeof VersionCheckQuerySchema>;

// ── Shared Param Schemas ──
export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

// ── List Alerts Query ──
export const ListAlertsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  type: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
  isResolved: Type.Optional(Type.String()),
});
export type ListAlertsQueryInput = Static<typeof ListAlertsQuerySchema>;

// ── Location History Query ──
export const LocationHistoryQuerySchema = Type.Object({
  from: Type.Optional(Type.String({ format: 'date-time' })),
  to: Type.Optional(Type.String({ format: 'date-time' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
});
export type LocationHistoryQueryInput = Static<typeof LocationHistoryQuerySchema>;

// ── Create Policy ──
export const CreatePolicySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.Optional(Type.String()),
  rules: Type.Object({
    minAppVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    requireScreenLock: Type.Optional(Type.Boolean()),
    maxOfflineDays: Type.Optional(Type.Integer({ minimum: 1 })),
    minBatteryForSync: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    gpsRequired: Type.Optional(Type.Boolean()),
    maxStorageUsagePercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  }),
  isActive: Type.Optional(Type.Boolean()),
  priority: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type CreatePolicyInput = Static<typeof CreatePolicySchema>;

// ── Update Policy ──
export const UpdatePolicySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  description: Type.Optional(Type.String()),
  rules: Type.Optional(Type.Object({
    minAppVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    requireScreenLock: Type.Optional(Type.Boolean()),
    maxOfflineDays: Type.Optional(Type.Integer({ minimum: 1 })),
    minBatteryForSync: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    gpsRequired: Type.Optional(Type.Boolean()),
    maxStorageUsagePercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  })),
  isActive: Type.Optional(Type.Boolean()),
  priority: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type UpdatePolicyInput = Static<typeof UpdatePolicySchema>;

// ── Enrollment Settings ──
export const EnrollmentSettingsSchema = Type.Object({
  enrollmentMode: Type.Union([Type.Literal('AUTO'), Type.Literal('APPROVAL_REQUIRED')]),
});
export type EnrollmentSettingsInput = Static<typeof EnrollmentSettingsSchema>;

// ── Update Progress (mobile) ──
export const UpdateProgressSchema = Type.Object({
  deviceId: Type.String({ format: 'uuid' }),
  releaseId: Type.String({ format: 'uuid' }),
  status: Type.Union([
    Type.Literal('DOWNLOADING'), Type.Literal('DOWNLOADED'),
    Type.Literal('INSTALLING'), Type.Literal('INSTALLED'),
    Type.Literal('FAILED'), Type.Literal('SKIPPED'),
  ]),
  downloadProgress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  failureReason: Type.Optional(Type.String()),
});
export type UpdateProgressInput = Static<typeof UpdateProgressSchema>;

// ── Stats Query ──
export const StatsQuerySchema = Type.Object({});
export type StatsQueryInput = Static<typeof StatsQuerySchema>;

// ── Charts Query ──
export const ChartsQuerySchema = Type.Object({
  metric: Type.String(), // device-status | battery-distribution | os-versions | network-types | sync-health | devices-over-time
  from: Type.Optional(Type.String({ format: 'date-time' })),
  to: Type.Optional(Type.String({ format: 'date-time' })),
});
export type ChartsQueryInput = Static<typeof ChartsQuerySchema>;
