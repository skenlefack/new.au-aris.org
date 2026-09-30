import { Type, type Static } from '@sinclair/typebox';
import { DataClassificationEnum } from './common.schema.js';

const MultilingualName = Type.Object({
  en: Type.String({ minLength: 1 }),
  fr: Type.Optional(Type.String()),
  pt: Type.Optional(Type.String()),
  ar: Type.Optional(Type.String()),
});

const ProgrammeStatusEnum = Type.Union([
  Type.Literal('DESIGN'),
  Type.Literal('ACTIVE'),
  Type.Literal('SUSPENDED'),
  Type.Literal('CLOSED'),
]);

const LogframeTypeEnum = Type.Union([
  Type.Literal('LOGFRAME'),
  Type.Literal('RESULTS_FRAMEWORK'),
  Type.Literal('THEORY_OF_CHANGE'),
]);

const ReportingFrequencyEnum = Type.Union([
  Type.Literal('WEEKLY'),
  Type.Literal('BIWEEKLY'),
  Type.Literal('MONTHLY'),
  Type.Literal('QUARTERLY'),
]);

const LevelEnum = Type.Union([
  Type.Literal('CONTINENTAL'),
  Type.Literal('REGIONAL'),
  Type.Literal('NATIONAL'),
]);

export const CreateProgrammeSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
  name: MultilingualName,
  description: Type.Optional(MultilingualName),
  donorName: Type.Optional(Type.String({ maxLength: 200 })),
  donorReference: Type.Optional(Type.String({ maxLength: 100 })),
  currency: Type.Optional(Type.String({ maxLength: 10 })),
  totalBudget: Type.Number({ minimum: 0 }),
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
  status: Type.Optional(ProgrammeStatusEnum),
  logframeType: Type.Optional(LogframeTypeEnum),
  reportingFrequency: Type.Optional(ReportingFrequencyEnum),
  level: Type.Optional(LevelEnum),
  geoScope: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  dataClassification: Type.Optional(DataClassificationEnum),
  // Nested structure: components → outputs
  components: Type.Optional(Type.Array(Type.Object({
    code: Type.String({ minLength: 1, maxLength: 20 }),
    name: MultilingualName,
    description: Type.Optional(MultilingualName),
    color: Type.Optional(Type.String({ maxLength: 20 })),
    outputs: Type.Optional(Type.Array(Type.Object({
      code: Type.String({ minLength: 1, maxLength: 20 }),
      name: MultilingualName,
      description: Type.Optional(MultilingualName),
      approvedBudget: Type.Optional(Type.Number({ minimum: 0 })),
    }))),
  }))),
});

export const UpdateProgrammeSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  name: Type.Optional(MultilingualName),
  description: Type.Optional(MultilingualName),
  donorName: Type.Optional(Type.String({ maxLength: 200 })),
  donorReference: Type.Optional(Type.String({ maxLength: 100 })),
  currency: Type.Optional(Type.String({ maxLength: 10 })),
  totalBudget: Type.Optional(Type.Number({ minimum: 0 })),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
  status: Type.Optional(ProgrammeStatusEnum),
  logframeType: Type.Optional(LogframeTypeEnum),
  reportingFrequency: Type.Optional(ReportingFrequencyEnum),
  level: Type.Optional(LevelEnum),
  geoScope: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  dataClassification: Type.Optional(DataClassificationEnum),
});

export const ProgrammeFilterSchema = Type.Object({
  status: Type.Optional(ProgrammeStatusEnum),
  level: Type.Optional(LevelEnum),
  donorName: Type.Optional(Type.String()),
});

export type CreateProgrammeInput = Static<typeof CreateProgrammeSchema>;
export type UpdateProgrammeInput = Static<typeof UpdateProgrammeSchema>;
export type ProgrammeFilterInput = Static<typeof ProgrammeFilterSchema>;
