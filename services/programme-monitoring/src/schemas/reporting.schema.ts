import { Type, type Static } from '@sinclair/typebox';

export const CreateCycleSchema = Type.Object({
  cycleType: Type.Union([
    Type.Literal('WEEKLY'),
    Type.Literal('MONTHLY'),
    Type.Literal('QUARTERLY'),
    Type.Literal('ANNUAL'),
  ]),
  periodLabel: Type.String({ minLength: 1, maxLength: 50 }),
  periodStart: Type.String({ format: 'date' }),
  periodEnd: Type.String({ format: 'date' }),
  deadline: Type.String(), // ISO datetime
});

export const UpdateCycleSchema = Type.Object({
  status: Type.Optional(Type.Union([
    Type.Literal('OPEN'),
    Type.Literal('SUBMITTED'),
    Type.Literal('VALIDATED'),
    Type.Literal('PUBLISHED'),
  ])),
  narrative: Type.Optional(Type.String()),
});

export const CreateReportSchema = Type.Object({
  overallNote: Type.Optional(Type.String()),
  items: Type.Array(Type.Object({
    activityId: Type.String({ format: 'uuid' }),
    previousStatus: Type.String(),
    currentStatus: Type.String(),
    completionPercent: Type.Integer({ minimum: 0, maximum: 100 }),
    expenditureThisPeriod: Type.Optional(Type.Number({ minimum: 0 })),
    narrative: Type.Optional(Type.String()),
    blockers: Type.Optional(Type.String()),
    supportNeeded: Type.Optional(Type.String()),
    attachments: Type.Optional(Type.Array(Type.String())),
  })),
});

export const ValidateReportSchema = Type.Object({
  status: Type.Union([
    Type.Literal('VALIDATED'),
    Type.Literal('REJECTED'),
  ]),
  validationComment: Type.Optional(Type.String()),
});

export type CreateCycleInput = Static<typeof CreateCycleSchema>;
export type UpdateCycleInput = Static<typeof UpdateCycleSchema>;
export type CreateReportInput = Static<typeof CreateReportSchema>;
export type ValidateReportInput = Static<typeof ValidateReportSchema>;
