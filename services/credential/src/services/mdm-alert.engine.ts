import type { PrismaClient } from '@prisma/client';

export interface AlertRule {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  evaluate: (device: any, heartbeat: any) => string | null; // returns message or null
}

const ALERT_RULES: AlertRule[] = [
  {
    type: 'LOW_BATTERY',
    severity: 'WARNING',
    evaluate: (device) => {
      if (device.batteryLevel != null && device.batteryLevel < 15 && !device.isCharging) {
        return `Battery critically low: ${device.batteryLevel}%`;
      }
      return null;
    },
  },
  {
    type: 'STORAGE_CRITICAL',
    severity: 'CRITICAL',
    evaluate: (device) => {
      if (device.storageFreeMb != null && device.storageFreeMb < 500) {
        return `Storage critically low: ${device.storageFreeMb} MB free`;
      }
      return null;
    },
  },
  {
    type: 'SYNC_STALE',
    severity: 'WARNING',
    evaluate: (device) => {
      if (!device.lastSyncAt || device.pendingSyncItems <= 0) return null;
      const hoursSinceSync = (Date.now() - new Date(device.lastSyncAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync > 24 && device.pendingSyncItems > 0) {
        return `No sync for ${Math.round(hoursSinceSync)}h with ${device.pendingSyncItems} pending items`;
      }
      return null;
    },
  },
];

export class MdmAlertEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Evaluate all alert rules against the device state after a heartbeat.
   * Creates new alerts or auto-resolves existing ones.
   * Returns array of newly created alerts.
   */
  async evaluate(device: any): Promise<any[]> {
    const newAlerts: any[] = [];

    for (const rule of ALERT_RULES) {
      const message = rule.evaluate(device, null);

      if (message) {
        // Check for existing unresolved alert of same type for this device
        const existing = await (this.prisma as any).mdmAlert.findFirst({
          where: {
            deviceId: device.id,
            type: rule.type,
            isResolved: false,
          },
        });
        if (!existing) {
          const alert = await (this.prisma as any).mdmAlert.create({
            data: {
              deviceId: device.id,
              tenantId: device.tenantId,
              type: rule.type,
              severity: rule.severity,
              message,
            },
          });
          newAlerts.push(alert);
        }
      } else {
        // Condition cleared — auto-resolve existing alert
        await (this.prisma as any).mdmAlert.updateMany({
          where: {
            deviceId: device.id,
            type: rule.type,
            isResolved: false,
          },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
          },
        });
      }
    }

    return newAlerts;
  }

  /**
   * Create a COMMAND_FAILED alert when a command execution fails.
   */
  async onCommandFailed(device: any, command: any): Promise<any | null> {
    const existing = await (this.prisma as any).mdmAlert.findFirst({
      where: { deviceId: device.id, type: 'COMMAND_FAILED', isResolved: false },
    });
    if (existing) return null;

    return (this.prisma as any).mdmAlert.create({
      data: {
        deviceId: device.id,
        tenantId: device.tenantId,
        type: 'COMMAND_FAILED',
        severity: 'INFO',
        message: `Command ${command.type} failed${command.result ? ': ' + JSON.stringify(command.result) : ''}`,
      },
    });
  }
}
