import { z } from 'zod';

/** Validates a nodeCode: domain or domain.subdomain */
export const nodeCodeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9-]*(\.[A-Z][A-Z0-9_]*)?$/,
    'nodeCode must be "domain-code" or "domain-code.SUBDOMAIN_CODE"',
  );

/** Validates a levelCode: UPPER_SNAKE_CASE */
export const levelCodeSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'levelCode must be UPPER_SNAKE_CASE');

/** Multilingual labels — all 4 required */
export const labelsSchema = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  ar: z.string().min(1),
  pt: z.string().min(1),
});

/** Create a domain access level */
export const createAccessLevelSchema = z.object({
  nodeCode: nodeCodeSchema,
  code: levelCodeSchema,
  labels: labelsSchema,
  description: labelsSchema.partial().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Update a domain access level (code is immutable) */
export const updateAccessLevelSchema = z.object({
  labels: labelsSchema.optional(),
  description: labelsSchema.partial().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Deactivate a domain access level */
export const deactivateAccessLevelSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

/** Reorder levels within a node */
export const reorderAccessLevelsSchema = z.object({
  nodeCode: nodeCodeSchema,
  /** Ordered array of level IDs */
  orderedIds: z.array(z.string().uuid()).min(1),
});

/** Copy levels from one node to another */
export const copyAccessLevelsSchema = z.object({
  fromNodeCode: nodeCodeSchema,
  toNodeCode: nodeCodeSchema,
});

/** A single scope entry: node + levels */
export const scopeEntrySchema = z.object({
  nodeCode: nodeCodeSchema,
  levelCodes: z.array(levelCodeSchema),
});

/** Replace all scopes for a user or campaign */
export const replaceScopesSchema = z.object({
  scopes: z.array(scopeEntrySchema),
});

export type CreateAccessLevelInput = z.infer<typeof createAccessLevelSchema>;
export type UpdateAccessLevelInput = z.infer<typeof updateAccessLevelSchema>;
export type ReorderAccessLevelsInput = z.infer<typeof reorderAccessLevelsSchema>;
export type CopyAccessLevelsInput = z.infer<typeof copyAccessLevelsSchema>;
export type ScopeEntry = z.infer<typeof scopeEntrySchema>;
export type ReplaceScopesInput = z.infer<typeof replaceScopesSchema>;
