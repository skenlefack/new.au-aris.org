import { Type, Static } from '@sinclair/typebox';

// ── Params ──

export const BaseFormIdParamSchema = Type.Object({
  baseFormId: Type.String({ format: 'uuid' }),
});
export type BaseFormIdParam = Static<typeof BaseFormIdParamSchema>;

export const ExtensionIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type ExtensionIdParam = Static<typeof ExtensionIdParamSchema>;

export const ExtensionFieldIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  fieldId: Type.String({ format: 'uuid' }),
});
export type ExtensionFieldIdParam = Static<typeof ExtensionFieldIdParamSchema>;

export const EffectiveFormParamSchema = Type.Object({
  campaignId: Type.String({ format: 'uuid' }),
  baseFormId: Type.String({ format: 'uuid' }),
});
export type EffectiveFormParam = Static<typeof EffectiveFormParamSchema>;

// ── Query ──

export const ListExtensionsQuerySchema = Type.Object({
  campaignId: Type.String({ format: 'uuid' }),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type ListExtensionsQuery = Static<typeof ListExtensionsQuerySchema>;

export const EffectiveFormQuerySchema = Type.Object({
  tenantId: Type.String({ format: 'uuid' }),
});
export type EffectiveFormQuery = Static<typeof EffectiveFormQuerySchema>;

// ── Bodies ──

export const CreateExtensionBodySchema = Type.Object({
  campaignId: Type.String({ format: 'uuid' }),
  level: Type.Union([Type.Literal('REC'), Type.Literal('COUNTRY')]),
  tenantId: Type.String({ format: 'uuid' }),
});
export type CreateExtensionBody = Static<typeof CreateExtensionBodySchema>;

const I18nLabelSchema = Type.Object({
  en: Type.Optional(Type.String()),
  fr: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
});

export const AddExtensionFieldBodySchema = Type.Object({
  fieldKey: Type.String({ minLength: 1, maxLength: 255 }),
  labelI18n: I18nLabelSchema,
  type: Type.String({ minLength: 1, maxLength: 50 }),
  required: Type.Optional(Type.Boolean()),
  validationRules: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  referenceDataId: Type.Optional(Type.String({ format: 'uuid' })),
  properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  order: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type AddExtensionFieldBody = Static<typeof AddExtensionFieldBodySchema>;

export const UpdateExtensionFieldBodySchema = Type.Object({
  fieldKey: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  labelI18n: Type.Optional(I18nLabelSchema),
  type: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  required: Type.Optional(Type.Boolean()),
  validationRules: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  referenceDataId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  properties: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  order: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type UpdateExtensionFieldBody = Static<typeof UpdateExtensionFieldBodySchema>;
