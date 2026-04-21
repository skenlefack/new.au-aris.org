import { Type, type Static } from '@sinclair/typebox';

export const SessionQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  status: Type.Optional(Type.String()),
  deviceType: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  dateFrom: Type.Optional(Type.String()),
  dateTo: Type.Optional(Type.String()),
});

export type SessionQueryInput = Static<typeof SessionQuerySchema>;

export const SessionStatsQuerySchema = Type.Object({
  days: Type.Optional(Type.Number({ minimum: 1, maximum: 365 })),
});

export type SessionStatsQueryInput = Static<typeof SessionStatsQuerySchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type UuidParamInput = Static<typeof UuidParamSchema>;
