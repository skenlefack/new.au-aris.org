import { Type, Static } from '@sinclair/typebox';

// ── Shared ──

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;

export const SubmissionIdParamSchema = Type.Object({
  submissionId: Type.String({ format: 'uuid' }),
});
export type SubmissionIdParam = Static<typeof SubmissionIdParamSchema>;

export const InstanceIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type InstanceIdParam = Static<typeof InstanceIdParamSchema>;

// ── Workflow Definitions ──

const I18nJson = Type.Record(Type.String(), Type.String()); // { "en": "...", "fr": "..." }

export const CreateWorkflowSchema = Type.Object({
  countryId: Type.String({ format: 'uuid' }),
  name: I18nJson,
  description: Type.Optional(I18nJson),
  startLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  endLevel: Type.Optional(Type.Integer({ minimum: -2, maximum: 0 })),
  defaultTransmitDelay: Type.Optional(Type.Integer({ minimum: 1 })),
  defaultValidationDelay: Type.Optional(Type.Integer({ minimum: 1 })),
  autoTransmitEnabled: Type.Optional(Type.Boolean()),
  autoValidateEnabled: Type.Optional(Type.Boolean()),
  requireComment: Type.Optional(Type.Boolean()),
  allowReject: Type.Optional(Type.Boolean()),
  allowReturnForCorrection: Type.Optional(Type.Boolean()),
  notifyOnSubmit: Type.Optional(Type.Boolean()),
  notifyOnValidate: Type.Optional(Type.Boolean()),
  notifyOnReject: Type.Optional(Type.Boolean()),
  notifyOnAutoTransmit: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Any()),
});
export type CreateWorkflowBody = Static<typeof CreateWorkflowSchema>;

export const UpdateWorkflowSchema = Type.Object({
  name: Type.Optional(I18nJson),
  description: Type.Optional(I18nJson),
  isActive: Type.Optional(Type.Boolean()),
  startLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  endLevel: Type.Optional(Type.Integer({ minimum: -2, maximum: 0 })),
  defaultTransmitDelay: Type.Optional(Type.Integer({ minimum: 1 })),
  defaultValidationDelay: Type.Optional(Type.Integer({ minimum: 1 })),
  autoTransmitEnabled: Type.Optional(Type.Boolean()),
  autoValidateEnabled: Type.Optional(Type.Boolean()),
  requireComment: Type.Optional(Type.Boolean()),
  allowReject: Type.Optional(Type.Boolean()),
  allowReturnForCorrection: Type.Optional(Type.Boolean()),
  notifyOnSubmit: Type.Optional(Type.Boolean()),
  notifyOnValidate: Type.Optional(Type.Boolean()),
  notifyOnReject: Type.Optional(Type.Boolean()),
  notifyOnAutoTransmit: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Any()),
});
export type UpdateWorkflowBody = Static<typeof UpdateWorkflowSchema>;

export const ListWorkflowsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  isActive: Type.Optional(Type.Boolean()),
});
export type ListWorkflowsQuery = Static<typeof ListWorkflowsQuerySchema>;

export const CountryCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 2 }),
});
export type CountryCodeParam = Static<typeof CountryCodeParamSchema>;

// ── Workflow Steps ──

export const CreateStepSchema = Type.Object({
  stepOrder: Type.Integer({ minimum: 0 }),
  levelType: Type.String({ minLength: 1, maxLength: 20 }),
  adminLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  name: I18nJson,
  description: Type.Optional(I18nJson),
  assignmentMode: Type.Optional(Type.Union([
    Type.Literal('any'),
    Type.Literal('assigned'),
    Type.Literal('role'),
    Type.Literal('function'),
  ])),
  allowedFunctionIds: Type.Optional(Type.Array(Type.String())),
  canValidate: Type.Optional(Type.Boolean()),
  canReject: Type.Optional(Type.Boolean()),
  canReturnForCorrection: Type.Optional(Type.Boolean()),
  canEdit: Type.Optional(Type.Boolean()),
  canAddComment: Type.Optional(Type.Boolean()),
  canAttachFiles: Type.Optional(Type.Boolean()),
  transmitDelayHours: Type.Optional(Type.Integer({ minimum: 1 })),
  validationDelayHours: Type.Optional(Type.Integer({ minimum: 1 })),
  autoRouteToNext: Type.Optional(Type.Boolean()),
  requireChooseValidator: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Any()),
});
export type CreateStepBody = Static<typeof CreateStepSchema>;

export const UpdateStepSchema = Type.Object({
  name: Type.Optional(I18nJson),
  description: Type.Optional(I18nJson),
  assignmentMode: Type.Optional(Type.String()),
  allowedFunctionIds: Type.Optional(Type.Array(Type.String())),
  canValidate: Type.Optional(Type.Boolean()),
  canReject: Type.Optional(Type.Boolean()),
  canReturnForCorrection: Type.Optional(Type.Boolean()),
  canEdit: Type.Optional(Type.Boolean()),
  canAddComment: Type.Optional(Type.Boolean()),
  canAttachFiles: Type.Optional(Type.Boolean()),
  transmitDelayHours: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  validationDelayHours: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  autoRouteToNext: Type.Optional(Type.Boolean()),
  requireChooseValidator: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.Any()),
});
export type UpdateStepBody = Static<typeof UpdateStepSchema>;

export const StepIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stepId: Type.String({ format: 'uuid' }),
});
export type StepIdParam = Static<typeof StepIdParamSchema>;

// ── Validation Chains ──

export const CreateValidationChainSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  validatorId: Type.String({ format: 'uuid' }),
  priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
  levelType: Type.String({ minLength: 1, maxLength: 20 }),
  backupValidatorId: Type.Optional(Type.String({ format: 'uuid' })),
  metadata: Type.Optional(Type.Any()),
});
export type CreateValidationChainBody = Static<typeof CreateValidationChainSchema>;

export const UpdateValidationChainSchema = Type.Object({
  priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
  isActive: Type.Optional(Type.Boolean()),
  backupValidatorId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
});
export type UpdateValidationChainBody = Static<typeof UpdateValidationChainSchema>;

export const ListValidationChainsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  userId: Type.Optional(Type.String({ format: 'uuid' })),
  validatorId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type ListValidationChainsQuery = Static<typeof ListValidationChainsQuerySchema>;

export const UserIdParamSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
});
export type UserIdParam = Static<typeof UserIdParamSchema>;

// ── Workflow Instances ──

export const ListInstancesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  status: Type.Optional(Type.String()),
  assignee: Type.Optional(Type.String({ format: 'uuid' })),
  priority: Type.Optional(Type.String()),
});
export type ListInstancesQuery = Static<typeof ListInstancesQuerySchema>;

export const ValidateInstanceSchema = Type.Object({
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
  nextValidatorId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type ValidateInstanceBody = Static<typeof ValidateInstanceSchema>;

export const RejectInstanceSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 2000 }),
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type RejectInstanceBody = Static<typeof RejectInstanceSchema>;

export const ReturnInstanceSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 2000 }),
  comment: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type ReturnInstanceBody = Static<typeof ReturnInstanceSchema>;

export const ReassignInstanceSchema = Type.Object({
  newAssigneeId: Type.String({ format: 'uuid' }),
  reason: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type ReassignInstanceBody = Static<typeof ReassignInstanceSchema>;

export const CommentInstanceSchema = Type.Object({
  comment: Type.String({ minLength: 1, maxLength: 2000 }),
  attachments: Type.Optional(Type.Array(Type.Any())),
});
export type CommentInstanceBody = Static<typeof CommentInstanceSchema>;

export const ChooseValidatorSchema = Type.Object({
  validatorId: Type.String({ format: 'uuid' }),
});
export type ChooseValidatorBody = Static<typeof ChooseValidatorSchema>;

// ── Collection Campaigns ──

export const CreateCollectionCampaignSchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 100 }),
  name: I18nJson,
  description: Type.Optional(I18nJson),
  domain: Type.String({ minLength: 2, maxLength: 50 }),
  formTemplateId: Type.String({ format: 'uuid' }),
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
  targetCountries: Type.Optional(Type.Array(Type.String())),
  targetRecIds: Type.Optional(Type.Array(Type.String())),
  targetAdminAreas: Type.Optional(Type.Array(Type.String())),
  targetSubmissions: Type.Optional(Type.Integer({ minimum: 1 })),
  targetPerAgent: Type.Optional(Type.Integer({ minimum: 1 })),
  frequency: Type.Optional(Type.String()),
  scope: Type.Optional(Type.String()),
  sendReminders: Type.Optional(Type.Boolean()),
  reminderDaysBefore: Type.Optional(Type.Integer({ minimum: 1 })),
  metadata: Type.Optional(Type.Any()),
});
export type CreateCollectionCampaignBody = Static<typeof CreateCollectionCampaignSchema>;

export const UpdateCollectionCampaignSchema = Type.Object({
  name: Type.Optional(I18nJson),
  description: Type.Optional(I18nJson),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
  targetCountries: Type.Optional(Type.Array(Type.String())),
  targetRecIds: Type.Optional(Type.Array(Type.String())),
  targetAdminAreas: Type.Optional(Type.Array(Type.String())),
  targetSubmissions: Type.Optional(Type.Integer({ minimum: 1 })),
  targetPerAgent: Type.Optional(Type.Integer({ minimum: 1 })),
  frequency: Type.Optional(Type.String()),
  sendReminders: Type.Optional(Type.Boolean()),
  reminderDaysBefore: Type.Optional(Type.Integer({ minimum: 1 })),
  metadata: Type.Optional(Type.Any()),
});
export type UpdateCollectionCampaignBody = Static<typeof UpdateCollectionCampaignSchema>;

export const ListCollectionCampaignsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  status: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
});
export type ListCollectionCampaignsQuery = Static<typeof ListCollectionCampaignsQuerySchema>;

export const CreateAssignmentSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  countryCode: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  adminLevel1: Type.Optional(Type.String()),
  adminLevel2: Type.Optional(Type.String()),
  adminLevel3: Type.Optional(Type.String()),
  adminLevel4: Type.Optional(Type.String()),
  adminLevel5: Type.Optional(Type.String()),
  targetSubmissions: Type.Optional(Type.Integer({ minimum: 1 })),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
});
export type CreateAssignmentBody = Static<typeof CreateAssignmentSchema>;

export const AssignIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  assignId: Type.String({ format: 'uuid' }),
});
export type AssignIdParam = Static<typeof AssignIdParamSchema>;
