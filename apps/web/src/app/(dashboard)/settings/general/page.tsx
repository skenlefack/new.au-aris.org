'use client';

import React, { useState, useRef } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2, Upload, ImageIcon, X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { cn } from '@/lib/utils';

// Explicit display order for general config keys
const GENERAL_KEY_ORDER = [
  'platform.name',
  'platform.fullName',
  'platform.version',
  'platform.organization',
  'platform.logo.url',
  'platform.contact.email',
];

function sortGeneralConfigs(configs: any[]): any[] {
  return [...configs].sort((a, b) => {
    const ai = GENERAL_KEY_ORDER.indexOf(a.key);
    const bi = GENERAL_KEY_ORDER.indexOf(b.key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ── Logo Upload Field ─────────────────────────────────────────────────────────

interface LogoUploadFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function LogoUploadField({ label, description, value, onChange, disabled }: LogoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const currentLogo = typeof value === 'string' ? value : '';
  const hasLogo = !!currentLogo && !imgError;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setImgError(false);
      setUploading(false);
    };
    reader.onerror = () => setUploading(false);
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleClear = () => {
    onChange('');
    setImgError(false);
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-start gap-4">
        {/* Left: label + description */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          )}

          {/* URL input */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              value={currentLogo}
              onChange={(e) => { onChange(e.target.value); setImgError(false); }}
              disabled={disabled}
              placeholder="https://... or upload a file"
              className={cn(
                'flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm',
                'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
                'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            {currentLogo && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Remove logo"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Upload button */}
          {!disabled && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs',
                  'text-gray-500 hover:border-aris-primary-400 hover:text-aris-primary-600',
                  'dark:border-gray-600 dark:text-gray-400',
                  'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? 'Chargement...' : 'Uploader un logo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Right: logo preview */}
        <div className="flex-shrink-0">
          {hasLogo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentLogo}
                alt="Platform logo"
                onError={() => setImgError(true)}
                className="h-10 w-auto max-w-[80px] rounded-lg border border-gray-100 object-contain opacity-80 shadow-sm dark:border-gray-700"
              />
            </div>
          ) : (
            <div className="flex h-10 w-16 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <ImageIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Multilingual Config Field ─────────────────────────────────────────────────

const LANGS = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
  { code: 'ar', label: 'AR', flag: '🇸🇦', rtl: true },
];

interface MultiLangConfigFieldProps {
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

function MultiLangConfigField({ label, description, value, onChange, disabled }: MultiLangConfigFieldProps) {
  const obj: Record<string, string> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
      {description && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      <div className="mt-3 space-y-2">
        {LANGS.map(({ code, label: lbl, flag, rtl }) => (
          <div key={code} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {flag} {lbl}
            </span>
            <input
              type="text"
              dir={rtl ? 'rtl' : undefined}
              value={obj[code] ?? ''}
              onChange={(e) => onChange({ ...obj, [code]: e.target.value })}
              disabled={disabled}
              className={cn(
                'flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm',
                'focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500',
                'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
                rtl && 'text-right',
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GeneralSettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocaleStore((s) => s.locale);
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('general');
  const canEditEmail = canManageConfig('email');
  const { data: generalData, isLoading: loadingGeneral } = useSettingsConfig('general');
  const { data: brandingData, isLoading: loadingBranding } = useSettingsConfig('branding');
  const { data: emailData, isLoading: loadingEmail } = useSettingsConfig('email');
  const bulkMutation = useBulkUpdateConfig();
  const addToast = useRealtimeStore((s) => s.addToast);

  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const generalConfigs: any[] = sortGeneralConfigs(generalData?.data ?? []);
  const brandingConfigs: any[] = brandingData?.data ?? [];
  const emailConfigs: any[] = emailData?.data ?? [];

  const handleChange = (category: string, key: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [`${category}:${key}`]: value }));
  };

  const getValue = (config: any) => {
    const ck = `${config.category}:${config.key}`;
    return ck in changes ? changes[ck] : config.value;
  };

  const handleSave = async () => {
    const configs = Object.entries(changes).map(([ck, value]) => {
      const [category, key] = ck.split(':');
      return { category, key, value };
    });
    try {
      await bulkMutation.mutateAsync(configs);
      setChanges({});
      addToast({
        type: 'success',
        title: 'Paramètres enregistrés',
        message: 'Les modifications ont été sauvegardées avec succès.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: 'Une erreur est survenue. Veuillez réessayer.',
      });
    }
  };

  const isLoading = loadingGeneral || loadingBranding || loadingEmail;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('generalSettings')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('platformConfigBranding')}
        </p>
      </div>

      {/* General */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('platform')}</h2>
        <div className="space-y-2">
          {generalConfigs.map((config: any) => {
            if (config.key === 'platform.logo.url') {
              return (
                <LogoUploadField
                  key={config.id}
                  label={config.label?.[locale] ?? config.label?.en ?? config.key}
                  description={config.description?.[locale] ?? config.description?.en}
                  value={(getValue(config) as string) ?? ''}
                  onChange={(v) => handleChange(config.category, config.key, v)}
                  disabled={!canEdit}
                />
              );
            }
            if (config.key === 'platform.fullName') {
              return (
                <MultiLangConfigField
                  key={config.id}
                  label={config.label?.[locale] ?? config.label?.en ?? config.key}
                  description={config.description?.[locale] ?? config.description?.en}
                  value={getValue(config)}
                  onChange={(v) => handleChange(config.category, config.key, v)}
                  disabled={!canEdit}
                />
              );
            }
            return (
              <ConfigField
                key={config.id}
                label={config.label?.[locale] ?? config.label?.en ?? config.key}
                description={config.description?.[locale] ?? config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.category, config.key, v)}
                options={config.options}
                disabled={!canEdit}
              />
            );
          })}
        </div>
      </section>

      {/* Branding */}
      {brandingConfigs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('branding')}</h2>
          <div className="space-y-2">
            {brandingConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.[locale] ?? config.label?.en ?? config.key}
                description={config.description?.[locale] ?? config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.category, config.key, v)}
                options={config.options}
                disabled={!canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Email */}
      {emailConfigs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('emailDelivery')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('emailDeliveryDesc')}
          </p>
          <div className="space-y-2">
            {emailConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.[locale] ?? config.label?.en ?? config.key}
                description={config.description?.[locale] ?? config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.category, config.key, v)}
                options={config.options}
                disabled={!canEditEmail}
              />
            ))}
          </div>
        </section>
      )}

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}
