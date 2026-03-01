import { Type, Static } from '@sinclair/typebox';

export const CreateSubmissionSchema = Type.Object({
  campaignId: Type.String({ format: 'uuid' }),
  data: Type.Record(Type.String(), Type.Unknown()),
  deviceId: Type.Optional(Type.String({ maxLength: 255 })),
  gpsLat: Type.Optional(Type.Number()),
  gpsLng: Type.Optional(Type.Number()),
  gpsAccuracy: Type.Optional(Type.Number()),
  offlineCreatedAt: Type.Optional(Type.String({ format: 'date-time' })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateSubmissionBody = Static<typeof CreateSubmissionSchema>;

export const ListSubmissionsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  campaign: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(Type.String()),
  agent: Type.Optional(Type.String({ format: 'uuid' })),
});
export type ListSubmissionsQuery = Static<typeof ListSubmissionsQuerySchema>;

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;
