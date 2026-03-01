import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyKafka } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import { TOPIC_AU_INTEROP_V2_SYNC_REQUESTED } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { getAdapter, type BaseAdapter, type AdapterConfig } from '../adapters/index.js';

const SERVICE_NAME = 'interop-v2';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateConnectionInput {
  name: string;
  system: string;
  baseUrl: string;
  authType: string;
  credentials?: Record<string, unknown>;
  syncFrequency?: string;
  config?: Record<string, unknown>;
}

export interface UpdateConnectionInput {
  name?: string;
  baseUrl?: string;
  authType?: string;
  credentials?: Record<string, unknown>;
  isActive?: boolean;
  syncFrequency?: string;
  config?: Record<string, unknown>;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  system?: string;
  isActive?: boolean;
}

export class ConnectionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: FastifyKafka,
  ) {}

  async create(dto: CreateConnectionInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).interopConnection.findUnique({
      where: { tenant_id_system: { tenant_id: user.tenantId, system: dto.system } },
    });
    if (existing) {
      throw new HttpError(409, `Connection for ${dto.system} already exists for this tenant`);
    }

    const conn = await (this.prisma as any).interopConnection.create({
      data: {
        name: dto.name,
        system: dto.system,
        base_url: dto.baseUrl,
        auth_type: dto.authType,
        credentials: dto.credentials ?? {},
        tenant_id: user.tenantId,
        sync_frequency: dto.syncFrequency,
        config: dto.config ?? {},
      },
    });

    return { data: conn };
  }

  async findAll(user: AuthenticatedUser, query: ListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    if (query.system) where['system'] = query.system;
    if (query.isActive !== undefined) where['is_active'] = query.isActive;

    const [data, total] = await Promise.all([
      (this.prisma as any).interopConnection.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).interopConnection.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({
      where: { id },
      include: { mappings: true },
    });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');
    return { data: conn };
  }

  async update(id: string, dto: UpdateConnectionInput, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({ where: { id } });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.baseUrl !== undefined) data['base_url'] = dto.baseUrl;
    if (dto.authType !== undefined) data['auth_type'] = dto.authType;
    if (dto.credentials !== undefined) data['credentials'] = dto.credentials;
    if (dto.isActive !== undefined) data['is_active'] = dto.isActive;
    if (dto.syncFrequency !== undefined) data['sync_frequency'] = dto.syncFrequency;
    if (dto.config !== undefined) data['config'] = dto.config;

    const updated = await (this.prisma as any).interopConnection.update({
      where: { id },
      data,
    });

    return { data: updated };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({ where: { id } });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    await (this.prisma as any).interopConnection.update({
      where: { id },
      data: { is_active: false },
    });

    return { data: { message: 'Connection deactivated' } };
  }

  async testConnection(id: string, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({ where: { id } });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    const adapter = getAdapter(conn.system);
    if (!adapter) throw new HttpError(400, `No adapter found for system: ${conn.system}`);

    const adapterConfig: AdapterConfig = {
      baseUrl: conn.base_url,
      authType: conn.auth_type,
      credentials: conn.credentials as Record<string, unknown>,
      config: conn.config as Record<string, unknown>,
    };

    const result = await adapter.testConnection(adapterConfig);
    return { data: result };
  }

  async triggerSync(id: string, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({ where: { id } });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');
    if (!conn.is_active) throw new HttpError(400, 'Connection is not active');

    // Publish sync request event for async processing
    try {
      const headers: KafkaHeaders = {
        correlationId: randomUUID(),
        sourceService: SERVICE_NAME,
        tenantId: user.tenantId,
        userId: user.userId,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      };
      await this.kafka.send(
        TOPIC_AU_INTEROP_V2_SYNC_REQUESTED,
        id,
        { connectionId: id, system: conn.system, tenantId: user.tenantId },
        headers,
      );
    } catch {
      // Kafka failure is non-blocking
    }

    return { data: { message: 'Sync requested', connectionId: id } };
  }
}
