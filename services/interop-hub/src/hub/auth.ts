/**
 * Shared auth setup for hub routes.
 * Reads the RS256 public key once and exports reusable hooks.
 */
import { readFileSync } from 'fs';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthHookOptions } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';

let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
  try { publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
}

const authOpts: AuthHookOptions = { publicKey };

export const auth = authHook(authOpts);
export const tenant = tenantHook();
export const authAndTenant = [auth, tenant];

/** Roles allowed to manage hub resources */
export const hubManagerRoles = rolesHook(
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.INTEROP_MANAGER,
);

/** Read-only hub access (all admin-level + interop manager) */
export const hubReadRoles = rolesHook(
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.INTEROP_MANAGER,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
);
