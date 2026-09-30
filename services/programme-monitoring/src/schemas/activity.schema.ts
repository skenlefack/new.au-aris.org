import { Type, type Static } from '@sinclair/typebox';

const MultilingualName = Type.Object({
  en: Type.String({ minLength: 1 }),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

const ActivityStatusEnum = Type.Union([
  Type.Literal('NOT_STARTED'),
  Type.Literal('PLANNED'),
  Type.Literal('IN_PROGRESS'),
  Type.Literal('COMPLETED'),
  Type.Literal('DELAYED'),
  Type.Literal('CANCELLED'),
  Type.Literal('ON_HOLD'),
]);

const PriorityEnum = Type.Union([
  Type.Literal('CRITICAL'),
  Type.Literal('HIGH'),
  Type.Literal('MEDIUM'),
  Type.Literal('LOW'),
]);

const ProcurementStatusEnum = Type.Union([
  Type.Literal('NONE'),
  Type.Literal('TOR_DRAFTED'),
  Type.Literal('PUBLISHED'),
  Type.Literal('EVALUATED'),
  Type.Literal('CONTRACTED'),
]);

export const CreateActivitySchema = Type.Object({
  outputId: Type.String({ format: 'uuid' }),
  code: Type.String({ minLength: 1, maxLength: 30 }),
  name: MultilingualName,
  description: Type.Optional(MultilingualName),
  responsibleUserId: Type.Optional(Type.String({ format: 'uuid' })),
  responsibleUnit: Type.Optional(Type.String({ maxLength: 100 })),
  responsibleLevel: Type.Optional(Type.String()),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  plannedStartDate: Type.String({ format: 'date' }),
  plannedEndDate: Type.String({ format: 'date' }),
  status: Type.Optional(ActivityStatusEnum),
  priorityLevel: Type.Optional(PriorityEnum),
  weightInOutput: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  procurementRequired: Type.Optional(Type.Boolean()),
  procurementStatus: Type.Optional(ProcurementStatusEnum),
});

export const UpdateActivitySchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1, maxLength: 30 })),
  name: Type.Optional(MultilingualName),
  description: Type.Optional(MultilingualName),
  responsibleUserId: Type.Optional(Type.String({ format: 'uuid' })),
  responsibleUnit: Type.Optional(Type.String({ maxLength: 100 })),
  responsibleLevel: Type.Optional(Type.String()),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  plannedStartDate: Type.Optional(Type.String({ format: 'date' })),
  plannedEndDate: Type.Optional(Type.String({ format: 'date' })),
  actualStartDate: Type.Optional(Type.String({ format: 'date' })),
  actualEndDate: Type.Optional(Type.String({ format: 'date' })),
  status: Type.Optional(ActivityStatusEnum),
  priorityLevel: Type.Optional(PriorityEnum),
  completionPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  weightInOutput: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  procurementRequired: Type.Optional(Type.Boolean()),
  procurementStatus: Type.Optional(ProcurementStatusEnum),
  delayReason: Type.Optional(Type.String()),
});

export const ActivityFilterSchema = Type.Object({
  outputId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(ActivityStatusEnum),
  responsibleUserId: Type.Optional(Type.String({ format: 'uuid' })),
  geoEntityId: Type.Optional(Type.String({ format: 'uuid' })),
  priorityLevel: Type.Optional(PriorityEnum),
  ragStatus: Type.Optional(Type.String()),
  programmeId: Type.Optional(Type.String({ format: 'uuid' })),
});

export const CreateSubActivitySchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 30 }),
  name: MultilingualName,
  description: Type.Optional(MultilingualName),
  responsibleUserId: Type.Optional(Type.String({ format: 'uuid' })),
  plannedStartDate: Type.String({ format: 'date' }),
  plannedEndDate: Type.String({ format: 'date' }),
});

export const UpdateSubActivitySchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1, maxLength: 30 })),
  name: Type.Optional(MultilingualName),
  description: Type.Optional(MultilingualName),
  responsibleUserId: Type.Optional(Type.String({ format: 'uuid' })),
  plannedStartDate: Type.Optional(Type.String({ format: 'date' })),
  plannedEndDate: Type.Optional(Type.String({ format: 'date' })),
  actualStartDate: Type.Optional(Type.String({ format: 'date' })),
  actualEndDate: Type.Optional(Type.String({ format: 'date' })),
  status: Type.Optional(ActivityStatusEnum),
  completionPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
});

export type CreateActivityInput = Static<typeof CreateActivitySchema>;
export type UpdateActivityInput = Static<typeof UpdateActivitySchema>;
export type ActivityFilterInput = Static<typeof ActivityFilterSchema>;
export type CreateSubActivityInput = Static<typeof CreateSubActivitySchema>;
export type UpdateSubActivityInput = Static<typeof UpdateSubActivitySchema>;
