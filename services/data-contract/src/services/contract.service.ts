import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { DataContractEntity } from '../contract/entities/contract.entity';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const SERVICE_NAME = 'data-contract-service';
const TOPIC_CONTRACT_CREATED = 'sys.contract.created.v1';
const TOPIC_CONTRACT_UPDATED = 'sys.contract.updated.v1';

export interface CreateContractDto {
  name: string;
  domain: string;
  dataOwner: string;
  dataSteward: string;
  purpose: string;
  officialityLevel: 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';
  schema: Record<string, unknown>;
  frequency: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  timelinessSla: number;
  qualitySla: { correctionDeadline: number; escalationDeadline: number; minPassRate: number };
  classification: string;
  exchangeMechanism: 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';
  validFrom: string;
  validTo?: string;
  approvedBy: string;
}

export interface UpdateContractDto {
  name?: string;
  domain?: string;
  dataOwner?: string;
  dataSteward?: string;
  purpose?: string;
  officialityLevel?: 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';
  schema?: Record<string, unknown>;
  frequency?: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  timelinessSla?: number;
  qualitySla?: { correctionDeadline: number; escalationDeadline: number; minPassRate: number };
  classification?: string;
  exchangeMechanism?: 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';
  validFrom?: string;
  validTo?: string;
  approvedBy?: string;
}

export class ContractService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateContractDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    // Check duplicate name+version within tenant
    const existing = await (this.prisma as any).dataContract.findFirst({
      where: {
        tenant_id: user.tenantId,
        name: dto.name,
        version: 1,
      },
    });
    if (existing) {
      throw new HttpError(
        409,
        `Contract "${dto.name}" version 1 already exists for this tenant`,
      );
    }

    const contract = await (this.prisma as any).dataContract.create({
      data: {
        tenant_id: user.tenantId,
        name: dto.name,
        domain: dto.domain,
        data_owner: dto.dataOwner,
        data_steward: dto.dataSteward,
        purpose: dto.purpose,
        officiality_level: dto.officialityLevel,
        schema: dto.schema,
        frequency: dto.frequency,
        timeliness_sla: dto.timelinessSla,
        quality_sla: dto.qualitySla as any,
        classification: dto.classification,
        exchange_mechanism: dto.exchangeMechanism,
        version: 1,
        status: 'ACTIVE',
        valid_from: new Date(dto.validFrom),
        valid_to: dto.validTo ? new Date(dto.validTo) : null,
        approved_by: dto.approvedBy,
        created_by: user.userId,
      },
    });

    await this.publishEvent(TOPIC_CONTRACT_CREATED, contract, user);

    console.log(`[ContractService] Contract created: ${contract.name} v${contract.version} (${contract.id})`);
    return { data: this.toEntity(contract) };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string; owner?: string },
  ): Promise<PaginatedResponse<DataContractEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { created_at: 'asc' as const };

    const where: Record<string, unknown> = {
      ...this.buildTenantFilter(user),
      ...(query.domain && { domain: query.domain }),
      ...(query.status && { status: query.status }),
      ...(query.owner && { data_owner: { contains: query.owner, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      (this.prisma as any).dataContract.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).dataContract.count({ where }),
    ]);

    return {
      data: data.map((c: any) => this.toEntity(c)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    const contract = await (this.prisma as any).dataContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new HttpError(404, `Contract ${id} not found`);
    }

    this.verifyTenantAccess(user, contract.tenant_id);

    return { data: this.toEntity(contract) };
  }

  async update(
    id: string,
    dto: UpdateContractDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    const existing = await (this.prisma as any).dataContract.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Contract ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new HttpError(400, 'Cannot update an archived contract');
    }

    // Find the latest version to determine next version number
    const latest = await (this.prisma as any).dataContract.findFirst({
      where: {
        tenant_id: existing.tenant_id,
        name: existing.name,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? existing.version) + 1;

    // IMMUTABLE VERSIONING: archive old version, create new version in $transaction
    const [, newContract] = await this.prisma.$transaction([
      // Archive the existing active version
      (this.prisma as any).dataContract.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          valid_to: new Date(),
          updated_by: user.userId,
        },
      }),
      // Create the new version
      (this.prisma as any).dataContract.create({
        data: {
          tenant_id: existing.tenant_id,
          name: dto.name ?? existing.name,
          domain: dto.domain ?? existing.domain,
          data_owner: dto.dataOwner ?? existing.data_owner,
          data_steward: dto.dataSteward ?? existing.data_steward,
          purpose: dto.purpose ?? existing.purpose,
          officiality_level: dto.officialityLevel ?? existing.officiality_level,
          schema: (dto.schema ?? existing.schema) as any,
          frequency: dto.frequency ?? existing.frequency,
          timeliness_sla: dto.timelinessSla ?? existing.timeliness_sla,
          quality_sla: dto.qualitySla
            ? (dto.qualitySla as any)
            : existing.quality_sla,
          classification: dto.classification ?? existing.classification,
          exchange_mechanism: dto.exchangeMechanism ?? existing.exchange_mechanism,
          version: nextVersion,
          status: 'ACTIVE',
          valid_from: dto.validFrom
            ? new Date(dto.validFrom)
            : new Date(),
          valid_to: dto.validTo ? new Date(dto.validTo) : null,
          approved_by: dto.approvedBy ?? existing.approved_by,
          created_by: user.userId,
        },
      }),
    ]);

    await this.publishEvent(TOPIC_CONTRACT_UPDATED, newContract, user);

    console.log(
      `[ContractService] Contract updated: ${newContract.name} v${newContract.version} (${newContract.id}), previous v${existing.version} archived`,
    );
    return { data: this.toEntity(newContract) };
  }

  // -- Tenant Filtering --

  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return {
          OR: [
            { tenant_id: user.tenantId },
            { status: 'ACTIVE' },
          ],
        };
      case TenantLevel.MEMBER_STATE:
        return {
          OR: [
            { tenant_id: user.tenantId },
            { status: 'ACTIVE' },
          ],
        };
      default:
        return { tenant_id: user.tenantId };
    }
  }

  private verifyTenantAccess(
    user: AuthenticatedUser,
    contractTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }
    if (contractTenantId === user.tenantId) {
      return;
    }
    throw new HttpError(404, 'Contract not found');
  }

  // -- Kafka Events --

  private async publishEvent(
    topic: string,
    contract: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(topic, contract.id as string, contract, headers);
    } catch (error) {
      console.error(
        `[ContractService] Failed to publish ${topic} for contract ${contract.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // -- Mapping --

  toEntity(row: {
    id: string;
    tenant_id: string;
    name: string;
    domain: string;
    data_owner: string;
    data_steward: string;
    purpose: string;
    officiality_level: string;
    schema: unknown;
    frequency: string;
    timeliness_sla: number;
    quality_sla: unknown;
    classification: string;
    exchange_mechanism: string;
    version: number;
    status: string;
    valid_from: Date;
    valid_to: Date | null;
    approved_by: string;
    created_by: string;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
  }): DataContractEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      domain: row.domain,
      dataOwner: row.data_owner,
      dataSteward: row.data_steward,
      purpose: row.purpose,
      officialityLevel: row.officiality_level as DataContractEntity['officialityLevel'],
      schema: row.schema,
      frequency: row.frequency as DataContractEntity['frequency'],
      timelinessSla: row.timeliness_sla,
      qualitySla: row.quality_sla as DataContractEntity['qualitySla'],
      classification: row.classification as DataContractEntity['classification'],
      exchangeMechanism: row.exchange_mechanism as DataContractEntity['exchangeMechanism'],
      version: row.version,
      status: row.status as DataContractEntity['status'],
      validFrom: row.valid_from,
      validTo: row.valid_to,
      approvedBy: row.approved_by,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
