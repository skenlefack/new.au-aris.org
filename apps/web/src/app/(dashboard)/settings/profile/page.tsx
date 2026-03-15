'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Lock, User, Mail, Shield, Building2 } from 'lucide-react';
import { useUserProfile, useUpdateProfile, useChangePassword } from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 8) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score >= 5) return 'strong';
  if (score >= 3) return 'medium';
  return 'weak';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; color: string; width: string }> = {
  weak: { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' },
  medium: { label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' },
  strong: { label: 'Strong', color: 'bg-green-500', width: 'w-full' },
};

export default function ProfileSettingsPage() {
  const t = useTranslations('settings');
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useUserProfile();
  const profile = data?.data;
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setEmail(profile.email);
    }
  }, [profile]);

  const initials = useMemo(() => {
    const f = (firstName || profile?.firstName || '').charAt(0).toUpperCase();
    const l = (lastName || profile?.lastName || '').charAt(0).toUpperCase();
    return `${f}${l}` || '?';
  }, [firstName, lastName, profile]);

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const strengthConfig = STRENGTH_CONFIG[passwordStrength];

  function handleSaveProfile() {
    setProfileError('');
    setProfileSaved(false);
    updateProfile.mutate(
      { firstName, lastName, email },
      {
        onSuccess: () => {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 4000);
        },
        onError: () => {
          setProfileError(t('profileUpdateFailed'));
          setTimeout(() => setProfileError(''), 4000);
        },
      },
    );
  }

  function handleChangePassword() {
    setPasswordError('');
    setPasswordChanged(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('passwordMinLength'));
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordChanged(true);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setTimeout(() => setPasswordChanged(false), 4000);
        },
        onError: () => {
          setPasswordError(t('currentPasswordIncorrect'));
          setTimeout(() => setPasswordError(''), 4000);
        },
      },
    );
  }

  if (isLoading) return <DetailSkeleton />;

  const displayRole = (profile?.role ?? user?.role ?? '').replace(/_/g, ' ');
  const displayTenant = profile?.tenantId ?? user?.tenantId ?? '';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link and header */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSettings')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {t('profile')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('editYourInfo')}
        </p>
      </div>

      {/* Toast notifications */}
      {profileSaved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('savedSuccessfully')}
        </div>
      )}
      {profileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {profileError}
        </div>
      )}
      {passwordChanged && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('passwordChanged')}
        </div>
      )}

      {/* Section 1: Personal Information */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <User className="h-4 w-4" />
          {t('personalInfo')}
        </h3>

        {/* Avatar placeholder */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-aris-primary-100 text-xl font-bold text-aris-primary-700 dark:bg-aris-primary-900 dark:text-aris-primary-300">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{email}</p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('firstName')}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('lastName')}
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              <Mail className="mb-0.5 mr-1 inline-block h-3.5 w-3.5" />
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Read-only Role badge */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('role')}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {displayRole}
              </span>
            </div>
          </div>

          {/* Read-only Tenant */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('tenant')}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{displayTenant}</span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSaveProfile}
            disabled={updateProfile.isPending}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateProfile.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </div>

      {/* Section 2: Change Password */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Lock className="h-4 w-4" />
          {t('changePassword')}
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('currentPassword')}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('confirmNewPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Password strength indicator */}
          {newPassword.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('passwordStrength')}
                </span>
                <span
                  className={`text-xs font-medium ${
                    passwordStrength === 'strong'
                      ? 'text-green-600'
                      : passwordStrength === 'medium'
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {strengthConfig.label}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strengthConfig.color} ${strengthConfig.width}`}
                />
              </div>
            </div>
          )}

          {passwordError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              {passwordError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleChangePassword}
              disabled={changePassword.isPending || !currentPassword || !newPassword}
              className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {changePassword.isPending ? t('changing') : t('updatePassword')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
