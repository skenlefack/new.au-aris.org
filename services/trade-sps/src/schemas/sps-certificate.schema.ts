import { Type, type Static } from '@sinclair/typebox';

export const CreateSpsCertificateSchema = Type.Object({
  certificateNumber: Type.String({ minLength: 1, maxLength: 100 }),
  consignmentId: Type.Optional(Type.String({ format: 'uuid' })),
  exporterId: Type.String({ format: 'uuid' }),
  importerId: Type.String({ format: 'uuid' }),
  speciesId: Type.String({ format: 'uuid' }),
  commodity: Type.String({ minLength: 1, maxLength: 255 }),
  quantity: Type.Number({ minimum: 0 }),
  unit: Type.String({ minLength: 1, maxLength: 50 }),
  originCountryId: Type.String({ format: 'uuid' }),
  destinationCountryId: Type.String({ format: 'uuid' }),
  inspectionResult: Type.Optional(
    Type.Union([
      Type.Literal('PASS'),
      Type.Literal('FAIL'),
      Type.Literal('CONDITIONAL'),
      Type.Literal('PENDING'),
    ]),
  ),
  inspectionDate: Type.Optional(Type.String({ format: 'date-time' })),
  certifiedBy: Type.Optional(Type.String({ format: 'uuid' })),
  certifiedAt: Type.Optional(Type.String({ format: 'date-time' })),
  validUntil: Type.Optional(Type.String({ format: 'date-time' })),
  remarks: Type.Optional(Type.String({ maxLength: 2000 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type CreateSpsCertificateInput = Static<typeof CreateSpsCertificateSchema>;

export const UpdateSpsCertificateSchema = Type.Object({
  certificateNumber: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  consignmentId: Type.Optional(Type.String({ format: 'uuid' })),
  exporterId: Type.Optional(Type.String({ format: 'uuid' })),
  importerId: Type.Optional(Type.String({ format: 'uuid' })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  commodity: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  quantity: Type.Optional(Type.Number({ minimum: 0 })),
  unit: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  originCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  destinationCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  inspectionResult: Type.Optional(
    Type.Union([
      Type.Literal('PASS'),
      Type.Literal('FAIL'),
      Type.Literal('CONDITIONAL'),
      Type.Literal('PENDING'),
    ]),
  ),
  inspectionDate: Type.Optional(Type.String({ format: 'date-time' })),
  certifiedBy: Type.Optional(Type.String({ format: 'uuid' })),
  validUntil: Type.Optional(Type.String({ format: 'date-time' })),
  remarks: Type.Optional(Type.String({ maxLength: 2000 })),
  dataClassification: Type.Optional(
    Type.Union([
      Type.Literal('PUBLIC'),
      Type.Literal('PARTNER'),
      Type.Literal('RESTRICTED'),
      Type.Literal('CONFIDENTIAL'),
    ]),
  ),
});
export type UpdateSpsCertificateInput = Static<typeof UpdateSpsCertificateSchema>;

export const SpsCertificateFilterSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  speciesId: Type.Optional(Type.String({ format: 'uuid' })),
  originCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  destinationCountryId: Type.Optional(Type.String({ format: 'uuid' })),
  inspectionResult: Type.Optional(
    Type.Union([
      Type.Literal('PASS'),
      Type.Literal('FAIL'),
      Type.Literal('CONDITIONAL'),
      Type.Literal('PENDING'),
    ]),
  ),
  status: Type.Optional(
    Type.Union([
      Type.Literal('DRAFT'),
      Type.Literal('ISSUED'),
      Type.Literal('REVOKED'),
      Type.Literal('EXPIRED'),
    ]),
  ),
  periodStart: Type.Optional(Type.String({ format: 'date-time' })),
  periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
});
export type SpsCertificateFilterInput = Static<typeof SpsCertificateFilterSchema>;

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;
