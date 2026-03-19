'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save,
  Lock,
  User,
  Mail,
  Shield,
  Building2,
  ShieldCheck,
  ShieldOff,
  Calendar,
  Clock,
  Loader2,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  ImagePlus,
} from 'lucide-react';
import {
  useUserProfile,
  useUpdateProfile,
  useChangePassword,
  useMfaSetup,
  useMfaVerify,
  useMfaDisable,
  useUploadAvatar,
} from '@/lib/api/hooks';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Role colors (same as Header)                                       */
/* ------------------------------------------------------------------ */

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONTINENTAL_ADMIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REC_ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  NATIONAL_ADMIN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  DATA_STEWARD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WAHIS_FOCAL_POINT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ANALYST: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  FIELD_AGENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const ROLE_TRANSLATION_KEYS: Record<UserRole, string> = {
  SUPER_ADMIN: 'roleSuperAdmin',
  CONTINENTAL_ADMIN: 'roleContinentalAdmin',
  REC_ADMIN: 'roleRecAdmin',
  NATIONAL_ADMIN: 'roleNationalAdmin',
  DATA_STEWARD: 'roleDataSteward',
  WAHIS_FOCAL_POINT: 'roleWahisFocalPoint',
  ANALYST: 'roleAnalyst',
  FIELD_AGENT: 'roleFieldAgent',
};

/* ------------------------------------------------------------------ */
/*  Password strength                                                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Profile Page                                                       */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const t = useTranslations('settings');
  const th = useTranslations('header');
  const user = useAuthStore((s) => s.user);
  const formatDate = useFormattedDate();

  const { data, isLoading } = useUserProfile();
  const profile = data?.data;
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // MFA hooks
  const mfaSetup = useMfaSetup();
  const mfaVerify = useMfaVerify();
  const mfaDisable = useMfaDisable();

  // Avatar
  const uploadAvatar = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  // Close avatar menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    if (avatarMenuOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [avatarMenuOpen]);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // MFA state
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaDisableMode, setMfaDisableMode] = useState(false);
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

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

  const isMfaEnabled = profile?.mfaEnabled ?? false;

  /* ---- Handlers ---- */

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

  function handleMfaSetup() {
    setMfaError('');
    setMfaSuccess('');
    mfaSetup.mutate(undefined, {
      onSuccess: (res) => {
        setMfaQrCode(res.data.qrCodeUrl);
        setMfaSecret(res.data.secret);
        setMfaStep('setup');
      },
      onError: () => {
        setMfaError('Failed to initialize MFA setup.');
      },
    });
  }

  function handleMfaVerify() {
    setMfaError('');
    if (mfaCode.length !== 6) {
      setMfaError(t('mfaEnterCode'));
      return;
    }
    mfaVerify.mutate(
      { code: mfaCode },
      {
        onSuccess: () => {
          setMfaSuccess(t('mfaSetupSuccess'));
          setMfaStep('idle');
          setMfaCode('');
          setMfaQrCode('');
          setMfaSecret('');
          setTimeout(() => setMfaSuccess(''), 5000);
        },
        onError: () => {
          setMfaError('Invalid code. Please try again.');
        },
      },
    );
  }

  function handleMfaDisable() {
    setMfaError('');
    if (mfaDisableCode.length !== 6) {
      setMfaError(t('mfaEnterCode'));
      return;
    }
    mfaDisable.mutate(
      { code: mfaDisableCode },
      {
        onSuccess: () => {
          setMfaSuccess(t('mfaDisableSuccess'));
          setMfaDisableMode(false);
          setMfaDisableCode('');
          setTimeout(() => setMfaSuccess(''), 5000);
        },
        onError: () => {
          setMfaError('Invalid code. Please try again.');
        },
      },
    );
  }

  function copySecret() {
    navigator.clipboard.writeText(mfaSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError(t('photoMaxSize'));
      setTimeout(() => setProfileError(''), 4000);
      return;
    }
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError(t('photoFormats'));
      setTimeout(() => setProfileError(''), 4000);
      return;
    }

    uploadAvatar.mutate(file, {
      onSuccess: () => {
        setProfileSaved(false);
        setProfileError('');
        setAvatarMenuOpen(false);
        // Show success temporarily
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 4000);
      },
      onError: () => {
        setProfileError(t('photoUploadFailed'));
        setTimeout(() => setProfileError(''), 4000);
      },
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  }

  function handleRemoveAvatar() {
    setAvatarMenuOpen(false);
    updateProfile.mutate(
      { avatarUrl: null } as any,
      {
        onSuccess: () => {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 4000);
        },
      },
    );
  }

  if (isLoading) return <DetailSkeleton />;

  const displayRole = (profile?.role ?? user?.role ?? 'ANALYST') as UserRole;
  const displayTenant = profile?.tenantId ?? user?.tenantId ?? '';

  return (
    <div className="space-y-6">
      {/* ── Section 1: Hero Card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Accent banner */}
        <div
          className="h-32 sm:h-36"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark, var(--color-accent)))',
            opacity: 0.9,
          }}
        />

        <div className="relative px-6 pb-6">
          {/* Avatar + Info row */}
          <div className="-mt-14 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar with upload overlay */}
            <div ref={avatarMenuRef} className="relative group">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarSelect}
              />

              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={`${firstName} ${lastName}`}
                  className="h-28 w-28 rounded-2xl border-4 border-white object-cover shadow-lg dark:border-gray-800"
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-white text-3xl font-bold shadow-lg dark:border-gray-800"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                >
                  {initials}
                </div>
              )}

              {/* Upload overlay on hover */}
              {uploadAvatar.isPending ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-transparent bg-black/50">
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (profile?.avatarUrl) {
                      setAvatarMenuOpen(!avatarMenuOpen);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-4 border-transparent bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100 cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-white drop-shadow" />
                  <span className="text-[10px] font-medium text-white drop-shadow">
                    {profile?.avatarUrl ? t('changePhoto') : t('uploadPhoto')}
                  </span>
                </button>
              )}

              {/* Avatar context menu (when photo exists) */}
              {avatarMenuOpen && profile?.avatarUrl && (
                <div className="absolute -bottom-2 left-0 z-50 mt-1 w-44 translate-y-full rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-scale-in">
                  <button
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {t('changePhoto')}
                  </button>
                  <button
                    onClick={handleRemoveAvatar}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('removePhoto')}
                  </button>
                </div>
              )}

              {/* Online badge */}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-green-500 dark:border-gray-800">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {firstName} {lastName}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    ROLE_COLORS[displayRole],
                  )}
                >
                  <Shield className="h-3 w-3" />
                  {th(ROLE_TRANSLATION_KEYS[displayRole])}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <Building2 className="h-3 w-3" />
                  {displayTenant}
                </span>
                {isMfaEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <ShieldCheck className="h-3 w-3" />
                    2FA
                  </span>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="flex flex-col gap-1.5 text-xs text-gray-400 dark:text-gray-500 pb-1">
              {profile?.createdAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {t('memberSince')} {formatDate(profile.createdAt)}
                </span>
              )}
              {profile?.lastLoginAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {t('lastLogin')} {formatDate(profile.lastLoginAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast notifications ── */}
      {profileSaved && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t('savedSuccessfully')}
        </div>
      )}
      {profileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {profileError}
        </div>
      )}
      {passwordChanged && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t('passwordChanged')}
        </div>
      )}
      {mfaSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {mfaSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Section 2: Personal Information ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <User className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            {t('personalInfo')}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('editYourInfo')}</p>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('firstName')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5" />
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('role')}
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                      ROLE_COLORS[displayRole],
                    )}
                  >
                    {th(ROLE_TRANSLATION_KEYS[displayRole])}
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('tenant')}
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{displayTenant}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {updateProfile.isPending ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Section 3a: Change Password ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Lock className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            {t('changePassword')}
          </h3>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('currentPassword')}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('newPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('confirmNewPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleChangePassword}
                disabled={changePassword.isPending || !currentPassword || !newPassword}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {changePassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {changePassword.isPending ? t('changing') : t('updatePassword')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3b: Two-Factor Authentication ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <ShieldCheck className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              {t('mfaTitle')}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('mfaDescription')}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              isMfaEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
            )}
          >
            {isMfaEnabled ? (
              <>
                <ShieldCheck className="h-3 w-3" />
                {t('mfaEnabled')}
              </>
            ) : (
              <>
                <ShieldOff className="h-3 w-3" />
                {t('mfaDisabled')}
              </>
            )}
          </span>
        </div>

        {mfaError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            {mfaError}
          </div>
        )}

        {/* MFA is disabled — show enable flow */}
        {!isMfaEnabled && mfaStep === 'idle' && (
          <div className="mt-4">
            <button
              onClick={handleMfaSetup}
              disabled={mfaSetup.isPending}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {mfaSetup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {t('mfaEnable')}
            </button>
          </div>
        )}

        {/* MFA setup: QR code + verification */}
        {!isMfaEnabled && mfaStep === 'setup' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
              <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                {t('mfaScanQrCode')}
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {/* QR Code */}
                <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-600">
                  {mfaQrCode ? (
                    <img src={mfaQrCode} alt="MFA QR Code" className="h-full w-full" />
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  )}
                </div>

                {/* Manual entry secret */}
                <div className="w-full space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t('mfaSecretKey')}
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {mfaSecret}
                      </code>
                      <button
                        onClick={copySecret}
                        className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      >
                        {secretCopied ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t('mfaEnterCode')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm tracking-[0.3em] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleMfaVerify}
                      disabled={mfaVerify.isPending || mfaCode.length !== 6}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {mfaVerify.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {t('mfaVerify')}
                    </button>
                    <button
                      onClick={() => {
                        setMfaStep('idle');
                        setMfaCode('');
                        setMfaError('');
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MFA is enabled — show disable option */}
        {isMfaEnabled && !mfaDisableMode && (
          <div className="mt-4">
            <button
              onClick={() => setMfaDisableMode(true)}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <ShieldOff className="h-4 w-4" />
              {t('mfaDisable')}
            </button>
          </div>
        )}

        {/* MFA disable confirmation */}
        {isMfaEnabled && mfaDisableMode && (
          <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {t('mfaDisableConfirm')}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaDisableCode}
              onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm tracking-[0.3em] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleMfaDisable}
                disabled={mfaDisable.isPending || mfaDisableCode.length !== 6}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {mfaDisable.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                {t('mfaDisable')}
              </button>
              <button
                onClick={() => {
                  setMfaDisableMode(false);
                  setMfaDisableCode('');
                  setMfaError('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
