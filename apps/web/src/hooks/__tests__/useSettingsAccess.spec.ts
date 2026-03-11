import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth store
const mockUser = vi.fn();
vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser() }),
}));

// Mock the settings scope hook
vi.mock('@/lib/api/settings-hooks', () => ({
  useSettingsScope: vi.fn(() => ({ data: undefined })),
}));

import { useSettingsAccess } from '../../hooks/useSettingsAccess';

describe('useSettingsAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should grant full access to SUPER_ADMIN', () => {
    mockUser.mockReturnValue({
      id: 'u1',
      email: 'admin@aris.africa',
      role: 'SUPER_ADMIN',
      tenantId: 'au-ibar',
      tenantLevel: 'CONTINENTAL',
    });

    const access = useSettingsAccess();

    expect(access.isSuperAdmin).toBe(true);
    expect(access.canManageRecs).toBe(true);
    expect(access.canCreateRec).toBe(true);
    expect(access.canDeleteRec).toBe(true);
    expect(access.canManageUsers).toBe(true);
    expect(access.canDeleteUser).toBe(true);
    expect(access.isAdmin).toBe(true);
  });

  it('should limit NATIONAL_ADMIN access', () => {
    mockUser.mockReturnValue({
      id: 'u2',
      email: 'cvo@kenya.go.ke',
      role: 'NATIONAL_ADMIN',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
    });

    const access = useSettingsAccess();

    expect(access.isNationalAdmin).toBe(true);
    expect(access.canManageRecs).toBe(false);
    expect(access.canCreateRec).toBe(false);
    expect(access.canDeleteUser).toBe(false);
    expect(access.canManageUsers).toBe(true);
    expect(access.canEditCountryStats).toBe(true);
    expect(access.isAdmin).toBe(true);
  });

  it('should restrict ANALYST to no admin access', () => {
    mockUser.mockReturnValue({
      id: 'u3',
      email: 'analyst@aris.africa',
      role: 'ANALYST',
      tenantId: 'tenant-ke',
      tenantLevel: 'MEMBER_STATE',
    });

    const access = useSettingsAccess();

    expect(access.isAdmin).toBe(false);
    expect(access.canManageRecs).toBe(false);
    expect(access.canManageUsers).toBe(false);
    expect(access.canManageCountries).toBe(false);
    expect(access.canManageFunctions).toBe(false);
  });

  it('should handle null user gracefully', () => {
    mockUser.mockReturnValue(null);

    const access = useSettingsAccess();

    expect(access.isSuperAdmin).toBe(false);
    expect(access.isAdmin).toBe(false);
    expect(access.role).toBeUndefined();
  });

  it('should compute canViewSection correctly for REC_ADMIN', () => {
    mockUser.mockReturnValue({
      id: 'u4',
      email: 'rec@igad.int',
      role: 'REC_ADMIN',
      tenantId: 'igad',
      tenantLevel: 'REC',
    });

    const access = useSettingsAccess();

    expect(access.canViewSection('recs')).toBe(true);
    expect(access.canViewSection('countries')).toBe(true);
    expect(access.canViewSection('users')).toBe(true);
    expect(access.canViewSection('functions')).toBe(false);
    expect(access.canViewSection('system')).toBe(false);
    expect(access.canViewSection('notifications')).toBe(true);
  });
});
