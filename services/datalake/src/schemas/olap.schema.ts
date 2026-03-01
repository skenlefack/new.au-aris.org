/**
 * JSON Schemas for OLAP route validation (Fastify schema validation).
 */

export const analyticalQuerySchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      source: { type: 'string' as const },
      entityType: { type: 'string' as const },
      dimensions: {
        type: 'string' as const,
        description: 'Comma-separated list of dimensions',
      },
      measures: {
        type: 'string' as const,
        description: 'JSON-encoded array of {field, function, alias?}',
      },
      filters: {
        type: 'string' as const,
        description: 'JSON-encoded array of {field, operator, value}',
      },
      dateFrom: { type: 'string' as const },
      dateTo: { type: 'string' as const },
      page: { type: 'integer' as const, default: 1, minimum: 1 },
      limit: { type: 'integer' as const, default: 100, maximum: 10000 },
    },
  },
};

export const timeSeriesQuerySchema = {
  querystring: {
    type: 'object' as const,
    required: ['metric', 'function', 'granularity', 'dateFrom', 'dateTo'],
    properties: {
      metric: { type: 'string' as const },
      function: { type: 'string' as const, enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] },
      granularity: { type: 'string' as const, enum: ['day', 'week', 'month', 'quarter', 'year'] },
      dateFrom: { type: 'string' as const },
      dateTo: { type: 'string' as const },
      source: { type: 'string' as const },
      entityType: { type: 'string' as const },
      groupBy: { type: 'string' as const },
    },
  },
};

export const geoQuerySchema = {
  querystring: {
    type: 'object' as const,
    required: ['minLat', 'minLng', 'maxLat', 'maxLng'],
    properties: {
      minLat: { type: 'number' as const },
      minLng: { type: 'number' as const },
      maxLat: { type: 'number' as const },
      maxLng: { type: 'number' as const },
      entityType: { type: 'string' as const },
      source: { type: 'string' as const },
      dateFrom: { type: 'string' as const },
      dateTo: { type: 'string' as const },
      limit: { type: 'integer' as const, default: 1000, maximum: 10000 },
    },
  },
};

export const createExportSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'query', 'format'],
    properties: {
      name: { type: 'string' as const, minLength: 1, maxLength: 255 },
      query: { type: 'object' as const },
      format: { type: 'string' as const, enum: ['CSV', 'XLSX', 'JSON', 'PARQUET'] },
    },
  },
};

export const exportIdParamSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const listExportsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, default: 1, minimum: 1 },
      limit: { type: 'integer' as const, default: 20, maximum: 100 },
      status: { type: 'string' as const, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
    },
  },
};

export const partitionIdParamSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const listPartitionsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, default: 1, minimum: 1 },
      limit: { type: 'integer' as const, default: 20, maximum: 100 },
      status: { type: 'string' as const, enum: ['ACTIVE', 'ARCHIVING', 'ARCHIVED'] },
    },
  },
};

export const schemaQuerySchema = {};

export const reindexOlapSchema = {
  body: {
    type: 'object' as const,
    required: ['indexName'],
    properties: {
      indexName: { type: 'string' as const },
    },
  },
};
