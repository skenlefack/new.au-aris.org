import { Type, type Static } from '@sinclair/typebox';

export const MfaCodeSchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6 }),
});

export type MfaCodeInput = Static<typeof MfaCodeSchema>;
