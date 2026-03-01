import { Type, Static } from '@sinclair/typebox';

const FieldOverrideSchema = Type.Object({
  fieldId: Type.String(),
  action: Type.Union([
    Type.Literal('MODIFY'),
    Type.Literal('ADD'),
    Type.Literal('REMOVE'),
    Type.Literal('REORDER'),
  ]),
  data: Type.Record(Type.String(), Type.Unknown()),
});

const SectionOverrideSchema = Type.Object({
  sectionId: Type.String(),
  action: Type.Union([
    Type.Literal('MODIFY'),
    Type.Literal('ADD'),
    Type.Literal('REMOVE'),
    Type.Literal('REORDER'),
  ]),
  data: Type.Record(Type.String(), Type.Unknown()),
});

export const CreateOverlaySchema = Type.Object({
  tenantId: Type.String({ format: 'uuid' }),
  tenantLevel: Type.Union([
    Type.Literal('REC'),
    Type.Literal('MEMBER_STATE'),
  ]),
  fieldOverrides: Type.Array(FieldOverrideSchema, { minItems: 1 }),
  sectionOverrides: Type.Optional(Type.Array(SectionOverrideSchema)),
  metadataOverrides: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type CreateOverlayBody = Static<typeof CreateOverlaySchema>;

export const UpdateOverlaySchema = Type.Object({
  fieldOverrides: Type.Optional(Type.Array(FieldOverrideSchema, { minItems: 1 })),
  sectionOverrides: Type.Optional(Type.Array(SectionOverrideSchema)),
  metadataOverrides: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type UpdateOverlayBody = Static<typeof UpdateOverlaySchema>;

export const OverlayIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  overlayId: Type.String({ format: 'uuid' }),
});
export type OverlayIdParam = Static<typeof OverlayIdParamSchema>;

export const TemplateIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type TemplateIdParam = Static<typeof TemplateIdParamSchema>;

export const ResolveTenantQuerySchema = Type.Object({
  tenantId: Type.String({ format: 'uuid' }),
});
export type ResolveTenantQuery = Static<typeof ResolveTenantQuerySchema>;

export const PropagateBodySchema = Type.Object({
  modifiedFieldIds: Type.Array(Type.String(), { minItems: 1 }),
});
export type PropagateBody = Static<typeof PropagateBodySchema>;

export const ListOverlaysQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  tenantLevel: Type.Optional(Type.Union([
    Type.Literal('REC'),
    Type.Literal('MEMBER_STATE'),
  ])),
});
export type ListOverlaysQuery = Static<typeof ListOverlaysQuerySchema>;

export const HistoryQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type HistoryQuery = Static<typeof HistoryQuerySchema>;
