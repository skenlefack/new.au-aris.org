import { Type, type Static } from '@sinclair/typebox';

export const SendNotificationSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  channel: Type.String(),
  subject: Type.String({ maxLength: 500 }),
  body: Type.String(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const ListNotificationsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.Union([Type.Literal('createdAt'), Type.Literal('readAt')])),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  channel: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type SendNotificationInput = Static<typeof SendNotificationSchema>;
export type ListNotificationsQueryInput = Static<typeof ListNotificationsQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;
