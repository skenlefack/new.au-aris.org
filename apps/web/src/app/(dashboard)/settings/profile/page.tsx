'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Lock, User, Mail, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile, useUpdateProfile, useChangePassword } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

export default function ProfileSettingsPage() {
  const t = useTranslations('settings');
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
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setEmail(profile.email);
    }
  }, [profile]);

  function handleSaveProfile() {
    updateProfile.mutate(
      { firstName, lastName, email },
      {
        onSuccess: () => {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 3000);
        },
      },
    );
  }

  function handleChangePassword() {
    setPasswordError('');
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
          setTimeout(() => setPasswordChanged(false), 3000);
        },
        onError: () => setPasswordError(t('currentPasswordIncorrect')),
      },
    );
  }

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSettings')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{t('profile')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('editYourInfo')}
        </p>
      </div>

      {/* Profile Info */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <User className="h-4 w-4" />
          {t('personalInfo')}
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('firstName')}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('lastName')}
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
          {profile && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('role')}
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Shield className="h-3.5 w-3.5" />
                  {profile.role.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('mfa')}
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {profile.mfaEnabled ? t('enabled') : t('disabled')}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveProfile}
            disabled={updateProfile.isPending}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateProfile.isPending ? t('saving') : t('saveChanges')}
          </button>
          {profileSaved && (
            <span className="text-xs text-green-600">{t('savedSuccessfully')}</span>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Lock className="h-4 w-4" />
          {t('changePassword')}
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('currentPassword')}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('confirmNewPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              />
            </div>
          </div>
          {passwordError && (
            <p className="text-xs text-red-600">{passwordError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleChangePassword}
              disabled={changePassword.isPending || !currentPassword || !newPassword}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {changePassword.isPending ? t('changing') : t('changePassword')}
            </button>
            {passwordChanged && (
              <span className="text-xs text-green-600">
                {t('passwordChanged')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
