/**
 * Kafka topics published by the tenant service that are not (yet) in
 * @aris/shared-types. Every topic here must exist in Kafka: a missing topic
 * jams the producer and blocks all tenant events, welcome emails included.
 * The Kafka health monitor checks that they exist.
 */
export const TOPIC_SETTINGS_REC_UPDATED = 'sys.settings.rec.updated.v1';
export const TOPIC_SETTINGS_COUNTRY_UPDATED = 'sys.settings.country.updated.v1';
export const TOPIC_SETTINGS_CONFIG_UPDATED = 'sys.settings.config.updated.v1';
export const TOPIC_SETTINGS_DOMAIN_UPDATED = 'sys.settings.domain.updated.v1';
export const TOPIC_SETTINGS_FUNCTION_UPDATED = 'sys.settings.function.updated.v1';
export const TOPIC_SETTINGS_USER_UPDATED = 'sys.settings.user.updated.v1';
export const TOPIC_SETTINGS_STAT_DEF_UPDATED = 'sys.settings.statistic-definition.updated.v1';
export const TOPIC_SETTINGS_KPI_DEF_UPDATED = 'sys.settings.kpi-definition.updated.v1';
export const TOPIC_SETTINGS_COUNTRY_STAT_UPDATED = 'sys.settings.country-statistic.updated.v1';
export const TOPIC_SETTINGS_COUNTRY_KPI_UPDATED = 'sys.settings.country-kpi-score.updated.v1';
export const TOPIC_SETTINGS_ROLE_UPDATED = 'sys.settings.role.updated.v1';
export const TOPIC_ACCESS_LEVEL_CREATED = 'sys.config.access-level.created.v1';
export const TOPIC_ACCESS_LEVEL_UPDATED = 'sys.config.access-level.updated.v1';
export const TOPIC_ACCESS_LEVEL_DEACTIVATED = 'sys.config.access-level.deactivated.v1';
export const TOPIC_USER_ACCESS_LEVELS_UPDATED = 'sys.credential.user.access-levels-updated.v1';
export const TOPIC_TENANT_ONBOARDING_SUBMITTED = 'sys.tenant.onboarding.submitted.v1';

export const TENANT_LOCAL_TOPICS: readonly string[] = [
  TOPIC_SETTINGS_REC_UPDATED,
  TOPIC_SETTINGS_COUNTRY_UPDATED,
  TOPIC_SETTINGS_CONFIG_UPDATED,
  TOPIC_SETTINGS_DOMAIN_UPDATED,
  TOPIC_SETTINGS_FUNCTION_UPDATED,
  TOPIC_SETTINGS_USER_UPDATED,
  TOPIC_SETTINGS_STAT_DEF_UPDATED,
  TOPIC_SETTINGS_KPI_DEF_UPDATED,
  TOPIC_SETTINGS_COUNTRY_STAT_UPDATED,
  TOPIC_SETTINGS_COUNTRY_KPI_UPDATED,
  TOPIC_SETTINGS_ROLE_UPDATED,
  TOPIC_ACCESS_LEVEL_CREATED,
  TOPIC_ACCESS_LEVEL_UPDATED,
  TOPIC_ACCESS_LEVEL_DEACTIVATED,
  TOPIC_USER_ACCESS_LEVELS_UPDATED,
  TOPIC_TENANT_ONBOARDING_SUBMITTED,
];
