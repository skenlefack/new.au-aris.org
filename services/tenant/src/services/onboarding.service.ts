import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { hash } from 'bcrypt';
import { randomUUID } from 'crypto';

const BCRYPT_ROUNDS = 12;

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export class OnboardingService {
  constructor(
    private prisma: PrismaClient,
    private kafka: StandaloneKafkaProducer,
  ) {}

  // ─── Public: submit onboarding request ───────────────────────────
  async submitOnboarding(dto: Record<string, unknown>) {
    const data = {
      countryName: dto.countryName as string,
      countryCode: (dto.countryCode as string) ?? null,
      officialLanguages: dto.officialLanguages as string[],
      preferredLanguage: dto.preferredLanguage as string,
      adminLevels: dto.adminLevels as any,
      activeDomains: dto.activeDomains as string[],
      users: dto.users ?? [],
      hasHistoricalData: (dto.hasHistoricalData as boolean) ?? false,
      historicalPeriod: (dto.historicalPeriod as string) ?? null,
      historicalFormat: (dto.historicalFormat as string[]) ?? [],
      historicalVolume: (dto.historicalVolume as string) ?? null,
      contactFullName: dto.contactFullName as string,
      contactTitle: dto.contactTitle as string,
      contactInstitution: dto.contactInstitution as string,
      contactEmail: dto.contactEmail as string,
      contactPhone: dto.contactPhone as string,
      cvoName: (dto.cvoName as string) ?? null,
      cvoTitle: (dto.cvoTitle as string) ?? null,
      cvoEmail: (dto.cvoEmail as string) ?? null,
      status: 'SUBMITTED',
    };

    const record = await (this.prisma as any).countryOnboarding.create({ data });

    // Publish Kafka event (non-blocking)
    try {
      const headers: KafkaHeaders = {
        correlationId: randomUUID(),
        sourceService: 'aris-tenant-service',
        tenantId: 'system',
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      };
      await Promise.race([
        this.kafka.send(
          'sys.tenant.onboarding.submitted.v1',
          record.id,
          { id: record.id, countryName: data.countryName, countryCode: data.countryCode },
          headers,
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000)),
      ]);
    } catch { /* non-blocking */ }

    return { data: record };
  }

  // ─── Admin: list onboarding submissions ──────────────────────────
  async listOnboardings(query: Record<string, unknown>, caller: AuthenticatedUser) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const status = query.status as string | undefined;
    const search = query.search as string | undefined;

    const where: any = {};

    // Scope filtering
    if (caller.role === 'NATIONAL_ADMIN') {
      // National admin: only see their country's submissions
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: caller.tenantId },
        select: { countryCode: true },
      });
      if (tenant?.countryCode) {
        where.countryCode = tenant.countryCode;
      } else {
        where.tenantId = caller.tenantId;
      }
    } else if (caller.role === 'REC_ADMIN') {
      // REC admin: see countries in their REC
      const countryCodes = await this.getRecCountryCodes(caller.tenantId);
      where.countryCode = { in: countryCodes };
    }
    // SUPER_ADMIN and CONTINENTAL_ADMIN see all

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { countryName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactFullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).countryOnboarding.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).countryOnboarding.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ─── Admin: get single onboarding ────────────────────────────────
  async getOnboarding(id: string, caller: AuthenticatedUser) {
    const record = await (this.prisma as any).countryOnboarding.findUnique({ where: { id } });
    if (!record) throw new HttpError(404, 'Onboarding submission not found');
    await this.checkScope(record, caller);
    return { data: record };
  }

  // ─── Admin: update onboarding ────────────────────────────────────
  async updateOnboarding(id: string, dto: Record<string, unknown>, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).countryOnboarding.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Onboarding submission not found');
    await this.checkScope(existing, caller);

    const record = await (this.prisma as any).countryOnboarding.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
    return { data: record };
  }

  // ─── Admin: update status ────────────────────────────────────────
  async updateStatus(id: string, status: string, notes: string | null, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).countryOnboarding.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Onboarding submission not found');

    const updateData: any = { status, notes };
    if (['APPROVED', 'COMPLETED', 'REJECTED'].includes(status)) {
      updateData.processedBy = caller.userId;
      updateData.processedAt = new Date();
    }

    const record = await (this.prisma as any).countryOnboarding.update({
      where: { id },
      data: updateData,
    });
    return { data: record };
  }

  // ─── Admin: auto-create users from onboarding ────────────────────
  async provisionUsers(id: string, caller: AuthenticatedUser) {
    const record = await (this.prisma as any).countryOnboarding.findUnique({ where: { id } });
    if (!record) throw new HttpError(404, 'Onboarding submission not found');

    const users = record.users as any[];
    if (!users || users.length === 0) throw new HttpError(400, 'No users to provision');

    // Find the tenant for this country
    let tenantId = record.tenantId;
    if (!tenantId && record.countryCode) {
      const tenant = await (this.prisma as any).tenant.findFirst({
        where: { countryCode: record.countryCode, level: 'MEMBER_STATE' },
        select: { id: true },
      });
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId) throw new HttpError(400, 'No tenant found for this country. Activate the country first.');

    // Resolve domain IDs
    const domains = await (this.prisma as any).domain.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    });
    const domainMap = new Map(domains.map((d: any) => [d.code, d.id]));

    const created: any[] = [];
    const errors: any[] = [];

    for (const u of users) {
      try {
        const email = u.email?.trim();
        if (!email) continue;

        // Check if user already exists
        const existing = await (this.prisma as any).user.findUnique({ where: { email } });
        if (existing) {
          errors.push({ email, error: 'User already exists' });
          continue;
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await hash(tempPassword, BCRYPT_ROUNDS);

        // Map domain codes to IDs
        const userDomainCodes = (u.domains || u.domainCodes || '').toString().split(',').map((s: string) => s.trim()).filter(Boolean);
        const userDomainIds = userDomainCodes.map((code: string) => domainMap.get(code)).filter(Boolean);

        const newUser = await (this.prisma as any).user.create({
          data: {
            email,
            passwordHash,
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            phone: u.phone || null,
            role: u.role || 'FIELD_AGENT',
            tenantId,
            locale: record.preferredLanguage?.toLowerCase() || 'en',
            mustChangePassword: true,
          },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, locale: true, isActive: true, tenantId: true, createdAt: true,
          },
        });

        // Assign domains
        if (userDomainIds.length > 0) {
          await (this.prisma as any).userDomain.createMany({
            data: userDomainIds.map((domainId: string) => ({
              userId: newUser.id,
              domainId,
              assignedBy: caller.userId,
            })),
            skipDuplicates: true,
          });
        }

        created.push({ ...newUser, temporaryPassword: tempPassword });
      } catch (err: any) {
        errors.push({ email: u.email, error: err.message });
      }
    }

    // Update onboarding status
    await (this.prisma as any).countryOnboarding.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processedBy: caller.userId,
        processedAt: new Date(),
        tenantId,
      },
    });

    return {
      data: {
        created: created.length,
        errors: errors.length,
        users: created,
        failures: errors,
      },
    };
  }

  // ─── Admin: delete onboarding ────────────────────────────────────
  async deleteOnboarding(id: string, caller: AuthenticatedUser) {
    const existing = await (this.prisma as any).countryOnboarding.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Onboarding submission not found');

    await (this.prisma as any).countryOnboarding.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  private async getRecCountryCodes(tenantId: string): Promise<string[]> {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { code: true },
    });
    if (!tenant) return [];

    const rec = await (this.prisma as any).rec.findUnique({
      where: { code: tenant.code },
      select: { id: true },
    });
    if (!rec) return [];

    const countryRecs = await (this.prisma as any).countryRec.findMany({
      where: { recId: rec.id },
      select: { country: { select: { code: true } } },
    });
    return countryRecs.map((cr: any) => cr.country.code);
  }

  private async checkScope(record: any, caller: AuthenticatedUser) {
    if (caller.role === 'SUPER_ADMIN' || caller.role === 'CONTINENTAL_ADMIN') return;

    if (caller.role === 'NATIONAL_ADMIN') {
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: caller.tenantId },
        select: { countryCode: true },
      });
      if (tenant?.countryCode && record.countryCode === tenant.countryCode) return;
      if (record.tenantId === caller.tenantId) return;
      throw new HttpError(403, 'Access denied');
    }

    if (caller.role === 'REC_ADMIN') {
      const codes = await this.getRecCountryCodes(caller.tenantId);
      if (codes.includes(record.countryCode)) return;
      throw new HttpError(403, 'Access denied');
    }

    throw new HttpError(403, 'Access denied');
  }
}
