// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, adoptSessionFromOtherTab } from '../auth-store';
import type { AuthUser } from '../auth-store';

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'admin@aris.africa',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: 'NATIONAL_ADMIN',
  roles: ['NATIONAL_ADMIN'],
  tenantId: 'tenant-ke',
  tenantLevel: 'MEMBER_STATE',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it('should have null user and isAuthenticated=false initially', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set all fields via setAuth', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token-1', 'refresh-token-1');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-token-1');
    expect(state.refreshToken).toBe('refresh-token-1');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should update only accessToken via updateToken', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh');
    useAuthStore.getState().updateToken('new-access');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('old-refresh');
    expect(state.user).toEqual(mockUser);
  });

  it('should update both tokens via updateTokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh');
    useAuthStore.getState().updateTokens('new-access', 'new-refresh');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
  });

  it('should clear all state on logout', () => {
    useAuthStore.getState().setAuth(mockUser, 'access', 'refresh');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});

describe('adoptSessionFromOtherTab', () => {
  const writeStorage = (state: Record<string, unknown> | null) => {
    if (state) localStorage.setItem('aris-auth', JSON.stringify({ state, version: 0 }));
    else localStorage.removeItem('aris-auth');
  };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: mockUser,
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      isAuthenticated: true,
    });
  });

  it('adopts a newer session written by another tab', () => {
    writeStorage({ user: mockUser, accessToken: 'new-access', refreshToken: 'new-refresh', isAuthenticated: true });

    expect(adoptSessionFromOtherTab()).toBe(true);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.isAuthenticated).toBe(true);
  });

  it('does nothing when storage holds the same session', () => {
    writeStorage({ user: mockUser, accessToken: 'old-access', refreshToken: 'old-refresh', isAuthenticated: true });

    expect(adoptSessionFromOtherTab()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe('old-access');
  });

  it('does nothing when storage is logged out or empty', () => {
    writeStorage({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    expect(adoptSessionFromOtherTab()).toBe(false);

    writeStorage(null);
    expect(adoptSessionFromOtherTab()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe('old-access');
  });
});
