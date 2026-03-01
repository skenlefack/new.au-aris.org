import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateMappingInput {
  sourceField: string;
  targetField: string;
  transformation?: string;
  direction: string;
  entityType: string;
}

export interface UpdateMappingInput {
  sourceField?: string;
  targetField?: string;
  transformation?: string;
  direction?: string;
  entityType?: string;
  isActive?: boolean;
}

export class MappingService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(connectionId: string, dto: CreateMappingInput, user: AuthenticatedUser) {
    const conn = await (this.prisma as any).interopConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    const mapping = await (this.prisma as any).interopMapping.create({
      data: {
        connection_id: connectionId,
        source_field: dto.sourceField,
        target_field: dto.targetField,
        transformation: dto.transformation,
        direction: dto.direction,
        entity_type: dto.entityType,
      },
    });

    return { data: mapping };
  }

  async findByConnection(connectionId: string, user: AuthenticatedUser, query: { page?: number; limit?: number } = {}) {
    const conn = await (this.prisma as any).interopConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) throw new HttpError(404, 'Connection not found');
    if (conn.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [data, total] = await Promise.all([
      (this.prisma as any).interopMapping.findMany({
        where: { connection_id: connectionId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      (this.prisma as any).interopMapping.count({
        where: { connection_id: connectionId },
      }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async update(mappingId: string, dto: UpdateMappingInput, user: AuthenticatedUser) {
    const mapping = await (this.prisma as any).interopMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });
    if (!mapping) throw new HttpError(404, 'Mapping not found');
    if (mapping.connection.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    const data: Record<string, unknown> = {};
    if (dto.sourceField !== undefined) data['source_field'] = dto.sourceField;
    if (dto.targetField !== undefined) data['target_field'] = dto.targetField;
    if (dto.transformation !== undefined) data['transformation'] = dto.transformation;
    if (dto.direction !== undefined) data['direction'] = dto.direction;
    if (dto.entityType !== undefined) data['entity_type'] = dto.entityType;
    if (dto.isActive !== undefined) data['is_active'] = dto.isActive;

    const updated = await (this.prisma as any).interopMapping.update({
      where: { id: mappingId },
      data,
    });

    return { data: updated };
  }

  async remove(mappingId: string, user: AuthenticatedUser) {
    const mapping = await (this.prisma as any).interopMapping.findUnique({
      where: { id: mappingId },
      include: { connection: true },
    });
    if (!mapping) throw new HttpError(404, 'Mapping not found');
    if (mapping.connection.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    await (this.prisma as any).interopMapping.delete({ where: { id: mappingId } });
    return { data: { message: 'Mapping deleted' } };
  }
}
