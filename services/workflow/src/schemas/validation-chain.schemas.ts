import { Type, type Static } from '@sinclair/typebox';

export const CreateChainSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  validatorId: Type.String({ format: 'uuid' }),
  backupValidatorId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  levelType: Type.String({ minLength: 1, maxLength: 20 }),
  priority: Type.Optional(Type.Number({ minimum: 1, maximum: 10 })),
});

export const UpdateChainSchema = Type.Object({
  validatorId: Type.Optional(Type.String({ format: 'uuid' })),
  backupValidatorId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  levelType: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  priority: Type.Optional(Type.Number({ minimum: 1, maximum: 10 })),
});

export const ChainListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  userId: Type.Optional(Type.String({ format: 'uuid' })),
  validatorId: Type.Optional(Type.String({ format: 'uuid' })),
});

export const ChainIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const ChainUserParamSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
});

export const ChainValidatorParamSchema = Type.Object({
  validatorId: Type.String({ format: 'uuid' }),
});

export type CreateChainInput = Static<typeof CreateChainSchema>;
export type UpdateChainInput = Static<typeof UpdateChainSchema>;
export type ChainListQueryInput = Static<typeof ChainListQuerySchema>;
export type ChainIdParamInput = Static<typeof ChainIdParamSchema>;
export type ChainUserParamInput = Static<typeof ChainUserParamSchema>;
export type ChainValidatorParamInput = Static<typeof ChainValidatorParamSchema>;
