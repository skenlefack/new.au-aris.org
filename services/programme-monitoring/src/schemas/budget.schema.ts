import { Type, type Static } from '@sinclair/typebox';

export const CreateBudgetSchema = Type.Object({
  activityId: Type.String({ format: 'uuid' }),
  budgetLineCode: Type.String({ minLength: 1, maxLength: 30 }),
  description: Type.String({ minLength: 1, maxLength: 500 }),
  fundingSource: Type.String({ minLength: 1, maxLength: 100 }),
  approvedAmount: Type.Number({ minimum: 0 }),
  committedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  disbursedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  executedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(Type.String({ maxLength: 10 })),
  period: Type.String({ minLength: 1, maxLength: 20 }),
});

export const UpdateBudgetSchema = Type.Object({
  budgetLineCode: Type.Optional(Type.String({ maxLength: 30 })),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  fundingSource: Type.Optional(Type.String({ maxLength: 100 })),
  approvedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  committedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  disbursedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  executedAmount: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(Type.String({ maxLength: 10 })),
  period: Type.Optional(Type.String({ maxLength: 20 })),
});

export const BudgetFilterSchema = Type.Object({
  activityId: Type.Optional(Type.String({ format: 'uuid' })),
  programmeId: Type.Optional(Type.String({ format: 'uuid' })),
  fundingSource: Type.Optional(Type.String()),
  period: Type.Optional(Type.String()),
});

export type CreateBudgetInput = Static<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = Static<typeof UpdateBudgetSchema>;
export type BudgetFilterInput = Static<typeof BudgetFilterSchema>;
