/**
 * JSON Schemas for datalake route validation (Fastify schema validation).
 */

export const searchSchema = {
  body: {
    type: 'object' as const,
    required: ['query'],
    properties: {
      query: { type: 'string' as const },
      index: { type: 'string' as const },
      from: { type: 'integer' as const, default: 0 },
      size: { type: 'integer' as const, default: 20, maximum: 1000 },
      filters: { type: 'object' as const },
      sort: { type: 'object' as const },
    },
  },
};

export const listIndicesSchema = {};

export const reindexSchema = {
  params: {
    type: 'object' as const,
    required: ['name'],
    properties: {
      name: { type: 'string' as const },
    },
  },
};

export const exportSchema = {
  querystring: {
    type: 'object' as const,
    required: ['index'],
    properties: {
      index: { type: 'string' as const },
      format: { type: 'string' as const, enum: ['json', 'csv'], default: 'json' },
      query: { type: 'string' as const },
    },
  },
};
