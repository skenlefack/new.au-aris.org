export const createSessionSchema = {
  body: {
    type: 'object',
    required: ['title', 'startDate', 'endDate'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: { type: 'string', maxLength: 500 },
      maxParticipants: { type: 'integer', minimum: 1 },
      category: { type: 'string', maxLength: 100 },
      tags: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

export const updateSessionSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: { type: 'string', maxLength: 500 },
      maxParticipants: { type: 'integer', minimum: 1 },
      category: { type: 'string', maxLength: 100 },
      status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
      tags: { type: 'array', items: { type: 'string' } },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const enrollParticipantSchema = {
  body: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['PARTICIPANT', 'TRAINER', 'OBSERVER'], default: 'PARTICIPANT' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const issueCertificationSchema = {
  body: {
    type: 'object',
    required: ['participantId'],
    properties: {
      participantId: { type: 'string', format: 'uuid' },
      grade: { type: 'string', maxLength: 50 },
      notes: { type: 'string', maxLength: 1000 },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const listQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
      category: { type: 'string' },
      sort: { type: 'string', default: 'createdAt' },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
  },
} as const;

export const idParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
