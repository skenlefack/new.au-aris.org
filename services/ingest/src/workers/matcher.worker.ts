import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import { randomUUID } from 'crypto';
import { computeMatches, type FormCandidate } from '../services/matcher.service';
import type { ColumnStats } from '../parsers/types';

const SERVICE_NAME = 'ingest-service';

// FormBuilder API base URL (internal)
const FORM_BUILDER_URL = process.env['FORM_BUILDER_URL'] ?? 'http://localhost:3010';

interface ProfileCompletedPayload {
  fileId: string;
  profileId: string;
  tenantId: string;
  domainCode: string;
  columns: Array<{
    rawName: string;
    normalizedName: string;
    inferredType: string;
  }>;
}

/**
 * Kafka consumer handler for `ingest.profile.completed.v1`.
 * Fetches form templates for the user's domain, computes match scores, stores proposals.
 */
export async function handleProfileCompleted(
  payload: ProfileCompletedPayload,
  prisma: PrismaClient,
  kafka: StandaloneKafkaProducer,
  authToken?: string,
): Promise<void> {
  const { fileId, profileId, tenantId, domainCode } = payload;

  try {
    // Load full column profiles from DB
    const columnRows = await (prisma as any).columnProfile.findMany({
      where: { profileId },
      orderBy: { columnIndex: 'asc' },
    });

    const columns: ColumnStats[] = columnRows.map((r: Record<string, unknown>) => ({
      rawName: r.rawName as string,
      normalizedName: r.normalizedName as string,
      inferredType: r.inferredType as string,
      cardinality: r.cardinality as number,
      nullRate: r.nullRate as number,
      minLength: r.minLength as number | null,
      maxLength: r.maxLength as number | null,
      sampleValues: (r.sampleValues as string[]) ?? [],
      detectedPatterns: (r.detectedPatterns as string[]) ?? [],
    }));

    // R2: Fetch templates ONLY for this tenant + domain (pre-filtered)
    const candidates = await fetchFormCandidates(prisma, tenantId, domainCode);

    if (candidates.length === 0) {
      // No templates available — update status, no proposals
      await (prisma as any).ingestFile.update({
        where: { id: fileId },
        data: { status: 'MATCHED' },
      });
      return;
    }

    // Compute match scores (lexical only — semantic/LLM in Lot 2)
    const results = computeMatches(columns, candidates);

    // Persist proposals
    for (const result of results) {
      const proposal = await (prisma as any).matchProposal.create({
        data: {
          fileId,
          templateId: result.templateId,
          templateName: result.templateName,
          rank: result.rank,
          scoreGlobal: result.scoreGlobal,
          scoreCoverage: result.scoreCoverage,
          scoreSemantic: result.scoreSemantic,
          scoreTypes: result.scoreTypes,
          scoreReferentials: result.scoreReferentials,
          scoreHistory: result.scoreHistory,
          status: 'PROPOSED',
        },
      });

      // Persist field mappings
      for (const mapping of result.fieldMappings) {
        await (prisma as any).fieldMapping.create({
          data: {
            proposalId: proposal.id,
            sourceColumn: mapping.sourceColumn,
            targetFieldCode: mapping.targetFieldCode,
            targetFieldLabel: mapping.targetFieldLabel,
            origin: 'PROPOSED',
          },
        });
      }
    }

    // Update file status
    await (prisma as any).ingestFile.update({
      where: { id: fileId },
      data: { status: 'MATCHED' },
    });

    // Publish match proposed event
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka timeout')), 5000),
      );
      await Promise.race([
        kafka.send('ingest.match.proposed.v1', fileId, {
          fileId,
          proposalCount: results.length,
          topScore: results[0]?.scoreGlobal ?? 0,
          topRecommendation: results[0]?.recommendation ?? 'none',
          tenantId,
          domainCode,
        }, headers),
        timeout,
      ]);
    } catch { /* non-blocking */ }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await (prisma as any).ingestFile.update({
      where: { id: fileId },
      data: { status: 'FAILED', errorMessage: `Matching failed: ${errorMsg}` },
    });
  }
}

/**
 * R2: Fetch published form templates restricted to tenant + domain.
 * Never exposes templates from other tenants or domains.
 */
async function fetchFormCandidates(
  prisma: PrismaClient,
  tenantId: string,
  domainCode: string,
): Promise<FormCandidate[]> {
  // Query FormTemplate via Prisma (cross-schema read — form_builder schema)
  const templates = await (prisma as any).formTemplate.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { tenant_id: tenantId },
        { tenant_id: null }, // Continental templates
      ],
      targets: {
        some: { domain_code: domainCode },
      },
    },
    include: { targets: true },
  });

  // Also try legacy domain field
  const legacyTemplates = await (prisma as any).formTemplate.findMany({
    where: {
      status: 'PUBLISHED',
      domain: domainCode,
      OR: [
        { tenant_id: tenantId },
        { tenant_id: null },
      ],
    },
  });

  // Merge and deduplicate
  const allTemplates = new Map<string, Record<string, unknown>>();
  for (const t of [...templates, ...legacyTemplates]) {
    allTemplates.set(t.id, t);
  }

  // Check for existing acceptance counts
  const signatureMap = new Map<string, number>();
  try {
    const signatures = await (prisma as any).formSignature.findMany({
      where: { tenantId, domainCode },
      select: { templateId: true, acceptanceCount: true },
    });
    for (const sig of signatures) {
      signatureMap.set(sig.templateId, sig.acceptanceCount);
    }
  } catch { /* table may not exist yet */ }

  return Array.from(allTemplates.values()).map((t) => {
    const schema = t.schema as Record<string, unknown>;
    const fields = extractFieldsFromSchema(schema);
    return {
      templateId: t.id as string,
      templateName: t.name as string,
      fields,
      acceptanceCount: signatureMap.get(t.id as string) ?? 0,
    };
  });
}

function extractFieldsFromSchema(schema: Record<string, unknown>): FormCandidate['fields'] {
  const fields: FormCandidate['fields'] = [];
  const sections = schema.sections as Array<Record<string, unknown>> | undefined;
  if (!sections) return fields;

  for (const section of sections) {
    const sectionFields = section.fields as Array<Record<string, unknown>> | undefined;
    if (!sectionFields) continue;
    for (const field of sectionFields) {
      const type = field.type as string;
      // Skip layout-only fields
      if (['heading', 'divider', 'spacer', 'info-box'].includes(type)) continue;

      const label = field.label as Record<string, string> | string | undefined;
      const labelStr = typeof label === 'object' ? (label.en ?? label.fr ?? '') : (label ?? '');
      const props = field.properties as Record<string, unknown> | undefined;

      fields.push({
        code: field.code as string,
        label: labelStr,
        type,
        required: (field.required as boolean) ?? false,
        masterDataType: props?.masterDataType as string | undefined,
      });
    }
  }

  return fields;
}
