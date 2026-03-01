import { Type, Static } from '@sinclair/typebox';

export const SubmissionPayloadSchema = Type.Object({
  id: Type.Optional(Type.String({ format: 'uuid' })),
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
  version: Type.Optional(Type.Integer()),
});
export type SubmissionPayloadBody = Static<typeof SubmissionPayloadSchema>;

export const SyncRequestSchema = Type.Object({
  submissions: Type.Array(SubmissionPayloadSchema),
  lastSyncAt: Type.String({ format: 'date-time' }),
});
export type SyncRequestBody = Static<typeof SyncRequestSchema>;
