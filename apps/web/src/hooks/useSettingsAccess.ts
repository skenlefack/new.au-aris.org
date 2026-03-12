'use client';

import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { useSettingsScope } from '@/lib/api/settings-hooks';

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'];

export function useSettingsAccess() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isContinentalAdmin = role === 'CONTINENTAL_ADMIN';
  const isRecAdmin = role === 'REC_ADMIN';
  const isNationalAdmin = role === 'NATIONAL_ADMIN';

  // Fetch resolved scope from backend
  const { data: scopeData } = useSettingsScope();
  const scope = scopeData?.data as { all: boolean; recCodes: string[]; countryCodes: string[] } | undefined;

  return {
    // REC management
    canManageRecs: isSuperAdmin || isContinentalAdmin,
    canCreateRec: isSuperAdmin,
    canDeleteRec: isSuperAdmin,
    canEditRecStats: isSuperAdmin || isContinentalAdmin || isRecAdmin,

    // Country management
    canManageCountries: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canCreateCountry: isSuperAdmin,
    canDeleteCountry: isSuperAdmin,
    canEditCountryStats: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canEditCountrySectors: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,

    // System config
    canManageConfig: (category: string): boolean => {
      if (isSuperAdmin) return true;
      if (category === 'email') return false; // email config contains secrets — super admin only
      if (isContinentalAdmin && ['branding', 'notifications'].includes(category)) return true;
      return false;
    },

    // Functions management
    canManageFunctions: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canCreateFunction: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canDeleteFunction: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,

    // Users management
    canManageUsers: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canCreateUser: isSuperAdmin || isContinentalAdmin || isRecAdmin || isNationalAdmin,
    canDeleteUser: isSuperAdmin,
    canResetPassword: isSuperAdmin || isContinentalAdmin,

    // Section visibility
    canViewSection: (section: string): boolean => {
      if (isSuperAdmin || isContinentalAdmin) return true;

      switch (section) {
        case 'recs':
          return isRecAdmin;
        case 'countries':
          return isRecAdmin || isNationalAdmin;
        case 'functions':
          return isRecAdmin || isNationalAdmin;
        case 'users':
          return isRecAdmin || isNationalAdmin;
        case 'general':
        case 'security':
          return false;
        case 'notifications':
          return isRecAdmin;
        case 'i18n':
        case 'data-quality':
          return isRecAdmin || isNationalAdmin;
        case 'domains':
          return false;
        case 'workflow':
        case 'validation-chains':
          return isRecAdmin || isNationalAdmin;
        case 'audit':
          return isRecAdmin || isNationalAdmin;
        case 'infrastructures':
          return isRecAdmin || isNationalAdmin;
        case 'bi-access':
          return false; // only super/continental admins
        case 'system':
          return false;
        default:
          return false;
      }
    },

    // Scoping filters — populated from backend scope endpoint
    visibleRecCodes: scope?.all ? null : (scope?.recCodes ?? null),
    visibleCountryCodes: scope?.all ? null : (scope?.countryCodes ?? null),

    // Tenant level from user or scope
    tenantLevel: user?.tenantLevel ?? null,

    // Role flags
    isSuperAdmin,
    isContinentalAdmin,
    isRecAdmin,
    isNationalAdmin,
    isAdmin: ADMIN_ROLES.includes(role as UserRole),
    role,
  };
}
