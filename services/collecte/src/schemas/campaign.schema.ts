import { Type, Static } from '@sinclair/typebox';

export const CreateCampaignSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 255 }),
  domain: Type.String({ minLength: 2, maxLength: 100 }),
  templateId: Type.String({ format: 'uuid' }),
  templateIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  targetCountries: Type.Optional(Type.Array(Type.String({ minLength: 2, maxLength: 2 }))),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  targetZones: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  assignedAgents: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  targetSubmissions: Type.Optional(Type.Integer({ minimum: 1 })),
  description: Type.Optional(Type.String()),
  frequency: Type.Optional(Type.String()),
  sendReminders: Type.Optional(Type.Boolean()),
  reminderDaysBefore: Type.Optional(Type.Integer({ minimum: 1 })),
  conflictStrategy: Type.Optional(
    Type.Union([
      Type.Literal('LAST_WRITE_WINS'),
      Type.Literal('MANUAL_MERGE'),
    ]),
  ),
  dataContractId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type CreateCampaignBody = Static<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 255 })),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  targetZones: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  assignedAgents: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  templateIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  targetCountries: Type.Optional(Type.Array(Type.String({ minLength: 2, maxLength: 2 }))),
  targetSubmissions: Type.Optional(Type.Integer({ minimum: 1 })),
  description: Type.Optional(Type.String()),
  status: Type.Optional(
    Type.Union([
      Type.Literal('PLANNED'),
      Type.Literal('ACTIVE'),
      Type.Literal('COMPLETED'),
      Type.Literal('CANCELLED'),
    ]),
  ),
  conflictStrategy: Type.Optional(
    Type.Union([
      Type.Literal('LAST_WRITE_WINS'),
      Type.Literal('MANUAL_MERGE'),
    ]),
  ),
});
export type UpdateCampaignBody = Static<typeof UpdateCampaignSchema>;

export const ListCampaignsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  domain: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  zone: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});
export type ListCampaignsQuery = Static<typeof ListCampaignsQuerySchema>;

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type IdParam = Static<typeof IdParamSchema>;
