'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Shield, AlertTriangle, KeyRound, ArrowLeft } from 'lucide-react';
import { useLogin, MfaRequiredError } from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import type { Locale } from '@/lib/i18n/config';
import { LOCALES } from '@/lib/i18n/config';
import { useTranslations } from '@/lib/i18n/translations';
import { usePublicPlatformConfig } from '@/hooks/usePlatformConfig';
import { CountryFlag } from '@/components/ui/CountryFlag';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPanelProps {
  /** Contextual branding */
  context?: {
    level: 'continental' | 'rec' | 'country';
    name: string;
    flag?: string;        // emoji flag for country
    color?: string;       // accent color for the CTA button
    recCode?: string;
    countryCode?: string;
  };
}

export function LoginPanel({ context }: LoginPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionReason = searchParams.get('reason');
  const loginMutation = useLogin();
  const ta = useTranslations('auth');
  const { name: platformName, logoUrl: platformLogoUrl } = usePublicPlatformConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── MFA state ──────────────────────────────────────────────
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<LoginForm | null>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const accentColor = context?.color ?? '#006B3F';

  const onSubmit = async (data: LoginForm) => {
    setIsLoggingIn(true);
    if (sessionReason) {
      const url = new URL(window.location.href);
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }
    try {
      await loginMutation.mutateAsync(data);
      await completeLogin();
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        // Backend says MFA is required — switch to TOTP step
        setSavedCredentials(data);
        setMfaStep(true);
        setMfaCode('');
        setMfaError('');
        setIsLoggingIn(false);
        setTimeout(() => mfaInputRef.current?.focus(), 100);
      } else {
        setIsLoggingIn(false);
      }
    }
  };

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCredentials || mfaCode.length !== 6) return;
    setMfaLoading(true);
    setMfaError('');
    try {
      await loginMutation.mutateAsync({
        ...savedCredentials,
        totpCode: mfaCode,
      });
      setIsLoggingIn(true);
      await completeLogin();
    } catch {
      setMfaError(ta('mfaInvalidCode'));
      setMfaCode('');
      setMfaLoading(false);
      mfaInputRef.current?.focus();
    }
  };

  const completeLogin = async () => {
    try {
      await useTenantStore.getState().fetchTenantTree();
    } catch {
      // non-blocking
    }
    const user = useAuthStore.getState().user;
    if (user?.tenantId) {
      useTenantStore.getState().initFromUser(user.tenantId, user.email);
    }
    if (user?.locale && LOCALES.includes(user.locale as Locale)) {
      useLocaleStore.getState().setLocale(user.locale as Locale);
    }
    router.push('/home');
  };

  const resetMfa = () => {
    setMfaStep(false);
    setMfaCode('');
    setMfaError('');
    setSavedCredentials(null);
    setIsLoggingIn(false);
    loginMutation.reset();
  };

  const contextLabel =
    context?.level === 'country'
      ? `${ta('signInTo')} ${context.name}`
      : context?.level === 'rec'
        ? `${ta('signIn')} \u2014 ${context.name}`
        : `${ta('signInTo')} ${platformName}`;

  const contextSubtitle =
    context?.level === 'country'
      ? ta('accessNational')
      : context?.level === 'rec'
        ? ta('accessRegional')
        : ta('accessContinental');

  // ── MFA TOTP step ──────────────────────────────────────────
  if (mfaStep) {
    return (
      <div className="w-full">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
            <KeyRound className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {ta('mfaRequired')}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {ta('mfaRequiredDesc')}
            </p>
          </div>
        </div>

        <form onSubmit={onMfaSubmit} className="space-y-4">
          {mfaError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {mfaError}
            </div>
          )}

          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {ta('mfaCode')}
            </label>
            <input
              ref={mfaInputRef}
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setMfaCode(val);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-center text-xl font-mono tracking-[0.5em] shadow-sm placeholder:text-gray-400 placeholder:tracking-[0.3em] focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              style={{ '--tw-ring-color': `${accentColor}40` } as React.CSSProperties}
              placeholder={ta('mfaCodePlaceholder')}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={mfaCode.length !== 6 || mfaLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: accentColor,
              '--tw-ring-color': accentColor,
            } as React.CSSProperties}
          >
            {mfaLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            {mfaLoading ? ta('mfaVerifying') : ta('mfaVerify')}
          </button>

          <button
            type="button"
            onClick={resetMfa}
            className="flex w-full items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {ta('mfaBackToLogin')}
          </button>
        </form>
      </div>
    );
  }

  // ── Normal login form ──────────────────────────────────────
  return (
    <div className="w-full">
      {/* Header with logo */}
      <div className="mb-6 flex items-center gap-3">
        {context?.level === 'country' && context.countryCode ? (
          <CountryFlag code={context.countryCode} size={42} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={platformLogoUrl}
            alt={platformName}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {contextLabel}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {contextSubtitle}
          </p>
        </div>
      </div>

      {/* Full-screen loading overlay during login */}
      {isLoggingIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: `${accentColor}33`, borderTopColor: accentColor }}
            />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {ta('signingIn')}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {sessionReason === 'SESSION_REVOKED_NEW_DEVICE' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ta('sessionRevokedNewDevice')}</span>
            </div>
          </div>
        )}
        {sessionReason && sessionReason !== 'SESSION_REVOKED_NEW_DEVICE' && sessionReason !== 'NETWORK_ERROR' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ta('sessionExpiredMessage')}</span>
            </div>
          </div>
        )}
        {loginMutation.error && !(loginMutation.error instanceof MfaRequiredError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : ta('loginFailed')}
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {ta('email')}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
            style={{
              '--tw-ring-color': `${accentColor}40`,
              borderColor: errors.email ? '#EF4444' : undefined,
            } as React.CSSProperties}
            placeholder="you@au-aris.org"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{ta('enterValidEmail')}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {ta('password')}
          </label>
          <div className="relative mt-1">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
              style={{
                '--tw-ring-color': `${accentColor}40`,
                borderColor: errors.password ? '#EF4444' : undefined,
              } as React.CSSProperties}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{ta('passwordMinLength')}</p>
          )}
        </div>

        {/* Remember me + Forgot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              style={{ accentColor }}
            />
            <label htmlFor="remember-me" className="text-sm text-gray-600 select-none dark:text-gray-400">
              {ta('rememberMe')}
            </label>
          </div>
          <Link href="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: accentColor }}>
            {ta('forgotPassword')}
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || loginMutation.isPending || isLoggingIn}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: accentColor,
            '--tw-ring-color': accentColor,
          } as React.CSSProperties}
        >
          {loginMutation.isPending || isLoggingIn ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loginMutation.isPending || isLoggingIn ? ta('signingIn') : ta('signIn')}
        </button>
      </form>

      {/* Footer links */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Shield className="h-3.5 w-3.5" />
          <span>{ta('securedBy')}</span>
        </div>
      </div>
    </div>
  );
}
