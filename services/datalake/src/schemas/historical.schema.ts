/**
 * JSON Schemas for historical data route validation (Fastify).
 */

export const uploadAnalyzeSchema = {
  // multipart — schema validated in handler
};

export const importDatasetSchema = {
  // multipart — validated in handler
};

export const listDatasetsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, default: 1, minimum: 1 },
      limit: { type: 'integer' as const, default: 20, maximum: 100 },
      domain: { type: 'string' as const },
      status: { type: 'string' as const },
      search: { type: 'string' as const },
      sort: { type: 'string' as const },
      order: { type: 'string' as const, enum: ['asc', 'desc'] },
    },
  },
};

export const getDatasetSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const updateDatasetSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, minLength: 1, maxLength: 255 },
      description: { type: 'string' as const },
      domain: { type: 'string' as const },
      tags: { type: 'array' as const, items: { type: 'string' as const } },
    },
  },
};

export const deleteDatasetSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const queryDataSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, default: 1, minimum: 1 },
      limit: { type: 'integer' as const, default: 50, maximum: 1000 },
      sort: { type: 'string' as const },
      order: { type: 'string' as const, enum: ['asc', 'desc'] },
      search: { type: 'string' as const },
    },
  },
};

export const aggregateSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    required: ['column', 'operation'],
    properties: {
      column: { type: 'string' as const },
      operation: {
        type: 'string' as const,
        enum: ['count', 'sum', 'avg', 'min', 'max', 'distribution'],
      },
      groupBy: { type: 'string' as const },
    },
  },
};

export const timeSeriesSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    required: ['dateColumn', 'valueColumn', 'interval'],
    properties: {
      dateColumn: { type: 'string' as const },
      valueColumn: { type: 'string' as const },
      interval: {
        type: 'string' as const,
        enum: ['day', 'week', 'month', 'year'],
      },
      operation: {
        type: 'string' as const,
        enum: ['count', 'sum', 'avg'],
        default: 'count',
      },
    },
  },
};

export const createAnalysisSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    required: ['type', 'title', 'config'],
    properties: {
      type: {
        type: 'string' as const,
        enum: ['SUMMARY', 'TREND', 'DISTRIBUTION', 'CORRELATION', 'ANOMALY'],
      },
      title: { type: 'string' as const, minLength: 1, maxLength: 255 },
      description: { type: 'string' as const },
      config: { type: 'object' as const },
    },
  },
};

export const listAnalysesSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const deleteAnalysisSchema = {
  params: {
    type: 'object' as const,
    required: ['id', 'analysisId'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      analysisId: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const statsSchema = {};
