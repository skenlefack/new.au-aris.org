import { Type, type Static } from '@sinclair/typebox';

export const LoginSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
  totpCode: Type.Optional(Type.String({ minLength: 6, maxLength: 6 })),
});

export const RegisterSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  firstName: Type.String({ minLength: 1, maxLength: 100 }),
  lastName: Type.String({ minLength: 1, maxLength: 100 }),
  role: Type.String(),
  tenantId: Type.String({ format: 'uuid' }),
});

export const RefreshSchema = Type.Object({
  refreshToken: Type.String({ minLength: 1 }),
});

export const ForgotPasswordSchema = Type.Object({
  email: Type.String({ format: 'email' }),
});

export const ResetPasswordSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 8, maxLength: 128 }),
});

export type LoginInput = Static<typeof LoginSchema>;
export type RegisterInput = Static<typeof RegisterSchema>;
export type RefreshInput = Static<typeof RefreshSchema>;
export type ForgotPasswordInput = Static<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = Static<typeof ResetPasswordSchema>;
