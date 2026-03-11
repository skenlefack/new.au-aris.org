import { Type, type Static } from '@sinclair/typebox';

export const CreateInstanceSchema = Type.Object({
  entityType: Type.String({ minLength: 1, maxLength: 100 }),
  entityId: Type.String({ format: 'uuid' }),
  domain: Type.String({ minLength: 2, maxLength: 50 }),
  dataContractId: Type.Optional(Type.String({ format: 'uuid' })),
  qualityReportId: Type.Optional(Type.String()),
});

export const ApproveSchema = Type.Object({
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});

export const RejectSchema = Type.Object({
  reason: Type.String({ maxLength: 2000 }),
});

export const ReturnSchema = Type.Object({
  reason: Type.String({ maxLength: 2000 }),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const ListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  level: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
});

export type CreateInstanceInput = Static<typeof CreateInstanceSchema>;
export type ApproveInput = Static<typeof ApproveSchema>;
export type RejectInput = Static<typeof RejectSchema>;
export type ReturnInput = Static<typeof ReturnSchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;
export type ListQueryInput = Static<typeof ListQuerySchema>;
