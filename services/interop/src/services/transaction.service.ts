import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface TransactionQuery {
  page?: number;
  limit?: number;
  connectionId?: string;
  status?: string;
  sort?: string;
  order?: string;
}

export class TransactionService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    connectionId: string;
    direction: string;
    entityType: string;
    sourcePayload: unknown;
    targetPayload?: unknown;
    status?: string;
    tenantId: string;
  }) {
    const tx = await (this.prisma as any).interopTransaction.create({
      data: {
        connection_id: data.connectionId,
        direction: data.direction,
        entity_type: data.entityType,
        source_payload: data.sourcePayload as any,
        target_payload: data.targetPayload as any,
        status: data.status ?? 'PENDING',
        tenant_id: data.tenantId,
      },
    });
    return tx;
  }

  async findAll(user: AuthenticatedUser, query: TransactionQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    if (query.connectionId) where['connection_id'] = query.connectionId;
    if (query.status) where['status'] = query.status;

    const orderBy: Record<string, string> = {};
    orderBy[query.sort ?? 'created_at'] = query.order ?? 'desc';

    const [data, total] = await Promise.all([
      (this.prisma as any).interopTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      (this.prisma as any).interopTransaction.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tx = await (this.prisma as any).interopTransaction.findUnique({ where: { id } });
    if (!tx) throw new HttpError(404, 'Transaction not found');
    if (tx.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');
    return { data: tx };
  }

  async retry(id: string, user: AuthenticatedUser) {
    const tx = await (this.prisma as any).interopTransaction.findUnique({ where: { id } });
    if (!tx) throw new HttpError(404, 'Transaction not found');
    if (tx.tenant_id !== user.tenantId) throw new HttpError(403, 'Unauthorized');

    if (tx.status !== 'FAILED' && tx.status !== 'RETRY') {
      throw new HttpError(400, 'Only failed or retry transactions can be retried');
    }
    if (tx.retry_count >= tx.max_retries) {
      throw new HttpError(400, `Max retries (${tx.max_retries}) exceeded`);
    }

    const updated = await (this.prisma as any).interopTransaction.update({
      where: { id },
      data: {
        status: 'PENDING',
        retry_count: tx.retry_count + 1,
        error_message: null,
      },
    });

    return { data: updated };
  }

  async updateStatus(id: string, status: string, errorMessage?: string) {
    const data: Record<string, unknown> = { status };
    if (errorMessage !== undefined) data['error_message'] = errorMessage;
    if (status === 'COMPLETED') data['completed_at'] = new Date();

    await (this.prisma as any).interopTransaction.update({
      where: { id },
      data,
    });
  }
}
