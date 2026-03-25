export { authHook } from './auth.hook';
export type { AuthHookOptions } from './auth.hook';
export { rolesHook, tenantHook } from './roles.hook';
export { domainsHook } from './domains.hook';

// Plugin-based approach (registers app.authenticate decorator)
export { default as fastifyAuth } from './auth-plugin';

// Aliases matching the plan naming convention
export { rolesHook as requireRoles, tenantHook as requireTenant } from './roles.hook';
