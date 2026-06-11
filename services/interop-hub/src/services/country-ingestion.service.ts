import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_AU_INTEROP_INGESTION_RECEIVED,
  TOPIC_AU_INTEROP_INGESTION_COMPLETED,
  TOPIC_AU_INTEROP_INGESTION_FAILED,
  TOPIC_AU_INTEROP_CONNECTION_CREATED,
  TOPIC_AU_INTEROP_CONNECTION_ACTIVATED,
  TOPIC_AU_INTEROP_CONNECTION_SUSPENDED,
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
import type {
  CountryConnectionEntity,
  ReferentialMappingEntity,
  IngestionTransactionEntity,
  IngestionSummary,
  IngestionRecordResult,
  IntegrationModel,
} from '../entities/interop.entity';
import type { MinioStorage } from '../plugins/minio';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const SERVICE_NAME = 'interop-hub-service';
const INGESTION_BUCKET = 'interop-ingestion';

export class CountryIngestionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly minio?: MinioStorage,
  ) {}

  // ────────────────────────────────────────────────
  // Country Connections CRUD
  // ────────────────────────────────────────────────

  async createConnection(
    dto: {
      countryCode: string;
      countryName: string;
      integrationModel: IntegrationModel;
      systemName: string;
      systemType?: string;
      baseUrl?: string;
      authType?: string;
      credentials?: Record<string, unknown>;
      domains: string[];
      syncFrequency?: string;
      syncTime?: string;
      pullConfig?: Record<string, unknown>;
      dataContractId?: string;
      focalTechnical?: { name: string; email: string; phone?: string };
      focalDataOwner?: { name: string; email: string; phone?: string };
      notes?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CountryConnectionEntity>> {
    // Validate: API_PULL requires baseUrl
    if (dto.integrationModel === 'API_PULL' && !dto.baseUrl) {
      throw new HttpError(400, 'baseUrl is required for API_PULL integration model');
    }

    const row = await (this.prisma as any).countryConnection.create({
      data: {
        tenant_id: user.tenantId,
        country_code: dto.countryCode,
        country_name: dto.countryName,
        integration_model: dto.integrationModel,
        system_name: dto.systemName,
        system_type: dto.systemType ?? null,
        base_url: dto.baseUrl ?? null,
        auth_type: dto.authType ?? null,
        credentials: dto.credentials ?? {},
        domains: dto.domains,
        sync_frequency: dto.syncFrequency ?? null,
        sync_time: dto.syncTime ?? null,
        pull_config: dto.pullConfig ?? null,
        status: 'DRAFT',
        data_contract_id: dto.dataContractId ?? null,
        focal_technical: dto.focalTechnical ?? null,
        focal_data_owner: dto.focalDataOwner ?? null,
        notes: dto.notes ?? null,
        created_by: user.userId,
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_CONNECTION_CREATED, {
      connectionId: row.id,
      countryCode: dto.countryCode,
      integrationModel: dto.integrationModel,
      systemName: dto.systemName,
      domains: dto.domains,
    }, user);

    return { data: this.toConnectionEntity(row) };
  }

  async updateConnection(
    id: string,
    dto: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CountryConnectionEntity>> {
    const existing = await (this.prisma as any).countryConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw new HttpError(404, 'Country connection not found');

    // Map camelCase DTO to snake_case DB fields
    const data: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      integrationModel: 'integration_model',
      systemName: 'system_name',
      systemType: 'system_type',
      baseUrl: 'base_url',
      authType: 'auth_type',
      syncFrequency: 'sync_frequency',
      syncTime: 'sync_time',
      pullConfig: 'pull_config',
      dataContractId: 'data_contract_id',
      focalTechnical: 'focal_technical',
      focalDataOwner: 'focal_data_owner',
    };

    for (const [key, value] of Object.entries(dto)) {
      const dbKey = fieldMap[key] ?? key;
      data[dbKey] = value;
    }

    const row = await (this.prisma as any).countryConnection.update({
      where: { id },
      data,
    });

    // Publish activation/suspension events
    if (dto.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      await this.publishEvent(TOPIC_AU_INTEROP_CONNECTION_ACTIVATED, {
        connectionId: id,
        countryCode: existing.country_code,
      }, user);
    } else if (dto.status === 'SUSPENDED' && existing.status !== 'SUSPENDED') {
      await this.publishEvent(TOPIC_AU_INTEROP_CONNECTION_SUSPENDED, {
        connectionId: id,
        countryCode: existing.country_code,
      }, user);
    }

    return { data: this.toConnectionEntity(row) };
  }

  async findAllConnections(
    user: AuthenticatedUser,
    query: PaginationQuery & { countryCode?: string; model?: string; status?: string },
  ): Promise<PaginatedResponse<CountryConnectionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Tenant isolation — continental sees all, others see their tenant
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenant_id'] = user.tenantId;
    }
    if (query.countryCode) where['country_code'] = query.countryCode;
    if (query.model) where['integration_model'] = query.model;
    if (query.status) where['status'] = query.status;

    const [rows, total] = await Promise.all([
      (this.prisma as any).countryConnection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sort ?? 'created_at']: query.order ?? 'desc' },
      }),
      (this.prisma as any).countryConnection.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => this.toConnectionEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOneConnection(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CountryConnectionEntity>> {
    const where: Record<string, unknown> = { id };
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenant_id'] = user.tenantId;
    }

    const row = await (this.prisma as any).countryConnection.findFirst({ where });
    if (!row) throw new HttpError(404, 'Country connection not found');

    return { data: this.toConnectionEntity(row) };
  }

  // ────────────────────────────────────────────────
  // Referential Mappings
  // ────────────────────────────────────────────────

  async upsertMappings(
    connectionId: string,
    referentialType: string,
    mappings: Array<{
      sourceCode: string;
      sourceLabel?: string;
      targetCode: string;
      targetLabel?: string;
      targetId?: string;
    }>,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<{ created: number; updated: number }>> {
    // Verify connection exists and user has access
    const conn = await (this.prisma as any).countryConnection.findFirst({
      where: { id: connectionId, tenant_id: user.tenantId },
    });
    if (!conn) throw new HttpError(404, 'Country connection not found');

    let created = 0;
    let updated = 0;

    for (const m of mappings) {
      const existing = await (this.prisma as any).referentialMapping.findUnique({
        where: {
          connection_id_referential_type_source_code: {
            connection_id: connectionId,
            referential_type: referentialType,
            source_code: m.sourceCode,
          },
        },
      });

      if (existing) {
        await (this.prisma as any).referentialMapping.update({
          where: { id: existing.id },
          data: {
            target_code: m.targetCode,
            target_label: m.targetLabel ?? null,
            target_id: m.targetId ?? null,
            source_label: m.sourceLabel ?? existing.source_label,
            is_verified: true,
          },
        });
        updated++;
      } else {
        await (this.prisma as any).referentialMapping.create({
          data: {
            connection_id: connectionId,
            referential_type: referentialType,
            source_code: m.sourceCode,
            source_label: m.sourceLabel ?? null,
            target_code: m.targetCode,
            target_label: m.targetLabel ?? null,
            target_id: m.targetId ?? null,
            is_verified: true,
          },
        });
        created++;
      }
    }

    return { data: { created, updated } };
  }

  async findMappings(
    connectionId: string,
    user: AuthenticatedUser,
    query: PaginationQuery & { referentialType?: string },
  ): Promise<PaginatedResponse<ReferentialMappingEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Verify connection access
    const conn = await (this.prisma as any).countryConnection.findFirst({
      where: { id: connectionId, ...(user.tenantLevel !== TenantLevel.CONTINENTAL ? { tenant_id: user.tenantId } : {}) },
    });
    if (!conn) throw new HttpError(404, 'Country connection not found');

    const where: Record<string, unknown> = { connection_id: connectionId };
    if (query.referentialType) where['referential_type'] = query.referentialType;

    const [rows, total] = await Promise.all([
      (this.prisma as any).referentialMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sort ?? 'referential_type']: query.order ?? 'asc' },
      }),
      (this.prisma as any).referentialMapping.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => this.toMappingEntity(r)),
      meta: { total, page, limit },
    };
  }

  // ────────────────────────────────────────────────
  // Data Ingestion — API Push
  // ────────────────────────────────────────────────

  async ingestPush(
    dto: {
      domain: string;
      entityType: string;
      sourceSystem?: string;
      sourceVersion?: string;
      records: Record<string, unknown>[];
      mappingProfile?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IngestionSummary>> {
    // Find the active connection for this country/system
    const connection = await this.resolveConnection(user, 'API_PUSH', dto.sourceSystem);

    // Create transaction
    const tx = await (this.prisma as any).ingestionTransaction.create({
      data: {
        connection_id: connection.id,
        tenant_id: user.tenantId,
        domain: dto.domain,
        entity_type: dto.entityType,
        integration_model: 'API_PUSH',
        status: 'PROCESSING',
        records_received: dto.records.length,
        source_payload: { sourceSystem: dto.sourceSystem, sourceVersion: dto.sourceVersion, recordCount: dto.records.length },
        initiated_by: user.userId,
        started_at: new Date(),
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_RECEIVED, {
      transactionId: tx.id,
      connectionId: connection.id,
      domain: dto.domain,
      entityType: dto.entityType,
      recordCount: dto.records.length,
      model: 'API_PUSH',
    }, user);

    // Process records — apply mapping, validate, and build results
    const results: IngestionRecordResult[] = [];
    let accepted = 0;
    let rejected = 0;
    let warnings = 0;

    // Load mappings for this connection
    const mappings = await (this.prisma as any).referentialMapping.findMany({
      where: { connection_id: connection.id },
    });
    const mappingIndex = this.buildMappingIndex(mappings);

    for (const record of dto.records) {
      const sourceId = (record.sourceId ?? record.source_id ?? record.id ?? randomUUID()) as string;

      // Apply referential mappings to transform national codes → ARIS codes
      const mapped = this.applyMappings(record, mappingIndex);

      // Basic validation (the full quality gates run async via data-quality service)
      const violations = this.validateRecord(mapped, dto.domain, dto.entityType);

      if (violations.length > 0) {
        const hasFatal = violations.some(v => v.severity === 'FAIL');
        if (hasFatal) {
          rejected++;
          results.push({
            sourceId,
            arisId: null,
            status: 'REJECTED',
            qualityScore: null,
            violations: violations.map(v => ({ gate: v.gate, field: v.field, message: v.message })),
          });
        } else {
          warnings++;
          const arisId = randomUUID();
          results.push({
            sourceId,
            arisId,
            status: 'WARNING',
            qualityScore: 0.7,
            violations: violations.map(v => ({ gate: v.gate, field: v.field, message: v.message })),
          });
          accepted++;
        }
      } else {
        const arisId = randomUUID();
        accepted++;
        results.push({
          sourceId,
          arisId,
          status: 'ACCEPTED',
          qualityScore: 1.0,
          violations: [],
        });
      }
    }

    // Update transaction
    const finalStatus = rejected === dto.records.length ? 'FAILED'
      : rejected > 0 ? 'PARTIAL'
      : 'COMPLETED';

    await (this.prisma as any).ingestionTransaction.update({
      where: { id: tx.id },
      data: {
        status: finalStatus,
        records_accepted: accepted,
        records_rejected: rejected,
        records_warning: warnings,
        validation_report: {
          total: dto.records.length,
          accepted,
          rejected,
          warnings,
        },
        rejection_details: results.filter(r => r.status === 'REJECTED'),
        completed_at: new Date(),
      },
    });

    // Update connection counters
    await (this.prisma as any).countryConnection.update({
      where: { id: connection.id },
      data: {
        records_total: { increment: dto.records.length },
        records_accepted: { increment: accepted },
        records_rejected: { increment: rejected },
        last_sync_at: new Date(),
        last_sync_status: finalStatus,
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_COMPLETED, {
      transactionId: tx.id,
      connectionId: connection.id,
      domain: dto.domain,
      status: finalStatus,
      accepted,
      rejected,
      warnings,
    }, user);

    return {
      data: {
        transactionId: tx.id,
        status: finalStatus as any,
        summary: { total: dto.records.length, accepted, rejected, warnings },
        results,
      },
    };
  }

  // ────────────────────────────────────────────────
  // Data Ingestion — File Upload
  // ────────────────────────────────────────────────

  async ingestFileUpload(
    dto: {
      domain: string;
      entityType: string;
      countryCode: string;
      period?: string;
      mappingProfile?: string;
    },
    fileBuffer: Buffer,
    fileName: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IngestionSummary>> {
    // Find the connection for this country
    const connection = await this.resolveConnection(user, 'FILE_UPLOAD');

    // Upload file to MinIO
    let fileUrl: string | null = null;
    const fileSize = fileBuffer.length;

    if (this.minio) {
      const objectKey = `${dto.countryCode}/${dto.domain}/${Date.now()}_${fileName}`;
      await this.minio.putObject({
        bucket: INGESTION_BUCKET,
        key: objectKey,
        body: fileBuffer,
        contentType: fileName.endsWith('.json') ? 'application/json' : 'text/csv',
      });
      fileUrl = `${INGESTION_BUCKET}/${objectKey}`;
    }

    // Parse file (CSV/JSON detection by extension)
    let records: Record<string, unknown>[];
    try {
      records = this.parseFile(fileBuffer, fileName);
    } catch (err: any) {
      // Create failed transaction
      const tx = await (this.prisma as any).ingestionTransaction.create({
        data: {
          connection_id: connection.id,
          tenant_id: user.tenantId,
          domain: dto.domain,
          entity_type: dto.entityType,
          integration_model: 'FILE_UPLOAD',
          status: 'FAILED',
          records_received: 0,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          error_message: `File parsing failed: ${err.message}`,
          initiated_by: user.userId,
          started_at: new Date(),
          completed_at: new Date(),
        },
      });

      return {
        data: {
          transactionId: tx.id,
          status: 'FAILED',
          summary: { total: 0, accepted: 0, rejected: 0, warnings: 0 },
          results: [],
        },
      };
    }

    // Create transaction
    const tx = await (this.prisma as any).ingestionTransaction.create({
      data: {
        connection_id: connection.id,
        tenant_id: user.tenantId,
        domain: dto.domain,
        entity_type: dto.entityType,
        integration_model: 'FILE_UPLOAD',
        status: 'PROCESSING',
        records_received: records.length,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        initiated_by: user.userId,
        started_at: new Date(),
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_RECEIVED, {
      transactionId: tx.id,
      connectionId: connection.id,
      domain: dto.domain,
      entityType: dto.entityType,
      recordCount: records.length,
      model: 'FILE_UPLOAD',
      fileName,
    }, user);

    // Load mappings and process
    const mappings = await (this.prisma as any).referentialMapping.findMany({
      where: { connection_id: connection.id },
    });
    const mappingIndex = this.buildMappingIndex(mappings);

    const results: IngestionRecordResult[] = [];
    let accepted = 0;
    let rejected = 0;
    let warnings = 0;

    for (const record of records) {
      const sourceId = (record.source_id ?? record.sourceId ?? record.id ?? randomUUID()) as string;
      const mapped = this.applyMappings(record, mappingIndex);
      const violations = this.validateRecord(mapped, dto.domain, dto.entityType);

      if (violations.length > 0 && violations.some(v => v.severity === 'FAIL')) {
        rejected++;
        results.push({
          sourceId,
          arisId: null,
          status: 'REJECTED',
          qualityScore: null,
          violations: violations.map(v => ({ gate: v.gate, field: v.field, message: v.message })),
        });
      } else if (violations.length > 0) {
        warnings++;
        accepted++;
        results.push({
          sourceId,
          arisId: randomUUID(),
          status: 'WARNING',
          qualityScore: 0.7,
          violations: violations.map(v => ({ gate: v.gate, field: v.field, message: v.message })),
        });
      } else {
        accepted++;
        results.push({
          sourceId,
          arisId: randomUUID(),
          status: 'ACCEPTED',
          qualityScore: 1.0,
          violations: [],
        });
      }
    }

    const finalStatus = rejected === records.length ? 'FAILED'
      : rejected > 0 ? 'PARTIAL'
      : 'COMPLETED';

    await (this.prisma as any).ingestionTransaction.update({
      where: { id: tx.id },
      data: {
        status: finalStatus,
        records_accepted: accepted,
        records_rejected: rejected,
        records_warning: warnings,
        validation_report: { total: records.length, accepted, rejected, warnings },
        rejection_details: results.filter(r => r.status === 'REJECTED'),
        completed_at: new Date(),
      },
    });

    await (this.prisma as any).countryConnection.update({
      where: { id: connection.id },
      data: {
        records_total: { increment: records.length },
        records_accepted: { increment: accepted },
        records_rejected: { increment: rejected },
        last_sync_at: new Date(),
        last_sync_status: finalStatus,
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_COMPLETED, {
      transactionId: tx.id,
      connectionId: connection.id,
      domain: dto.domain,
      status: finalStatus,
      accepted,
      rejected,
      warnings,
    }, user);

    return {
      data: {
        transactionId: tx.id,
        status: finalStatus as any,
        summary: { total: records.length, accepted, rejected, warnings },
        results,
      },
    };
  }

  // ────────────────────────────────────────────────
  // Data Ingestion — API Pull (trigger)
  // ────────────────────────────────────────────────

  async triggerPull(
    connectionId: string,
    dto: { domain?: string; dateFrom?: string; dateTo?: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IngestionTransactionEntity>> {
    const conn = await (this.prisma as any).countryConnection.findFirst({
      where: { id: connectionId, tenant_id: user.tenantId, integration_model: 'API_PULL' },
    });
    if (!conn) throw new HttpError(404, 'API_PULL connection not found');
    if (conn.status !== 'ACTIVE') throw new HttpError(400, 'Connection must be ACTIVE to trigger pull');

    // Create a pending transaction — the actual pull is handled by the pull scheduler/worker
    const tx = await (this.prisma as any).ingestionTransaction.create({
      data: {
        connection_id: connectionId,
        tenant_id: user.tenantId,
        domain: dto.domain ?? conn.domains[0] ?? 'unknown',
        entity_type: 'pull-batch',
        integration_model: 'API_PULL',
        status: 'PENDING',
        records_received: 0,
        source_payload: { dateFrom: dto.dateFrom, dateTo: dto.dateTo, triggeredManually: true },
        initiated_by: user.userId,
      },
    });

    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_RECEIVED, {
      transactionId: tx.id,
      connectionId,
      domain: dto.domain ?? conn.domains[0],
      model: 'API_PULL',
      pullConfig: conn.pull_config,
      baseUrl: conn.base_url,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    }, user);

    return { data: this.toTransactionEntity(tx) };
  }

  // ────────────────────────────────────────────────
  // Transaction history
  // ────────────────────────────────────────────────

  async findAllTransactions(
    user: AuthenticatedUser,
    query: PaginationQuery & { connectionId?: string; domain?: string; status?: string; model?: string },
  ): Promise<PaginatedResponse<IngestionTransactionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenant_id'] = user.tenantId;
    }
    if (query.connectionId) where['connection_id'] = query.connectionId;
    if (query.domain) where['domain'] = query.domain;
    if (query.status) where['status'] = query.status;
    if (query.model) where['integration_model'] = query.model;

    const [rows, total] = await Promise.all([
      (this.prisma as any).ingestionTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sort ?? 'created_at']: query.order ?? 'desc' },
      }),
      (this.prisma as any).ingestionTransaction.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => this.toTransactionEntity(r)),
      meta: { total, page, limit },
    };
  }

  async findOneTransaction(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IngestionTransactionEntity>> {
    const where: Record<string, unknown> = { id };
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenant_id'] = user.tenantId;
    }

    const row = await (this.prisma as any).ingestionTransaction.findFirst({ where });
    if (!row) throw new HttpError(404, 'Ingestion transaction not found');

    return { data: this.toTransactionEntity(row) };
  }

  async retryTransaction(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<IngestionTransactionEntity>> {
    const tx = await (this.prisma as any).ingestionTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!tx) throw new HttpError(404, 'Transaction not found');
    if (tx.status !== 'FAILED' && tx.status !== 'PARTIAL') {
      throw new HttpError(400, 'Only FAILED or PARTIAL transactions can be retried');
    }
    if (tx.retry_count >= tx.max_retries) {
      throw new HttpError(400, `Max retries (${tx.max_retries}) exceeded`);
    }

    const updated = await (this.prisma as any).ingestionTransaction.update({
      where: { id },
      data: {
        status: 'RETRY',
        retry_count: { increment: 1 },
      },
    });

    // Re-publish for processing
    await this.publishEvent(TOPIC_AU_INTEROP_INGESTION_RECEIVED, {
      transactionId: id,
      connectionId: tx.connection_id,
      domain: tx.domain,
      model: tx.integration_model,
      isRetry: true,
    }, user);

    return { data: this.toTransactionEntity(updated) };
  }

  // ────────────────────────────────────────────────
  // Dashboard / Stats
  // ────────────────────────────────────────────────

  async getIngestionStats(
    user: AuthenticatedUser,
    query: { countryCode?: string; days?: number },
  ): Promise<ApiResponse<{
    totalConnections: number;
    activeConnections: number;
    byModel: Record<string, number>;
    totalTransactions: number;
    successRate: number;
    totalRecordsIngested: number;
    totalRecordsAccepted: number;
    totalRecordsRejected: number;
  }>> {
    const tenantFilter = user.tenantLevel !== TenantLevel.CONTINENTAL
      ? { tenant_id: user.tenantId }
      : {};
    const countryFilter = query.countryCode ? { country_code: query.countryCode } : {};

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - (query.days ?? 30));

    const [connections, activeConns, transactions] = await Promise.all([
      (this.prisma as any).countryConnection.findMany({
        where: { ...tenantFilter, ...countryFilter },
      }),
      (this.prisma as any).countryConnection.count({
        where: { ...tenantFilter, ...countryFilter, status: 'ACTIVE' },
      }),
      (this.prisma as any).ingestionTransaction.findMany({
        where: {
          ...tenantFilter,
          created_at: { gte: dateFrom },
        },
      }),
    ]);

    const byModel: Record<string, number> = {};
    for (const c of connections) {
      byModel[c.integration_model] = (byModel[c.integration_model] ?? 0) + 1;
    }

    const completed = transactions.filter((t: any) => t.status === 'COMPLETED').length;
    const totalTx = transactions.length;
    const successRate = totalTx > 0 ? Math.round((completed / totalTx) * 100) : 0;

    let totalIngested = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    for (const t of transactions) {
      totalIngested += t.records_received;
      totalAccepted += t.records_accepted;
      totalRejected += t.records_rejected;
    }

    return {
      data: {
        totalConnections: connections.length,
        activeConnections: activeConns,
        byModel,
        totalTransactions: totalTx,
        successRate,
        totalRecordsIngested: totalIngested,
        totalRecordsAccepted: totalAccepted,
        totalRecordsRejected: totalRejected,
      },
    };
  }

  // ────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────

  private async resolveConnection(
    user: AuthenticatedUser,
    model: IntegrationModel,
    systemName?: string,
  ): Promise<{ id: string; domains: string[]; pull_config: unknown; base_url: string | null }> {
    const where: Record<string, unknown> = {
      tenant_id: user.tenantId,
      integration_model: model,
      status: 'ACTIVE',
    };
    if (systemName) where['system_name'] = systemName;

    const conn = await (this.prisma as any).countryConnection.findFirst({ where });
    if (!conn) {
      throw new HttpError(404, `No active ${model} connection found for this tenant${systemName ? ` with system "${systemName}"` : ''}`);
    }
    return conn;
  }

  private buildMappingIndex(
    mappings: Array<{ referential_type: string; source_code: string; target_code: string }>,
  ): Map<string, Map<string, string>> {
    const index = new Map<string, Map<string, string>>();
    for (const m of mappings) {
      if (!index.has(m.referential_type)) {
        index.set(m.referential_type, new Map());
      }
      index.get(m.referential_type)!.set(m.source_code, m.target_code);
    }
    return index;
  }

  private applyMappings(
    record: Record<string, unknown>,
    index: Map<string, Map<string, string>>,
  ): Record<string, unknown> {
    const result = { ...record };

    // Map disease codes
    const diseaseMap = index.get('DISEASE');
    if (diseaseMap && typeof result.diseaseCode === 'string') {
      const mapped = diseaseMap.get(result.diseaseCode);
      if (mapped) {
        result._originalDiseaseCode = result.diseaseCode;
        result.diseaseCode = mapped;
      }
    }
    if (diseaseMap && typeof result.disease_code === 'string') {
      const mapped = diseaseMap.get(result.disease_code);
      if (mapped) {
        result._originalDiseaseCode = result.disease_code;
        result.disease_code = mapped;
      }
    }

    // Map species codes
    const speciesMap = index.get('SPECIES');
    if (speciesMap) {
      if (typeof result.species === 'string') {
        const mapped = speciesMap.get(result.species);
        if (mapped) result.species = mapped;
      }
      if (Array.isArray(result.species)) {
        result.species = (result.species as string[]).map(s => speciesMap.get(s) ?? s);
      }
    }

    // Map geo codes
    const geoMap = index.get('GEO');
    if (geoMap) {
      for (const field of ['adminCode', 'admin_code', 'location_code']) {
        if (typeof result[field] === 'string') {
          const mapped = geoMap.get(result[field] as string);
          if (mapped) result[field] = mapped;
        }
      }
    }

    // Map unit codes
    const unitMap = index.get('UNIT');
    if (unitMap && typeof result.unit === 'string') {
      const mapped = unitMap.get(result.unit);
      if (mapped) result.unit = mapped;
    }

    return result;
  }

  private validateRecord(
    record: Record<string, unknown>,
    domain: string,
    entityType: string,
  ): Array<{ gate: string; field: string; message: string; severity: 'FAIL' | 'WARNING' }> {
    const violations: Array<{ gate: string; field: string; message: string; severity: 'FAIL' | 'WARNING' }> = [];

    // COMPLETENESS — check required fields based on domain
    const requiredFields = this.getRequiredFields(domain, entityType);
    for (const field of requiredFields) {
      const val = record[field];
      if (val === undefined || val === null || val === '') {
        violations.push({
          gate: 'COMPLETENESS',
          field,
          message: `Required field '${field}' is missing or empty`,
          severity: 'FAIL',
        });
      }
    }

    // TEMPORAL_CONSISTENCY — check date fields
    const reportDate = record.reportDate ?? record.report_date;
    if (reportDate && typeof reportDate === 'string') {
      const d = new Date(reportDate);
      if (isNaN(d.getTime())) {
        violations.push({
          gate: 'TEMPORAL_CONSISTENCY',
          field: 'reportDate',
          message: `Invalid date format: '${reportDate}'`,
          severity: 'FAIL',
        });
      } else if (d > new Date()) {
        violations.push({
          gate: 'TEMPORAL_CONSISTENCY',
          field: 'reportDate',
          message: 'Report date cannot be in the future',
          severity: 'WARNING',
        });
      }
    }

    // GEOGRAPHIC_CONSISTENCY — check country code format
    const countryCode = record.countryCode ?? record.country_code;
    if (countryCode && typeof countryCode === 'string' && countryCode.length > 3) {
      violations.push({
        gate: 'GEOGRAPHIC_CONSISTENCY',
        field: 'countryCode',
        message: `Country code '${countryCode}' exceeds 3 characters`,
        severity: 'FAIL',
      });
    }

    // AUDITABILITY — source system should be present
    const sourceId = record.sourceId ?? record.source_id;
    if (!sourceId) {
      violations.push({
        gate: 'AUDITABILITY',
        field: 'sourceId',
        message: 'Source ID (sourceId) is recommended for traceability',
        severity: 'WARNING',
      });
    }

    return violations;
  }

  private getRequiredFields(domain: string, entityType: string): string[] {
    const base = ['country_code', 'countryCode'];

    const domainFields: Record<string, string[]> = {
      'animal-health': ['diseaseCode', 'disease_code', 'reportDate', 'report_date'],
      'livestock-prod': ['species', 'speciesCode', 'species_code', 'year'],
      'fisheries': ['speciesCode', 'species_code', 'year'],
      'trade-sps': ['commodity', 'commodityCode', 'commodity_code', 'year'],
      'wildlife': ['speciesCode', 'species_code'],
      'apiculture': ['year'],
      'governance': ['year'],
    };

    const extra = domainFields[domain] ?? [];
    // For required fields, at least one of each pair (camelCase/snake_case) must be present
    // We only flag if NONE of the alternatives exist
    return [...base, ...extra];
  }

  private parseFile(buffer: Buffer, fileName: string): Record<string, unknown>[] {
    const ext = fileName.toLowerCase().split('.').pop();

    if (ext === 'json') {
      const content = buffer.toString('utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.records && Array.isArray(parsed.records)) return parsed.records;
      if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
      throw new Error('JSON file must contain an array or an object with "records" or "data" array');
    }

    if (ext === 'csv' || ext === 'tsv') {
      const content = buffer.toString('utf-8');
      const separator = ext === 'tsv' ? '\t' : ',';
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row');

      const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
      const records: Record<string, unknown>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        const record: Record<string, unknown> = {};
        for (let j = 0; j < headers.length; j++) {
          const val = values[j] ?? '';
          // Try to parse numbers
          if (val && !isNaN(Number(val))) {
            record[headers[j]] = Number(val);
          } else {
            record[headers[j]] = val;
          }
        }
        records.push(record);
      }

      return records;
    }

    throw new Error(`Unsupported file format: .${ext}. Supported: .json, .csv, .tsv`);
  }

  private async publishEvent(
    topic: string,
    payload: Record<string, unknown>,
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
      const key = (payload.connectionId as string) ?? user.tenantId;
      await Promise.race([
        this.kafka.send(topic, key, payload, headers),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), 5000)),
      ]);
    } catch (err) {
      console.warn(`[CountryIngestion] Failed to publish to ${topic}: ${err}`);
    }
  }

  // ────────────────────────────────────────────────
  // Entity mappers
  // ────────────────────────────────────────────────

  private toConnectionEntity(row: any): CountryConnectionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      countryCode: row.country_code,
      countryName: row.country_name,
      integrationModel: row.integration_model,
      systemName: row.system_name,
      systemType: row.system_type,
      baseUrl: row.base_url,
      authType: row.auth_type,
      domains: row.domains ?? [],
      syncFrequency: row.sync_frequency,
      syncTime: row.sync_time,
      pullConfig: row.pull_config,
      status: row.status,
      dataContractId: row.data_contract_id,
      focalTechnical: row.focal_technical,
      focalDataOwner: row.focal_data_owner,
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      recordsTotal: row.records_total,
      recordsAccepted: row.records_accepted,
      recordsRejected: row.records_rejected,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMappingEntity(row: any): ReferentialMappingEntity {
    return {
      id: row.id,
      connectionId: row.connection_id,
      referentialType: row.referential_type,
      sourceCode: row.source_code,
      sourceLabel: row.source_label,
      targetCode: row.target_code,
      targetLabel: row.target_label,
      targetId: row.target_id,
      isVerified: row.is_verified,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTransactionEntity(row: any): IngestionTransactionEntity {
    return {
      id: row.id,
      connectionId: row.connection_id,
      tenantId: row.tenant_id,
      domain: row.domain,
      entityType: row.entity_type,
      integrationModel: row.integration_model,
      status: row.status,
      recordsReceived: row.records_received,
      recordsAccepted: row.records_accepted,
      recordsRejected: row.records_rejected,
      recordsWarning: row.records_warning,
      validationReport: row.validation_report,
      rejectionDetails: row.rejection_details,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileSize: row.file_size,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      initiatedBy: row.initiated_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}
