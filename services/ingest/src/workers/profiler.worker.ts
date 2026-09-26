import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { Client as MinioClient } from 'minio';
import type { KafkaHeaders } from '@aris/shared-types';
import { randomUUID } from 'crypto';
import { parseCsv } from '../parsers/csv.parser';
import { parseXlsx } from '../parsers/xlsx.parser';
import { parseJson } from '../parsers/json.parser';
import { profileColumns, computeStructureHash } from '../services/profiler.service';
import type { ParsedSheet } from '../parsers/types';

const SERVICE_NAME = 'ingest-service';

interface FileReceivedPayload {
  fileId: string;
  minioKey: string;
  minioBucket: string;
  tenantId: string;
  domainCode: string;
  userId: string;
  filename: string;
  mimeType: string;
}

/**
 * Kafka consumer handler for `ingest.file.received.v1`.
 * Downloads file from MinIO, parses it, profiles columns, stores results.
 */
export async function handleFileReceived(
  payload: FileReceivedPayload,
  prisma: PrismaClient,
  kafka: StandaloneKafkaProducer,
  minio: MinioClient,
): Promise<void> {
  const { fileId, minioKey, minioBucket, filename, mimeType } = payload;

  try {
    // Update status to PROFILING
    await (prisma as any).ingestFile.update({
      where: { id: fileId },
      data: { status: 'PROFILING' },
    });

    // Download file from MinIO as buffer (streaming parse requires buffer for xlsx)
    const stream = await minio.getObject(minioBucket, minioKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as ArrayBuffer));
    }
    const buffer = Buffer.concat(chunks);

    // Parse based on file type
    let sheets: ParsedSheet[];
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'csv' || ext === 'tsv' || mimeType === 'text/csv' || mimeType === 'text/plain') {
      sheets = [await parseCsv(buffer)];
    } else if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('ms-excel')) {
      sheets = await parseXlsx(buffer);
    } else if (ext === 'json' || mimeType === 'application/json') {
      sheets = [parseJson(buffer)];
    } else {
      throw new Error(`Unsupported file type: ${mimeType} (${ext})`);
    }

    // Profile first sheet (primary)
    const primarySheet = sheets[0];
    if (!primarySheet || primarySheet.headers.length === 0) {
      throw new Error('File contains no usable data');
    }

    const columns = profileColumns(primarySheet);
    const structureHash = computeStructureHash(columns);

    // Persist profile
    const profile = await (prisma as any).sourceProfile.create({
      data: {
        fileId,
        sheetCount: sheets.length,
        headerRow: primarySheet.headerRow,
        encoding: 'utf-8',
        delimiter: primarySheet.delimiter ?? null,
        rowCount: primarySheet.dataRows.length,
        structureHash,
      },
    });

    // Persist column profiles
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      await (prisma as any).columnProfile.create({
        data: {
          profileId: profile.id,
          sheetIndex: primarySheet.sheetIndex,
          columnIndex: i,
          rawName: col.rawName,
          normalizedName: col.normalizedName,
          inferredType: col.inferredType,
          cardinality: col.cardinality,
          nullRate: col.nullRate,
          minLength: col.minLength,
          maxLength: col.maxLength,
          sampleValues: col.sampleValues,
          detectedPatterns: col.detectedPatterns,
        },
      });
    }

    // Publish profile completed event
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: payload.tenantId,
      userId: payload.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka timeout')), 5000),
      );
      await Promise.race([
        kafka.send('ingest.profile.completed.v1', fileId, {
          fileId,
          profileId: profile.id,
          structureHash,
          rowCount: primarySheet.dataRows.length,
          columnCount: columns.length,
          columns: columns.map((c) => ({
            rawName: c.rawName,
            normalizedName: c.normalizedName,
            inferredType: c.inferredType,
            semanticConcept: null,
          })),
          tenantId: payload.tenantId,
          domainCode: payload.domainCode,
        }, headers),
        timeout,
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
