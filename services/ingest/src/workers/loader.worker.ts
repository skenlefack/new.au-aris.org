import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';
import { parseCsv } from '../parsers/csv.parser';
import { parseXlsx } from '../parsers/xlsx.parser';
import { parseJson } from '../parsers/json.parser';
import { transformRow, computeIdempotencyKey } from '../services/transformer.service';

const SERVICE_NAME = 'ingest-service';
const BATCH_SIZE = parseInt(process.env['INGEST_BATCH_SIZE'] ?? '50', 10);
const COLLECTE_URL = process.env['COLLECTE_URL'] ?? 'http://localhost:3011';

interface MappingConfirmedPayload {
  fileId: string;
  dryRun: boolean;
  tenantId: string;
  domainCode: string;
}

/**
 * Kafka consumer handler for `ingest.mapping.confirmed.v1`.
 * Executes dry-run or commit loading of data via Collecte sync API.
 */
export async function handleMappingConfirmed(
  payload: MappingConfirmedPayload,
  prisma: PrismaClient,
  kafka: StandaloneKafkaProducer,
  minio: MinioClient,
): Promise<void> {
  const { fileId, dryRun, tenantId } = payload;
  const startTime = Date.now();

  try {
    // Load file metadata + accepted proposal + campaign resolution
    const file = await (prisma as any).ingestFile.findUnique({ where: { id: fileId } });
    if (!file) throw new Error(`File ${fileId} not found`);

    const proposal = await (prisma as any).matchProposal.findFirst({
      where: { fileId, status: 'ACCEPTED' },
      include: { fieldMappings: true },
    });
    if (!proposal) throw new Error('No accepted proposal found');

    const resolution = await (prisma as any).campaignResolution.findUnique({
      where: { fileId },
    });
    if (!resolution?.campaignId) throw new Error('No campaign resolved');

    // Download and parse file
    const stream = await minio.getObject(file.minioBucket, file.minioKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as ArrayBuffer));
    }
    const buffer = Buffer.concat(chunks);

    const ext = (file.filename as string).toLowerCase().split('.').pop() ?? '';
    let columnHeaders: string[];
    let dataRows: string[][];

    if (ext === 'csv' || ext === 'tsv') {
      const sheet = await parseCsv(buffer);
      columnHeaders = sheet.headers;
      dataRows = sheet.dataRows;
    } else if (ext === 'xlsx' || ext === 'xls') {
      const sheets = await parseXlsx(buffer);
      columnHeaders = sheets[0]?.headers ?? [];
      dataRows = sheets[0]?.dataRows ?? [];
    } else {
      const sheet = parseJson(buffer);
      columnHeaders = sheet.headers;
      dataRows = sheet.dataRows;
    }

    // Create IngestRun record
    const run = await (prisma as any).ingestRun.create({
      data: {
        fileId,
        type: dryRun ? 'DRY_RUN' : 'COMMIT',
        totalRows: dataRows.length,
        status: 'RUNNING',
      },
    });

    let acceptedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    let warningCount = 0;

    // Process rows in batches
    for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
      const batchRows = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
      const submissions: Array<{
        id: string;
        campaignId: string;
        data: Record<string, unknown>;
        version: number;
      }> = [];

      for (let i = 0; i < batchRows.length; i++) {
        const rowIndex = batchStart + i;
        const row = batchRows[i];

        // Transform row using field mappings
        const data = transformRow(row, columnHeaders, proposal.fieldMappings);

        // R4: Compute idempotency key
        const idempotencyKey = computeIdempotencyKey(
          resolution.campaignId,
          proposal.templateId,
          data,
        );

        // Check for duplicates (against existing outcomes)
        const existingOutcome = await (prisma as any).rowOutcome.findFirst({
          where: { idempotencyKey, status: 'ACCEPTED' },
        });

        if (existingOutcome) {
          duplicateCount++;
          await (prisma as any).rowOutcome.create({
            data: {
              runId: run.id,
              rowIndex,
              idempotencyKey,
              status: 'DUPLICATE',
              reasons: [{ code: 'DUPLICATE', message: 'Row already loaded in a previous run' }],
            },
          });
          continue;
        }

        submissions.push({
          id: randomUUID(),
          campaignId: resolution.campaignId,
          data,
          version: 1,
        });

        // Store row outcome as pending
        await (prisma as any).rowOutcome.create({
          data: {
            runId: run.id,
            rowIndex,
            idempotencyKey,
            status: dryRun ? 'ACCEPTED' : 'ACCEPTED', // Updated below if rejected
          },
        });
      }

      if (submissions.length === 0) continue;

      if (dryRun) {
        // Dry-run: just count (don't call Collecte)
        acceptedCount += submissions.length;
        continue;
      }

      // R1: Load via Collecte sync API (not direct DB writes)
      try {
        const syncPayload = {
          submissions: submissions.map((s) => ({
            id: s.id,
            campaignId: s.campaignId,
            data: s.data,
            version: s.version,
            dataClassification: 'RESTRICTED',
          })),
          lastSyncAt: new Date(0).toISOString(),
        };

        const res = await fetch(`${COLLECTE_URL}/api/v1/collecte/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
            'X-Internal-Service': SERVICE_NAME,
          },
          body: JSON.stringify(syncPayload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error(`Collecte sync failed: ${res.status} ${(body.message as string) ?? ''}`);
        }

        const syncResult = await res.json() as {
          accepted: string[];
          rejected: Array<{ id: string; errors: Array<{ field: string; message: string }> }>;
        };

        acceptedCount += syncResult.accepted.length;
        rejectedCount += syncResult.rejected.length;

        // Update row outcomes for rejected submissions
        for (const rejection of syncResult.rejected) {
          await (prisma as any).rowOutcome.updateMany({
            where: { runId: run.id, submissionId: rejection.id },
            data: { status: 'REJECTED', reasons: rejection.errors },
          });
        }

        // Store submission IDs for accepted rows
        for (const subId of syncResult.accepted) {
          await (prisma as any).rowOutcome.updateMany({
            where: { runId: run.id, submissionId: null, status: 'ACCEPTED' },
            data: { submissionId: subId },
          });
        }

      } catch (err) {
        // Batch failed — mark all rows as rejected
        const errMsg = err instanceof Error ? err.message : String(err);
        rejectedCount += submissions.length;
        await (prisma as any).rowOutcome.updateMany({
          where: { runId: run.id, status: 'ACCEPTED', submissionId: null },
          data: { status: 'REJECTED', reasons: [{ code: 'BATCH_FAILED', message: errMsg }] },
        });
      }
    }

    // If dry-run, count all non-duplicate as accepted
    if (dryRun) {
      acceptedCount = dataRows.length - duplicateCount;
    }

    // Update run with final counts
    const durationMs = Date.now() - startTime;
    await (prisma as any).ingestRun.update({
      where: { id: run.id },
      data: {
        acceptedRows: acceptedCount,
        rejectedRows: rejectedCount,
        duplicateRows: duplicateCount,
        warningRows: warningCount,
        durationMs,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update file status
    if (!dryRun) {
      await (prisma as any).ingestFile.update({
        where: { id: fileId },
        data: { status: rejectedCount === dataRows.length ? 'FAILED' : 'COMMITTED' },
      });
    }

    // Publish load completed event
    const kafkaHeaders: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await Promise.race([
        kafka.send('ingest.load.completed.v1', fileId, {
          fileId,
          runId: run.id,
          type: dryRun ? 'DRY_RUN' : 'COMMIT',
          accepted: acceptedCount,
          rejected: rejectedCount,
          duplicates: duplicateCount,
          warnings: warningCount,
          durationMs,
          tenantId,
          domainCode: payload.domainCode,
        }, kafkaHeaders),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
    } catch { /* non-blocking */ }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await (prisma as any).ingestFile.update({
      where: { id: fileId },
      data: { status: 'FAILED', errorMessage: errorMsg },
    });
  }
}
