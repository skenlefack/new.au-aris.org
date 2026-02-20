import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
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
import { PrismaService } from '../prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import type { DataContractEntity } from './entities/contract.entity';

const SERVICE_NAME = 'data-contract-service';
const TOPIC_CONTRACT_CREATED = 'sys.contract.created.v1';
const TOPIC_CONTRACT_UPDATED = 'sys.contract.updated.v1';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(
    dto: CreateContractDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    // Check duplicate name+version within tenant
    const existing = await this.prisma.dataContract.findFirst({
      where: {
        tenant_id: user.tenantId,
        name: dto.name,
        version: 1,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Contract "${dto.name}" version 1 already exists for this tenant`,
      );
    }

    const contract = await this.prisma.dataContract.create({
      data: {
        tenant_id: user.tenantId,
        name: dto.name,
        domain: dto.domain,
        data_owner: dto.dataOwner,
        data_steward: dto.dataSteward,
        purpose: dto.purpose,
        officiality_level: dto.officialityLevel,
        schema: dto.schema as Prisma.InputJsonValue,
        frequency: dto.frequency,
        timeliness_sla: dto.timelinessSla,
        quality_sla: dto.qualitySla as unknown as Prisma.InputJsonValue,
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

    this.logger.log(`Contract created: ${contract.name} v${contract.version} (${contract.id})`);
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

    const where: Prisma.DataContractWhereInput = {
      ...this.buildTenantFilter(user),
      ...(query.domain && { domain: query.domain }),
      ...(query.status && { status: query.status as Prisma.EnumContractStatusFilter }),
      ...(query.owner && { data_owner: { contains: query.owner, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.dataContract.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.dataContract.count({ where }),
    ]);

    return {
      data: data.map((c) => this.toEntity(c)),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    const contract = await this.prisma.dataContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${id} not found`);
    }

    this.verifyTenantAccess(user, contract.tenant_id);

    return { data: this.toEntity(contract) };
  }

  async update(
    id: string,
    dto: UpdateContractDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DataContractEntity>> {
    const existing = await this.prisma.dataContract.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Contract ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    if (existing.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot update an archived contract');
    }

    // Archive the current version and create a new one
    const latest = await this.prisma.dataContract.findFirst({
      where: {
        tenant_id: existing.tenant_id,
        name: existing.name,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? existing.version) + 1;

    const [, newContract] = await this.prisma.$transaction([
      // Archive the existing active version
      this.prisma.dataContract.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          valid_to: new Date(),
          updated_by: user.userId,
        },
      }),
      // Create the new version
      this.prisma.dataContract.create({
        data: {
          tenant_id: existing.tenant_id,
          name: dto.name ?? existing.name,
          domain: dto.domain ?? existing.domain,
          data_owner: dto.dataOwner ?? existing.data_owner,
          data_steward: dto.dataSteward ?? existing.data_steward,
          purpose: dto.purpose ?? existing.purpose,
          officiality_level: dto.officialityLevel ?? existing.officiality_level,
          schema: (dto.schema ?? existing.schema) as Prisma.InputJsonValue,
          frequency: dto.frequency ?? existing.frequency,
          timeliness_sla: dto.timelinessSla ?? existing.timeliness_sla,
          quality_sla: dto.qualitySla
            ? (dto.qualitySla as unknown as Prisma.InputJsonValue)
            : existing.quality_sla as Prisma.InputJsonValue,
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

    this.logger.log(
      `Contract updated: ${newContract.name} v${newContract.version} (${newContract.id}), previous v${existing.version} archived`,
    );
    return { data: this.toEntity(newContract) };
  }

  // ── Tenant Filtering ──

  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Prisma.DataContractWhereInput {
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
    throw new NotFoundException('Contract not found');
  }

  // ── Kafka Events ──

  private async publishEvent(
    topic: string,
    contract: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(topic, contract.id as string, contract, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for contract ${contract.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Mapping ──

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
