'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post<{
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          role: string;
          tenantId: string;
        };
        accessToken: string;
        refreshToken: string;
      }>('/credential/login', { email, password });

      const { user, accessToken, refreshToken } = response;

      if (user.role !== 'SUPER_ADMIN' && user.role !== 'CONTINENTAL_ADMIN') {
        setError('Access denied. Only system administrators can access this panel.');
        setLoading(false);
        return;
      }

      setAuth(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as 'SUPER_ADMIN' | 'CONTINENTAL_ADMIN',
          tenantId: user.tenantId,
        },
        accessToken,
        refreshToken,
      );

      router.push('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Authentication failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 lg:hidden">
        <Shield className="w-8 h-8 text-primary-500" />
        <h1 className="text-xl font-bold text-admin-heading">ARIS Admin</h1>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-admin-heading mb-2">
          Administrator Login
        </h2>
        <p className="text-admin-muted text-sm">
          Restricted to SUPER_ADMIN and CONTINENTAL_ADMIN roles only.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-danger-500/10 border border-danger-500/20 rounded-lg text-danger-500 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-admin-text mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-input w-full"
            placeholder="admin@au-aris.org"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-admin-text mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input w-full pr-10"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="admin-btn-primary w-full flex items-center justify-center gap-2 py-2.5"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {loading ? 'Authenticating...' : 'Sign in to Admin Panel'}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-admin-muted">
        This is a restricted administration interface.
        <br />
        Unauthorized access attempts are logged and audited.
      </p>
    </div>
  );
}
