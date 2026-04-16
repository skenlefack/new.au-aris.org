'use client';

/**
 * ForcePasswordChangeModal
 *
 * Blocking modal shown on first login (or after an admin reset) to force
 * the user to change their temporary password before they can access the
 * application.
 *
 * - Cannot be dismissed (no close button, no escape, no backdrop click).
 * - Mounted globally in the dashboard layout.
 * - Renders only when the authenticated user has mustChangePassword=true.
 * - On success the auth store flag is cleared by useChangeMyPassword's
 *   onSuccess hook and this component unmounts.
 */
import React, { useMemo, useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useChangeMyPassword } from '@/lib/api/hooks';
import { useTranslations } from '@/lib/i18n/translations';

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function scorePassword(pw: string): StrengthLevel {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(score, 4) as StrengthLevel;
}

export function ForcePasswordChangeModal() {
  const t = useTranslations('auth');
  const user = useAuthStore((s) => s.user);
  const mustChange = Boolean(user?.mustChangePassword);
  const changePassword = useChangeMyPassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => scorePassword(newPassword), [newPassword]);

  if (!mustChange) return null;

  const strengthLabel = ['', t('passwordStrengthWeak'), t('passwordStrengthWeak'), t('passwordStrengthFair'), t('passwordStrengthGood')][strength];
  const strengthColor =
    strength <= 1 ? 'bg-red-500'
    : strength === 2 ? 'bg-orange-500'
    : strength === 3 ? 'bg-yellow-500'
    : 'bg-emerald-500';

  const minOk = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const matchOk = newPassword.length > 0 && newPassword === confirmPassword;
  const differsOk = newPassword.length > 0 && newPassword !== currentPassword;
  const canSubmit = minOk && hasLetter && hasDigit && matchOk && differsOk && currentPassword.length > 0 && !changePassword.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirmPassword) {
      setLocalError(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword === currentPassword) {
      setLocalError(t('passwordMustDiffer'));
      return;
    }
    if (!hasLetter || !hasDigit) {
      setLocalError(t('passwordComplexity'));
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setSuccess(true);
      // The auth-store flag is cleared by the mutation's onSuccess; we keep
      // the success banner visible for ~1.2s before the modal unmounts.
    } catch (err: any) {
      const apiMsg = err?.response?.data?.message ?? err?.message;
      setLocalError(apiMsg || t('passwordChangeFailed'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-pwd-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
        // Intentionally no close on click-outside — blocking modal
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="force-pwd-title" className="text-base font-semibold text-white">
                {t('forceChangeTitle')}
              </h2>
              <p className="text-xs text-indigo-100">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('forceChangeDesc')}</p>

          {/* Current password */}
          <PasswordField
            id="current-password"
            label={t('currentPassword')}
            placeholder={t('currentPasswordPlaceholder')}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((s) => !s)}
            autoFocus
          />

          {/* New password */}
          <div>
            <PasswordField
              id="new-password"
              label={t('newPassword')}
              placeholder={t('newPasswordPlaceholder')}
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((s) => !s)}
            />
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full',
                        i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-700',
                      )}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  <Check ok={minOk}>≥ 8 {t('password').toLowerCase()}</Check>
                  <Check ok={hasLetter}>a-z</Check>
                  <Check ok={hasDigit}>0-9</Check>
                  <span className={cn('ml-auto font-medium', strength >= 3 ? 'text-emerald-600' : 'text-gray-500')}>
                    {strengthLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <PasswordField
            id="confirm-new-password"
            label={t('confirmNewPassword')}
            placeholder={t('confirmNewPasswordPlaceholder')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showNew}
            onToggle={() => setShowNew((s) => !s)}
          />
          {confirmPassword.length > 0 && !matchOk && (
            <p className="text-xs text-red-600">{t('passwordsDoNotMatch')}</p>
          )}

          {/* Error banner */}
          {localError && !success && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs text-red-700 dark:text-red-300">{localError}</p>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('passwordChanged')}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all',
              canSubmit
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                : 'bg-indigo-300 cursor-not-allowed',
            )}
          >
            {changePassword.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t('changingPassword')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t('changePassword')}
              </span>
            )}
          </button>

          <p className="text-[11px] text-center text-gray-400">{t('cannotDismiss')}</p>
        </form>
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}

function PasswordField({ id, label, placeholder, value, onChange, show, onToggle, autoFocus }: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={id === 'current-password' ? 'current-password' : 'new-password'}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1', ok ? 'text-emerald-600' : 'text-gray-400')}>
      <span className={cn('h-1 w-1 rounded-full', ok ? 'bg-emerald-500' : 'bg-gray-300')} />
      {children}
    </span>
  );
}
