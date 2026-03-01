import { Type, type Static } from '@sinclair/typebox';

export const FhirSearchSchema = Type.Object({
  _count: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  _offset: Type.Optional(Type.Integer({ minimum: 0 })),
  subject: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  date: Type.Optional(Type.String()),
  identifier: Type.Optional(Type.String()),
  species: Type.Optional(Type.String()),
});
export type FhirSearchQuery = Static<typeof FhirSearchSchema>;

export const FhirIdParamSchema = Type.Object({
  id: Type.String(),
});
export type FhirIdParam = Static<typeof FhirIdParamSchema>;
