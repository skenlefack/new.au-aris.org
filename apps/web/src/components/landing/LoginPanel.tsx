'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import { useLogin } from '@/lib/api/hooks';
import { useTenantStore } from '@/lib/stores/tenant-store';

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
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
    try {
      await loginMutation.mutateAsync(data);
      try {
        await useTenantStore.getState().fetchTenantTree();
      } catch {
        // non-blocking
      }
      router.push('/home');
    } catch {
      setIsLoggingIn(false);
    }
  };

  const contextLabel =
    context?.level === 'country'
      ? `Sign in to ${context.name}`
      : context?.level === 'rec'
        ? `Sign in \u2014 ${context.name}`
        : 'Sign in to ARIS';

  const contextSubtitle =
    context?.level === 'country'
      ? 'Access your national dashboard'
      : context?.level === 'rec'
        ? 'Access the regional dashboard'
        : 'Access the continental dashboard';

  return (
    <div className="w-full">
      {/* Header with logo */}
      <div className="mb-6 flex items-center gap-3">
        {context?.level === 'country' && context.flag ? (
          <span className="text-4xl">{context.flag}</span>
        ) : (
          <Image
            src="/au-logo.png"
            alt="African Union"
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
              Signing you in...
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {loginMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'Connexion \u00e9chou\u00e9e. V\u00e9rifiez vos identifiants.'}
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email address
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
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
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
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
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
              Remember me
            </label>
          </div>
          <Link href="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: accentColor }}>
            Forgot password?
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
          {loginMutation.isPending || isLoggingIn ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Footer links */}
      <div className="mt-5 space-y-3">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {"Don't have an account? "}
          <Link href="/register" className="font-medium hover:underline" style={{ color: accentColor }}>
            Request access
          </Link>
        </p>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Shield className="h-3.5 w-3.5" />
          <span>Secured by AU-IBAR \u2022 End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
