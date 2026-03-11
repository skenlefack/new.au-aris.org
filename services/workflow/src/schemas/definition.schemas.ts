import { Type, type Static } from '@sinclair/typebox';

const I18nText = Type.Object({
  en: Type.Optional(Type.String()),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

export const CreateDefinitionSchema = Type.Object({
  countryCode: Type.String({ minLength: 2, maxLength: 2 }),
  name: I18nText,
  description: Type.Optional(I18nText),
  startLevel: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  endLevel: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  defaultTransmitDelay: Type.Optional(Type.Number({ minimum: 1 })),
  defaultValidationDelay: Type.Optional(Type.Number({ minimum: 1 })),
  autoTransmitEnabled: Type.Optional(Type.Boolean()),
  autoValidateEnabled: Type.Optional(Type.Boolean()),
  requireComment: Type.Optional(Type.Boolean()),
  allowReject: Type.Optional(Type.Boolean()),
  allowReturn: Type.Optional(Type.Boolean()),
});

export const UpdateDefinitionSchema = Type.Object({
  name: Type.Optional(I18nText),
  description: Type.Optional(I18nText),
  startLevel: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  endLevel: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  defaultTransmitDelay: Type.Optional(Type.Number({ minimum: 1 })),
  defaultValidationDelay: Type.Optional(Type.Number({ minimum: 1 })),
  autoTransmitEnabled: Type.Optional(Type.Boolean()),
  autoValidateEnabled: Type.Optional(Type.Boolean()),
  requireComment: Type.Optional(Type.Boolean()),
  allowReject: Type.Optional(Type.Boolean()),
  allowReturn: Type.Optional(Type.Boolean()),
  isActive: Type.Optional(Type.Boolean()),
});

export const CreateStepSchema = Type.Object({
  stepOrder: Type.Number({ minimum: 0 }),
  levelType: Type.String({ minLength: 1, maxLength: 20 }),
  adminLevel: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  name: I18nText,
  canEdit: Type.Optional(Type.Boolean()),
  canValidate: Type.Optional(Type.Boolean()),
  transmitDelayHours: Type.Optional(Type.Union([Type.Number({ minimum: 1 }), Type.Null()])),
});

export const UpdateStepSchema = Type.Object({
  stepOrder: Type.Optional(Type.Number({ minimum: 0 })),
  levelType: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  adminLevel: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  name: Type.Optional(I18nText),
  canEdit: Type.Optional(Type.Boolean()),
  canValidate: Type.Optional(Type.Boolean()),
  transmitDelayHours: Type.Optional(Type.Union([Type.Number({ minimum: 1 }), Type.Null()])),
});

export const DefinitionListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

export const DefinitionIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const CountryCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 2 }),
});

export const StepParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stepId: Type.String({ format: 'uuid' }),
});

export type CreateDefinitionInput = Static<typeof CreateDefinitionSchema>;
export type UpdateDefinitionInput = Static<typeof UpdateDefinitionSchema>;
export type CreateStepInput = Static<typeof CreateStepSchema>;
export type UpdateStepInput = Static<typeof UpdateStepSchema>;
export type DefinitionListQueryInput = Static<typeof DefinitionListQuerySchema>;
export type DefinitionIdParamInput = Static<typeof DefinitionIdParamSchema>;
export type CountryCodeParamInput = Static<typeof CountryCodeParamSchema>;
export type StepParamsInput = Static<typeof StepParamsSchema>;
