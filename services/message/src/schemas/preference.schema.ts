import { Type, type Static } from '@sinclair/typebox';

export const UpsertPreferenceSchema = Type.Object({
  eventType: Type.String(),
  email: Type.Optional(Type.Boolean()),
  sms: Type.Optional(Type.Boolean()),
  push: Type.Optional(Type.Boolean()),
  inApp: Type.Optional(Type.Boolean()),
});

export type UpsertPreferenceInput = Static<typeof UpsertPreferenceSchema>;
