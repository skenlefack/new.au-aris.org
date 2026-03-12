import { Type, type Static } from '@sinclair/typebox';

// Re-export pagination types from tenant.schemas.ts
export { PaginationQuerySchema, type PaginationQueryInput } from './tenant.schemas.js';

// ---------- Shared ----------

const JsonValue = Type.Union([
  Type.String(),
  Type.Record(Type.String(), Type.String()),
]);

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type UuidParamInput = Static<typeof UuidParamSchema>;

// ---------- RECs ----------

export const RecCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50 }),
});
export type RecCodeParamInput = Static<typeof RecCodeParamSchema>;

export const IdOrCodeParamSchema = Type.Object({
  idOrCode: Type.String({ minLength: 1, maxLength: 50 }),
});
export type IdOrCodeParamInput = Static<typeof IdOrCodeParamSchema>;

export const RecBodySchema = Type.Object({
  name: JsonValue,
  fullName: Type.Optional(JsonValue),
  description: Type.Optional(JsonValue),
  region: Type.Optional(JsonValue),
  headquarters: Type.Optional(Type.String({ maxLength: 255 })),
  established: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  accentColor: Type.Optional(Type.String({ maxLength: 20 })),
  logoUrl: Type.Optional(Type.String({ maxLength: 500 })),
  website: Type.Optional(Type.String({ maxLength: 500 })),
  isActive: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  stats: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type RecBodyInput = Static<typeof RecBodySchema>;

export const RecSortBodySchema = Type.Object({
  sortOrder: Type.Integer({ minimum: 0 }),
});
export type RecSortBodyInput = Static<typeof RecSortBodySchema>;

export const RecStatsBodySchema = Type.Object({
  stats: Type.Record(Type.String(), Type.Unknown()),
});
export type RecStatsBodyInput = Static<typeof RecStatsBodySchema>;

// ---------- Countries ----------

export const CountryCodeParamSchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 3 }),
});
export type CountryCodeParamInput = Static<typeof CountryCodeParamSchema>;

export const CountryBodySchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 2, maxLength: 3 })),
  name: Type.Optional(JsonValue),
  officialName: Type.Optional(JsonValue),
  capital: Type.Optional(JsonValue),
  flag: Type.Optional(Type.String({ maxLength: 10 })),
  population: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  area: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
  timezone: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  languages: Type.Optional(Type.Array(Type.String())),
  currency: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  phoneCode: Type.Optional(Type.Union([Type.String({ maxLength: 10 }), Type.Null()])),
  isActive: Type.Optional(Type.Boolean()),
  isOperational: Type.Optional(Type.Boolean()),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  stats: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  sectorPerformance: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type CountryBodyInput = Static<typeof CountryBodySchema>;

export const CountryStatsBodySchema = Type.Object({
  stats: Type.Record(Type.String(), Type.Unknown()),
});
export type CountryStatsBodyInput = Static<typeof CountryStatsBodySchema>;

export const CountrySectorsBodySchema = Type.Object({
  sectorPerformance: Type.Record(Type.String(), Type.Unknown()),
});
export type CountrySectorsBodyInput = Static<typeof CountrySectorsBodySchema>;

export const CountryRecParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  recId: Type.String({ format: 'uuid' }),
});
export type CountryRecParamsInput = Static<typeof CountryRecParamsSchema>;

// ---------- Config ----------

export const ConfigCategoryParamSchema = Type.Object({
  category: Type.String({ minLength: 1, maxLength: 100 }),
});
export type ConfigCategoryParamInput = Static<typeof ConfigCategoryParamSchema>;

export const ConfigKeyParamSchema = Type.Object({
  category: Type.String({ minLength: 1, maxLength: 100 }),
  key: Type.String({ minLength: 1, maxLength: 100 }),
});
export type ConfigKeyParamInput = Static<typeof ConfigKeyParamSchema>;

export const ConfigUpdateBodySchema = Type.Object({
  value: Type.Unknown(),
});
export type ConfigUpdateBodyInput = Static<typeof ConfigUpdateBodySchema>;

export const ConfigBulkBodySchema = Type.Object({
  configs: Type.Array(Type.Object({
    category: Type.String({ minLength: 1, maxLength: 100 }),
    key: Type.String({ minLength: 1, maxLength: 100 }),
    value: Type.Unknown(),
  })),
});
export type ConfigBulkBodyInput = Static<typeof ConfigBulkBodySchema>;

// ---------- Domains ----------

export const DomainCreateBodySchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 30 }),
  name: JsonValue,
  description: Type.Optional(JsonValue),
  icon: Type.String({ maxLength: 100 }),
  color: Type.String({ maxLength: 20 }),
  isActive: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type DomainCreateBodyInput = Static<typeof DomainCreateBodySchema>;

export const DomainBodySchema = Type.Object({
  name: Type.Optional(JsonValue),
  description: Type.Optional(JsonValue),
  icon: Type.Optional(Type.String({ maxLength: 100 })),
  color: Type.Optional(Type.String({ maxLength: 20 })),
  isActive: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type DomainBodyInput = Static<typeof DomainBodySchema>;

export const DomainSortBodySchema = Type.Object({
  items: Type.Array(Type.Object({
    id: Type.String({ format: 'uuid' }),
    sortOrder: Type.Integer({ minimum: 0 }),
  })),
});
export type DomainSortBodyInput = Static<typeof DomainSortBodySchema>;

// ---------- Admin Levels ----------

const MultilingualName = Type.Record(Type.String(), Type.String()); // { "en": "County", "fr": "Comté", ... }

export const AdminLevelItemSchema = Type.Object({
  level: Type.Integer({ minimum: 1, maximum: 5 }),
  name: MultilingualName,
  code: Type.String({ minLength: 1, maxLength: 50 }),
  isActive: Type.Optional(Type.Boolean()),
});
export type AdminLevelItemInput = Static<typeof AdminLevelItemSchema>;

export const AdminLevelsBulkBodySchema = Type.Object({
  levels: Type.Array(AdminLevelItemSchema, { minItems: 1, maxItems: 5 }),
});
export type AdminLevelsBulkBodyInput = Static<typeof AdminLevelsBulkBodySchema>;

export const AdminLevelParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  level: Type.Integer({ minimum: 1, maximum: 5 }),
});
export type AdminLevelParamInput = Static<typeof AdminLevelParamSchema>;

// ---------- Functions (Job Titles / Roles) ----------

const MultilingualJson = Type.Record(Type.String(), Type.String());

export const FunctionBodySchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 30 }),
  name: MultilingualJson,
  description: Type.Optional(Type.Union([MultilingualJson, Type.Null()])),
  level: Type.Union([Type.Literal('continental'), Type.Literal('regional'), Type.Literal('national')]),
  category: Type.Optional(Type.Union([
    Type.Literal('management'), Type.Literal('technical'),
    Type.Literal('data'), Type.Literal('admin'), Type.Literal('field'),
    Type.Null(),
  ])),
  permissions: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  isActive: Type.Optional(Type.Boolean()),
  isDefault: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type FunctionBodyInput = Static<typeof FunctionBodySchema>;

export const FunctionUpdateBodySchema = Type.Object({
  name: Type.Optional(MultilingualJson),
  description: Type.Optional(Type.Union([MultilingualJson, Type.Null()])),
  category: Type.Optional(Type.Union([
    Type.Literal('management'), Type.Literal('technical'),
    Type.Literal('data'), Type.Literal('admin'), Type.Literal('field'),
    Type.Null(),
  ])),
  permissions: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  isActive: Type.Optional(Type.Boolean()),
  isDefault: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  metadata: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
});
export type FunctionUpdateBodyInput = Static<typeof FunctionUpdateBodySchema>;

export const FunctionQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  level: Type.Optional(Type.Union([
    Type.Literal('continental'), Type.Literal('regional'), Type.Literal('national'),
  ])),
  category: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});
export type FunctionQueryInput = Static<typeof FunctionQuerySchema>;

// ---------- User-Function Assignment ----------

export const UserFunctionAssignBodySchema = Type.Object({
  functionId: Type.String({ format: 'uuid' }),
  isPrimary: Type.Optional(Type.Boolean()),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export type UserFunctionAssignBodyInput = Static<typeof UserFunctionAssignBodySchema>;

export const UserFunctionRemoveParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),        // userId
  functionId: Type.String({ format: 'uuid' }),
});
export type UserFunctionRemoveParamsInput = Static<typeof UserFunctionRemoveParamsSchema>;

// ---------- Users Management ----------

export const UserManagementQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  role: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  functionId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type UserManagementQueryInput = Static<typeof UserManagementQuerySchema>;

export const UserCreateBodySchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 255 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  firstName: Type.String({ minLength: 1, maxLength: 100 }),
  lastName: Type.String({ minLength: 1, maxLength: 100 }),
  role: Type.Union([
    Type.Literal('SUPER_ADMIN'), Type.Literal('CONTINENTAL_ADMIN'),
    Type.Literal('REC_ADMIN'), Type.Literal('NATIONAL_ADMIN'),
    Type.Literal('DATA_STEWARD'), Type.Literal('WAHIS_FOCAL_POINT'),
    Type.Literal('ANALYST'), Type.Literal('FIELD_AGENT'),
  ]),
  tenantId: Type.String({ format: 'uuid' }),
  locale: Type.Optional(Type.String({ maxLength: 5 })),
  functionIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});
export type UserCreateBodyInput = Static<typeof UserCreateBodySchema>;

export const UserUpdateBodySchema = Type.Object({
  email: Type.Optional(Type.String({ format: 'email', maxLength: 255 })),
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  role: Type.Optional(Type.Union([
    Type.Literal('SUPER_ADMIN'), Type.Literal('CONTINENTAL_ADMIN'),
    Type.Literal('REC_ADMIN'), Type.Literal('NATIONAL_ADMIN'),
    Type.Literal('DATA_STEWARD'), Type.Literal('WAHIS_FOCAL_POINT'),
    Type.Literal('ANALYST'), Type.Literal('FIELD_AGENT'),
  ])),
  locale: Type.Optional(Type.String({ maxLength: 5 })),
  isActive: Type.Optional(Type.Boolean()),
});
export type UserUpdateBodyInput = Static<typeof UserUpdateBodySchema>;

export const UserPasswordBodySchema = Type.Object({
  password: Type.String({ minLength: 8, maxLength: 128 }),
});
export type UserPasswordBodyInput = Static<typeof UserPasswordBodySchema>;

// ---------- Search Query ----------

export const SearchQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  search: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  recCode: Type.Optional(Type.String()),
});
export type SearchQueryInput = Static<typeof SearchQuerySchema>;
