import type { PrismaClient } from '@prisma/client';

interface Violation {
  rule: string;
  expected: unknown;
  actual: unknown;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class MdmComplianceEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Evaluate device against all active policies for its tenant.
   * Only persists a new check if the compliance status changed.
   * Returns the new complianceStatus.
   */
  async evaluate(device: any): Promise<'COMPLIANT' | 'NON_COMPLIANT' | 'UNKNOWN'> {
    const policies = await (this.prisma as any).mdmPolicy.findMany({
      where: { tenantId: device.tenantId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (policies.length === 0) return 'UNKNOWN';

    let allCompliant = true;

    for (const policy of policies) {
      const rules = policy.rules as Record<string, unknown> ?? {};
      const violations: Violation[] = [];

      // minAppVersion
      if (rules.minAppVersion != null) {
        const current = parseInt(device.appVersion, 10) || 0;
        if (current < (rules.minAppVersion as number)) {
          violations.push({ rule: 'minAppVersion', expected: rules.minAppVersion, actual: current, severity: 'HIGH' });
        }
      }

      // maxOfflineDays
      if (rules.maxOfflineDays != null && device.lastSyncAt) {
        const daysSince = (Date.now() - new Date(device.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > (rules.maxOfflineDays as number)) {
          violations.push({ rule: 'maxOfflineDays', expected: rules.maxOfflineDays, actual: Math.round(daysSince), severity: 'MEDIUM' });
        }
      }

      // gpsRequired
      if (rules.gpsRequired === true && !device.lastLocation) {
        violations.push({ rule: 'gpsRequired', expected: true, actual: false, severity: 'LOW' });
      }

      // maxStorageUsagePercent
      if (rules.maxStorageUsagePercent != null && device.totalStorageMb && device.storageFreeMb != null) {
        const usedPercent = Math.round(((device.totalStorageMb - device.storageFreeMb) / device.totalStorageMb) * 100);
        if (usedPercent > (rules.maxStorageUsagePercent as number)) {
          violations.push({ rule: 'maxStorageUsagePercent', expected: rules.maxStorageUsagePercent, actual: usedPercent, severity: 'MEDIUM' });
        }
      }

      const isCompliant = violations.length === 0;
      if (!isCompliant) allCompliant = false;

      // Only persist if status changed from last check for this policy
      const lastCheck = await (this.prisma as any).mdmComplianceCheck.findFirst({
        where: { deviceId: device.id, policyId: policy.id },
        orderBy: { checkedAt: 'desc' },
      });

      if (!lastCheck || lastCheck.isCompliant !== isCompliant) {
        await (this.prisma as any).mdmComplianceCheck.create({
          data: {
            deviceId: device.id,
            tenantId: device.tenantId,
            policyId: policy.id,
            isCompliant,
            violations: violations.length > 0 ? violations : null,
          },
        });
      }
    }

    const newStatus = allCompliant ? 'COMPLIANT' : 'NON_COMPLIANT';

    // Update device compliance status if changed
    if (device.complianceStatus !== newStatus) {
      await (this.prisma as any).mdmDevice.update({
        where: { id: device.id },
        data: { complianceStatus: newStatus },
      });
    }

    return newStatus;
  }
}
