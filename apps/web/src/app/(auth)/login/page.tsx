'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useLogin } from '@/lib/api/hooks';
import { useTenantStore } from '@/lib/stores/tenant-store';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
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

  const onSubmit = async (data: LoginForm) => {
    setIsLoggingIn(true);
    try {
      await loginMutation.mutateAsync(data);

      // After successful login, fetch the tenant tree in the background
      try {
        await useTenantStore.getState().fetchTenantTree();
      } catch {
        // Tenant fetch failure is non-blocking; the placeholder tree remains
      }

      router.push('/');
    } catch {
      // error is available via loginMutation.error
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      {/* Full-screen loading overlay during login */}
      {isLoggingIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-aris-primary-200 border-t-aris-primary-600" />
            <p className="text-sm font-medium text-gray-600">
              Signing you in...
            </p>
          </div>
        </div>
      )}

      {/* Mobile branding */}
      <div className="mb-8 lg:hidden">
        <h1 className="text-2xl font-bold text-aris-primary-600">ARIS 3.0</h1>
        <p className="text-sm text-gray-500">
          Animal Resources Information System
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="mt-1 text-sm text-gray-500">
          Access the ARIS continental dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {loginMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'Login failed. Please check your credentials.'}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
            placeholder="you@au-ibar.org"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm shadow-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me checkbox (cosmetic) */}
        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-aris-primary-600 focus:ring-2 focus:ring-aris-primary-200"
          />
          <label
            htmlFor="remember-me"
            className="text-sm text-gray-600 select-none"
          >
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || loginMutation.isPending || isLoggingIn}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-aris-primary-700 focus:outline-none focus:ring-2 focus:ring-aris-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loginMutation.isPending || isLoggingIn ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loginMutation.isPending || isLoggingIn
            ? 'Signing in...'
            : 'Sign in'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {"Don't have an account? "}
          <Link
            href="/register"
            className="font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            Request access
          </Link>
        </p>
      </form>
    </>
  );
}
