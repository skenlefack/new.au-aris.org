import { Type, Static } from '@sinclair/typebox';

// ── Enums (mirror Prisma dashboard-builder.prisma) ──

export const DashboardOwnershipSchema = Type.Union([
  Type.Literal('SYSTEM_TEMPLATE'),
  Type.Literal('USER_OWNED'),
  Type.Literal('SHARED'),
]);

export const DashboardScopeSchema = Type.Union([
  Type.Literal('CONTINENTAL'),
  Type.Literal('REC'),
  Type.Literal('COUNTRY'),
  Type.Literal('PERSONAL'),
]);

export const WidgetTypeSchema = Type.Union([
  Type.Literal('KPI_CARD'),
  Type.Literal('LINE_CHART'),
  Type.Literal('BAR_CHART'),
  Type.Literal('PIE_CHART'),
  Type.Literal('STACKED_BAR'),
  Type.Literal('AREA_CHART'),
  Type.Literal('TABLE'),
  Type.Literal('MAP_AFRICA'),
  Type.Literal('HEATMAP'),
  Type.Literal('GAUGE'),
  Type.Literal('TEXT_BLOCK'),
  Type.Literal('IFRAME_BI'),
  Type.Literal('COMPOSITE_FORMULA'),
  Type.Literal('ALERT_FEED'),
  Type.Literal('PROGRESS_BAR'),
  Type.Literal('STAT_CARD'),
  Type.Literal('DIVIDER'),
  Type.Literal('IMAGE'),
  Type.Literal('LIST'),
  Type.Literal('RANKED_LIST'),
  Type.Literal('ACTIVITY_FEED'),
  Type.Literal('EPI_CURVE'),
  Type.Literal('DUAL_AXIS'),
  Type.Literal('COUNTER'),
]);

export const WidgetDataSourceSchema = Type.Union([
  Type.Literal('INDICATOR'),
  Type.Literal('FORM_AGGREGATION'),
  Type.Literal('KPI_CONTINENTAL'),
  Type.Literal('MANUAL_VALUE'),
  Type.Literal('COMPOSITE'),
  Type.Literal('SQL_QUERY'),
]);

export const SharePermissionSchema = Type.Union([
  Type.Literal('VIEW'),
  Type.Literal('CLONE'),
]);

// ── Dashboard ──

export const CreateDashboardSchema = Type.Object({
  ownership: Type.Optional(DashboardOwnershipSchema),
  scope: Type.Optional(DashboardScopeSchema),
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  subDomainId: Type.Optional(Type.String({ format: 'uuid' })),
  valueChainCode: Type.Optional(Type.String({ maxLength: 30 })),
  recCode: Type.Optional(Type.String({ maxLength: 20 })),
  countryCode: Type.Optional(Type.String({ maxLength: 2 })),
  campaignId: Type.Optional(Type.String({ format: 'uuid' })),
  titleFr: Type.String({ minLength: 1 }),
  titleEn: Type.String({ minLength: 1 }),
  titleAr: Type.Optional(Type.String()),
  titlePt: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  gridColumns: Type.Optional(Type.Integer({ minimum: 1, maximum: 24, default: 12 })),
  rowHeight: Type.Optional(Type.Integer({ minimum: 20, maximum: 300, default: 80 })),
  isDefault: Type.Optional(Type.Boolean({ default: false })),
  cloneFrom: Type.Optional(Type.String({ format: 'uuid' })),
});
export type CreateDashboardDto = Static<typeof CreateDashboardSchema>;

export const UpdateDashboardSchema = Type.Partial(
  Type.Omit(CreateDashboardSchema, ['cloneFrom']),
);
export type UpdateDashboardDto = Static<typeof UpdateDashboardSchema>;

export const DashboardIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type DashboardIdParam = Static<typeof DashboardIdParamSchema>;

// ── Widget ──

export const CreateWidgetSchema = Type.Object({
  type: WidgetTypeSchema,
  dataSource: Type.Optional(WidgetDataSourceSchema),
  sectionId: Type.Optional(Type.String({ format: 'uuid' })),
  columnIndex: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  gridX: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  gridY: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  gridW: Type.Optional(Type.Integer({ minimum: 1, maximum: 12, default: 3 })),
  gridH: Type.Optional(Type.Integer({ minimum: 1, default: 2 })),
  titleFr: Type.String({ minLength: 1 }),
  titleEn: Type.String({ minLength: 1 }),
  titleAr: Type.Optional(Type.String()),
  titlePt: Type.Optional(Type.String()),
  config: Type.Optional(Type.Any()),
  filters: Type.Optional(Type.Any()),
});
export type CreateWidgetDto = Static<typeof CreateWidgetSchema>;

export const UpdateWidgetSchema = Type.Partial(CreateWidgetSchema);
export type UpdateWidgetDto = Static<typeof UpdateWidgetSchema>;

export const BatchUpdateWidgetsSchema = Type.Object({
  widgets: Type.Array(
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      sectionId: Type.Optional(Type.String({ format: 'uuid' })),
      columnIndex: Type.Optional(Type.Integer({ minimum: 0 })),
      sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
      gridX: Type.Optional(Type.Integer({ minimum: 0 })),
      gridY: Type.Optional(Type.Integer({ minimum: 0 })),
      gridW: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
      gridH: Type.Optional(Type.Integer({ minimum: 1 })),
    }),
    { minItems: 1, maxItems: 100 },
  ),
});
export type BatchUpdateWidgetsDto = Static<typeof BatchUpdateWidgetsSchema>;

// ── Section ──

export const SaveLayoutSchema = Type.Object({
  sections: Type.Array(
    Type.Object({
      id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
      titleFr: Type.Optional(Type.String({ default: '' })),
      titleEn: Type.Optional(Type.String({ default: '' })),
      titleAr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      titlePt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      columnCount: Type.Optional(Type.Integer({ minimum: 1, maximum: 12, default: 2 })),
      sortOrder: Type.Integer({ minimum: 0 }),
      isCollapsed: Type.Optional(Type.Boolean({ default: false })),
      config: Type.Optional(Type.Any()),
    }),
    { maxItems: 50 },
  ),
  widgets: Type.Array(
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      sectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
      columnIndex: Type.Integer({ minimum: 0 }),
      sortOrder: Type.Integer({ minimum: 0 }),
    }),
    { maxItems: 200 },
  ),
});
export type SaveLayoutDto = Static<typeof SaveLayoutSchema>;

export const WidgetIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  widgetId: Type.String({ format: 'uuid' }),
});
export type WidgetIdParam = Static<typeof WidgetIdParamSchema>;

// ── Share ──

export const ShareTypeSchema = Type.Union([
  Type.Literal('USER'),
  Type.Literal('ROLE'),
  Type.Literal('COUNTRY'),
  Type.Literal('REC'),
  Type.Literal('PUBLIC'),
]);

export const CreateShareSchema = Type.Object({
  shareType: ShareTypeSchema,
  sharedWithUserId: Type.Optional(Type.String({ format: 'uuid' })),
  sharedWithRole: Type.Optional(Type.String({ maxLength: 30 })),
  sharedWithTenantId: Type.Optional(Type.String({ format: 'uuid' })),
  isPublic: Type.Optional(Type.Boolean({ default: false })),
  permission: Type.Optional(SharePermissionSchema),
  shareLabel: Type.Optional(Type.String({ maxLength: 120 })),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});
export type CreateShareDto = Static<typeof CreateShareSchema>;

export const UpdateShareSchema = Type.Object({
  permission: Type.Optional(SharePermissionSchema),
  expiresAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  status: Type.Optional(Type.Union([Type.Literal('ACTIVE'), Type.Literal('REVOKED')])),
});
export type UpdateShareDto = Static<typeof UpdateShareSchema>;

export const ListSharesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListSharesQuery = Static<typeof ListSharesQuerySchema>;

export const ShareIdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  shareId: Type.String({ format: 'uuid' }),
});
export type ShareIdParam = Static<typeof ShareIdParamSchema>;

// ── Preference ──

export const SetPreferenceSchema = Type.Object({
  scope: DashboardScopeSchema,
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  subDomainId: Type.Optional(Type.String({ format: 'uuid' })),
  valueChainCode: Type.Optional(Type.String({ maxLength: 30 })),
  dashboardId: Type.String({ format: 'uuid' }),
});
export type SetPreferenceDto = Static<typeof SetPreferenceSchema>;

// ── Query ──

export const ListDashboardsQuerySchema = Type.Object({
  scope: Type.Optional(DashboardScopeSchema),
  domainCode: Type.Optional(Type.String()),
  subDomainCode: Type.Optional(Type.String()),
  recCode: Type.Optional(Type.String({ maxLength: 20 })),
  countryCode: Type.Optional(Type.String({ maxLength: 2 })),
  campaignId: Type.Optional(Type.String({ format: 'uuid' })),
  ownership: Type.Optional(DashboardOwnershipSchema),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type ListDashboardsQuery = Static<typeof ListDashboardsQuerySchema>;

export const DefaultForQuerySchema = Type.Object({
  scope: DashboardScopeSchema,
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
  subDomainId: Type.Optional(Type.String({ format: 'uuid' })),
  valueChainCode: Type.Optional(Type.String({ maxLength: 30 })),
});
export type DefaultForQuery = Static<typeof DefaultForQuerySchema>;

export const RenderQuerySchema = Type.Object({
  countryCode: Type.Optional(Type.String({ maxLength: 2 })),
  recCode: Type.Optional(Type.String({ maxLength: 20 })),
  year: Type.Optional(Type.Integer()),
  domainId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type RenderQuery = Static<typeof RenderQuerySchema>;
