import { Type, Static } from '@sinclair/typebox';

// ── Enums ──
const TicketCategoryEnum = Type.Union([
  Type.Literal('TECHNICAL'),
  Type.Literal('DATA_QUALITY'),
  Type.Literal('ACCESS'),
  Type.Literal('GENERAL'),
]);

const TicketPriorityEnum = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
  Type.Literal('CRITICAL'),
]);

const TicketStatusEnum = Type.Union([
  Type.Literal('OPEN'),
  Type.Literal('IN_PROGRESS'),
  Type.Literal('ESCALATED'),
  Type.Literal('RESOLVED'),
  Type.Literal('CLOSED'),
]);

// ── Create Ticket ──
export const CreateTicketBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.String({ minLength: 1, maxLength: 5000 }),
  category: TicketCategoryEnum,
  priority: TicketPriorityEnum,
  attachmentKeys: Type.Optional(Type.Array(Type.String())),
});
export type CreateTicketDto = Static<typeof CreateTicketBody>;

export const CreateTicketSchema = { body: CreateTicketBody };

// ── Update Ticket ──
export const UpdateTicketBody = Type.Object({
  status: Type.Optional(TicketStatusEnum),
  assignedTo: Type.Optional(Type.String({ format: 'uuid' })),
  priority: Type.Optional(TicketPriorityEnum),
});
export type UpdateTicketDto = Static<typeof UpdateTicketBody>;

export const UpdateTicketSchema = {
  body: UpdateTicketBody,
  params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
};

// ── Add Comment ──
export const AddCommentBody = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  isInternal: Type.Optional(Type.Boolean()),
});
export type AddCommentDto = Static<typeof AddCommentBody>;

export const AddCommentSchema = {
  body: AddCommentBody,
  params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
};

// ── List Query ──
export const ListQuerystring = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(TicketStatusEnum),
  category: Type.Optional(TicketCategoryEnum),
  priority: Type.Optional(TicketPriorityEnum),
  sort: Type.Optional(Type.String({ default: 'created_at' })),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});
export type ListQuery = Static<typeof ListQuerystring>;

export const ListTicketsSchema = { querystring: ListQuerystring };

// ── Param Schemas ──
export const IdParam = Type.Object({ id: Type.String({ format: 'uuid' }) });
export const IdParamSchema = { params: IdParam };

// ── Escalate Ticket ──
export const EscalateBody = Type.Object({
  targetTenantId: Type.String({ format: 'uuid' }),
  reason: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type EscalateDto = Static<typeof EscalateBody>;

export const EscalateSchema = {
  body: EscalateBody,
  params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
};

// ── SLA Stats Query ──
export const SlaStatsQuerystring = Type.Object({
  period: Type.Optional(Type.Union([
    Type.Literal('7d'),
    Type.Literal('30d'),
    Type.Literal('90d'),
  ])),
});
export type SlaStatsQuery = Static<typeof SlaStatsQuerystring>;

export const SlaStatsSchema = { querystring: SlaStatsQuerystring };
