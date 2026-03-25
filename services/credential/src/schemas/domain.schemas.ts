import { Type, type Static } from '@sinclair/typebox';

export const SetUserDomainsSchema = Type.Object({
  domainIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 0 }),
});

export const UserIdParamSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
});

export type SetUserDomainsInput = Static<typeof SetUserDomainsSchema>;
export type UserIdParamInput = Static<typeof UserIdParamSchema>;
