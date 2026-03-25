import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyKafka } from '@aris/kafka-client';
import { TOPIC_SYS_CREDENTIAL_USER_DOMAINS_UPDATED } from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';

const SERVICE_NAME = 'credential-service';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class DomainService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: FastifyKafka,
  ) {}

  /** List all active domains ordered by sortOrder */
  async listDomains(): Promise<{ data: any[] }> {
    const domains = await (this.prisma as any).domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        sortOrder: true,
      },
    });
    return { data: domains };
  }

  /** Get domains assigned to a specific user */
  async getUserDomains(userId: string): Promise<{ data: any[] }> {
    const userDomains = await (this.prisma as any).userDomain.findMany({
      where: { userId, isActive: true },
      include: {
        domain: {
          select: { id: true, code: true, name: true, icon: true, color: true },
        },
      },
      orderBy: { domain: { sortOrder: 'asc' } },
    });

    const domains = userDomains.map((ud: any) => ({
      id: ud.domain.id,
      code: ud.domain.code,
      name: ud.domain.name,
      icon: ud.domain.icon,
      color: ud.domain.color,
      assignedAt: ud.assignedAt,
    }));

    return { data: domains };
  }

  /** Replace all domain assignments for a user */
  async setUserDomains(
    userId: string,
    domainIds: string[],
    assignedBy: string,
    tenantId: string,
  ): Promise<{ data: any[] }> {
    // Verify user exists
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, `User ${userId} not found`);

    // Verify all domain IDs are valid
    if (domainIds.length > 0) {
      const domains = await (this.prisma as any).domain.findMany({
        where: { id: { in: domainIds }, isActive: true },
      });
      if (domains.length !== domainIds.length) {
        throw new HttpError(400, 'One or more domain IDs are invalid or inactive');
      }
    }

    // Transaction: delete old assignments, create new ones
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.userDomain.deleteMany({ where: { userId } });

      if (domainIds.length > 0) {
        await tx.userDomain.createMany({
          data: domainIds.map((domainId: string) => ({
            userId,
            domainId,
            assignedBy,
          })),
        });
      }
    });

    // Publish Kafka event (fire-and-forget with timeout to avoid hanging if topic missing)
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId: assignedBy,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    const kafkaSend = this.kafka.send(
      TOPIC_SYS_CREDENTIAL_USER_DOMAINS_UPDATED,
      userId,
      { userId, domainIds, assignedBy },
      headers,
    );
    const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Kafka send timeout')), 5000));
    Promise.race([kafkaSend, timeout]).catch(() => { /* non-blocking */ });

    return this.getUserDomains(userId);
  }

  /** Get domain codes for a user (used for JWT enrichment) */
  async getUserDomainCodes(userId: string): Promise<string[]> {
    const userDomains = await (this.prisma as any).userDomain.findMany({
      where: { userId, isActive: true },
      include: {
        domain: { select: { code: true } },
      },
    });
    return userDomains.map((ud: any) => ud.domain.code);
  }
}
