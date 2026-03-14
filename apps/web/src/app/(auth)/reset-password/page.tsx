'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { useResetPassword } from '@/lib/api/hooks';
import { useTranslations } from '@/lib/i18n/translations';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const mutation = useResetPassword();
  const t = useTranslations('auth');

  if (!token) {
    return (
      <>
        <div className="mb-8 lg:hidden">
          <h1 className="text-2xl font-bold text-aris-primary-600">ARIS</h1>
          <p className="text-sm text-gray-500">Animal Resources Information System</p>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('invalidLink')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('invalidLinkDesc')}
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            {t('requestNewLink')}
          </Link>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <div className="mb-8 lg:hidden">
          <h1 className="text-2xl font-bold text-aris-primary-600">ARIS</h1>
          <p className="text-sm text-gray-500">Animal Resources Information System</p>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('passwordReset')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('passwordResetSuccess')}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-aris-primary-700"
          >
            {t('signIn')}
          </Link>
        </div>
      </>
    );
  }

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;
    try {
      await mutation.mutateAsync({ token, newPassword });
      setSuccess(true);
    } catch {
      // error available via mutation.error
    }
  };

  return (
    <>
      <div className="mb-8 lg:hidden">
        <h1 className="text-2xl font-bold text-aris-primary-600">ARIS</h1>
        <p className="text-sm text-gray-500">Animal Resources Information System</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('resetYourPassword')}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('resetPasswordDesc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error instanceof Error
              ? mutation.error.message
              : t('resetFailed')}
          </div>
        )}

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            {t('newPassword')}
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            {t('confirmNewPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
              passwordMismatch
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-aris-primary-500 focus:ring-aris-primary-200'
            }`}
          />
          {passwordMismatch && (
            <p className="mt-1 text-xs text-red-600">{t('passwordsDoNotMatch')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || newPassword.length < 8 || passwordMismatch || !confirmPassword}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-aris-primary-700 focus:outline-none focus:ring-2 focus:ring-aris-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {mutation.isPending ? t('resetting') : t('resetPasswordBtn')}
        </button>

        <p className="text-center text-sm text-gray-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('backToSignIn')}
          </Link>
        </p>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aris-primary-200 border-t-aris-primary-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
