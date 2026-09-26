import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { ColumnStats } from '../parsers/types';

const SERVICE_NAME = 'ingest-service';

// Type mapping: inferred column type → FormBuilder field type
const TYPE_MAP: Record<string, string> = {
  text: 'text',
  integer: 'number',
  decimal: 'number',
  date: 'date',
  boolean: 'boolean',
  email: 'email',
  phone: 'phone',
  select: 'select',
  coordinate: 'number',
  uuid: 'text',
  unknown: 'text',
};

interface FormDraftField {
  id: string;
  type: string;
  code: string;
  label: Record<string, string>;
  required: boolean;
  order: number;
  column: number;
  columnSpan: number;
  readOnly: boolean;
  hidden: boolean;
  validation?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

interface FormDraftSchema {
  sections: Array<{
    id: string;
    name: Record<string, string>;
    columns: number;
    order: number;
    isCollapsible: boolean;
    isCollapsed: boolean;
    isRepeatable: boolean;
    conditions: unknown[];
    fields: FormDraftField[];
  }>;
  settings: {
    allowDraft: boolean;
    allowAttachments: boolean;
    maxAttachments: number;
    allowOffline: boolean;
    requireGeoLocation: boolean;
    autoSaveInterval: number;
    submissionWorkflow: string;
    notifyOnSubmit: string[];
    duplicateDetection: { enabled: boolean; fields: string[] };
  };
}

/**
 * Generate a FormBuilder-compatible draft schema from column profiles.
 * Prompt Lot 3: brouillon with fields, types, constraints, labels in 4 languages.
 */
export function generateFormDraft(
  columns: ColumnStats[],
  domainCode: string,
  sourceName: string,
): FormDraftSchema {
  const fields: FormDraftField[] = columns.map((col, idx) => {
    const fieldType = TYPE_MAP[col.inferredType] ?? 'text';
    const code = col.normalizedName.slice(0, 60) || `field_${idx}`;

    const field: FormDraftField = {
      id: randomUUID(),
      type: fieldType,
      code,
      label: {
        en: col.rawName,
        fr: col.rawName,
        pt: col.rawName,
        ar: col.rawName,
      },
      required: col.nullRate < 0.1, // Required if <10% null
      order: idx + 1,
      column: 1,
      columnSpan: 1,
      readOnly: false,
      hidden: false,
    };

    // Add type-specific validation
    if (fieldType === 'number' && col.inferredType === 'decimal') {
      field.properties = { step: 0.01, decimals: 2 };
    }
    if (fieldType === 'text' && col.maxLength) {
      field.validation = { maxLength: Math.min(col.maxLength * 2, 1000) };
    }
    if (col.inferredType === 'select' && col.sampleValues.length > 0) {
      field.type = 'select';
      field.properties = {
        options: col.sampleValues.map((v) => ({ label: { en: v, fr: v }, value: v })),
      };
    }

    return field;
  });

  return {
    sections: [
      {
        id: randomUUID(),
        name: {
          en: `Data from ${sourceName}`,
          fr: `Données de ${sourceName}`,
          pt: `Dados de ${sourceName}`,
          ar: `بيانات من ${sourceName}`,
        },
        columns: 2,
        order: 1,
        isCollapsible: false,
        isCollapsed: false,
        isRepeatable: false,
        conditions: [],
        fields,
      },
    ],
    settings: {
      allowDraft: true,
      allowAttachments: false,
      maxAttachments: 0,
      allowOffline: true,
      requireGeoLocation: false,
      autoSaveInterval: 30,
      submissionWorkflow: 'review_then_validate',
      notifyOnSubmit: ['supervisor'],
      duplicateDetection: { enabled: true, fields: fields.filter((f) => f.required).map((f) => f.code) },
    },
  };
}

/**
 * Detect quasi-duplicate forms by comparing field signatures.
 * Returns templates with similarity > 0.70.
 */
export async function detectQuasiDuplicates(
  prisma: PrismaClient,
  domainCode: string,
  fieldCodes: string[],
): Promise<Array<{ templateId: string; templateName: string; similarity: number }>> {
  const signatures = await (prisma as any).formSignature.findMany({
    where: { domainCode },
    select: { templateId: true, fieldCodes: true },
  });

  const results: Array<{ templateId: string; templateName: string; similarity: number }> = [];
  const sourceSet = new Set(fieldCodes);

  for (const sig of signatures) {
    const sigCodes = (sig.fieldCodes as string[]) ?? [];
    const sigSet = new Set(sigCodes);

    // Jaccard similarity
    const intersection = fieldCodes.filter((c) => sigSet.has(c)).length;
    const union = new Set([...fieldCodes, ...sigCodes]).size;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity > 0.70) {
      // Fetch template name
      const template = await (prisma as any).formTemplate.findUnique({
        where: { id: sig.templateId },
        select: { name: true },
      });
      results.push({
        templateId: sig.templateId,
        templateName: template?.name ?? sig.templateId,
        similarity: Math.round(similarity * 100) / 100,
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Create a draft form template via the Prisma model (not API — same DB).
 * Publishes Kafka event for FormBuilder notification.
 */
export async function createFormDraft(
  prisma: PrismaClient,
  kafka: StandaloneKafkaProducer,
  schema: FormDraftSchema,
  domainCode: string,
  tenantId: string,
  userId: string,
  sourceName: string,
): Promise<{ templateId: string }> {
  const template = await (prisma as any).formTemplate.create({
    data: {
      tenant_id: tenantId,
      name: `[Draft] Import: ${sourceName}`,
      domain: domainCode,
      form_type: 'CAMPAIGN',
      version: 1,
      schema: schema as unknown,
      ui_schema: {},
      status: 'DRAFT',
      data_classification: 'RESTRICTED',
      created_by: userId,
    },
  });

  // Create target
  await (prisma as any).formTarget.create({
    data: {
      form_id: template.id,
      domain_code: domainCode,
      is_primary: true,
    },
  });

  // Publish event
  const headers: KafkaHeaders = {
    correlationId: randomUUID(),
    sourceService: SERVICE_NAME,
    tenantId,
    userId,
    schemaVersion: '1',
    timestamp: new Date().toISOString(),
  };
  try {
    await Promise.race([
      kafka.send('ingest.form.draft.created.v1', template.id, {
        fileId: sourceName,
        templateId: template.id,
        domainCode,
        tenantId,
      }, headers),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch { /* non-blocking */ }

  return { templateId: template.id };
}
