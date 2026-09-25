// Types
export type {
  NodeCode,
  LevelCode,
  UserAccessContext,
  CampaignScopes,
  VisibilityOptions,
  VisibilityInput,
} from './types';
export { ADMIN_BYPASS_ROLES } from './types';

// Visibility logic
export {
  canViewCampaign,
  buildNodeCode,
  parseNodeCode,
  buildAccessLevelSqlFilter,
} from './visibility';

// Feature flag & Redis keys
export {
  ACCESS_LEVELS_ENV_KEY,
  isAccessLevelsEnabled,
  ACCESS_CONTEXT_REDIS_PREFIX,
  accessContextKey,
} from './feature-flag';

// Zod schemas & input types
export {
  nodeCodeSchema,
  levelCodeSchema,
  labelsSchema,
  createAccessLevelSchema,
  updateAccessLevelSchema,
  deactivateAccessLevelSchema,
  reorderAccessLevelsSchema,
  copyAccessLevelsSchema,
  scopeEntrySchema,
  replaceScopesSchema,
} from './schemas';
export type {
  CreateAccessLevelInput,
  UpdateAccessLevelInput,
  ReorderAccessLevelsInput,
  CopyAccessLevelsInput,
  ScopeEntry,
  ReplaceScopesInput,
} from './schemas';
