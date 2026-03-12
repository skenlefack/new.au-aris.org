'use client';

import React, { useState } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2, Globe, ArrowRightLeft, Calendar, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',    flag: '\uD83C\uDDEC\uD83C\uDDE7', rtl: false },
  { code: 'fr', name: 'French',     native: 'Fran\u00e7ais',   flag: '\uD83C\uDDEB\uD83C\uDDF7', rtl: false },
  { code: 'pt', name: 'Portuguese', native: 'Portugu\u00eas',  flag: '\uD83C\uDDF5\uD83C\uDDF9', rtl: false },
  { code: 'es', name: 'Spanish',    native: 'Espa\u00f1ol',    flag: '\uD83C\uDDEA\uD83C\uDDF8', rtl: false },
  { code: 'ar', name: 'Arabic',     native: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',     flag: '\uD83C\uDDF8\uD83C\uDDE6', rtl: true },
] as const;

export default function I18nSettingsPage() {
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('i18n');
  const { data, isLoading } = useSettingsConfig('i18n');
  const bulkMutation = useBulkUpdateConfig();
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const configs: any[] = data?.data ?? [];

  const handleChange = (key: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [`i18n:${key}`]: value }));
  };

  const getValue = (config: any) => {
    const ck = `i18n:${config.key}`;
    return ck in changes ? changes[ck] : config.value;
  };

  const handleSave = async () => {
    const list = Object.entries(changes).map(([ck, value]) => {
      const [category, key] = ck.split(':');
      return { category, key, value };
    });
    await bulkMutation.mutateAsync(list);
    setChanges({});
  };

  // Find the default locale from configs
  const defaultLocaleConfig = configs.find((c: any) => c.key === 'i18n.defaultLocale');
  const defaultLocale = defaultLocaleConfig
    ? (getValue(defaultLocaleConfig) as string)
    : 'en';

  // Find available locales from configs
  const availableLocalesConfig = configs.find((c: any) => c.key === 'i18n.availableLocales');
  const availableLocales: string[] = availableLocalesConfig
    ? (getValue(availableLocalesConfig) as string[])
    : LANGUAGES.map((l) => l.code);

  const handleSetDefault = (code: string) => {
    if (!canEdit) return;
    if (!availableLocales.includes(code)) return;
    handleChange('i18n.defaultLocale', code);
  };

  const handleToggleLocale = (code: string) => {
    if (!canEdit) return;
    // Cannot disable the default locale
    if (code === defaultLocale) return;
    const next = availableLocales.includes(code)
      ? availableLocales.filter((c) => c !== code)
      : [...availableLocales, code];
    handleChange('i18n.availableLocales', next);
  };

  // Separate date/format configs from locale configs
  const localeConfigs = configs.filter((c: any) =>
    c.key === 'i18n.defaultLocale' || c.key === 'i18n.availableLocales',
  );
  const formatConfigs = configs.filter((c: any) =>
    c.key === 'i18n.dateFormat',
  );
  const otherConfigs = configs.filter((c: any) =>
    !localeConfigs.includes(c) && !formatConfigs.includes(c) && c.key !== 'i18n.rtl.locales',
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aris-primary-500 to-aris-primary-700 text-white shadow-sm">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Languages & Internationalization
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage supported languages, text direction, and regional formats
            </p>
          </div>
        </div>
      </div>

      {/* Supported Languages Grid */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          Supported Languages
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>
        {canEdit && (
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
            Click a card to set as default language. Use the toggle to enable or disable a language.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LANGUAGES.map((lang) => {
            const isDefault = defaultLocale === lang.code;
            const isEnabled = availableLocales.includes(lang.code);
            return (
              <div
                key={lang.code}
                onClick={() => isEnabled && handleSetDefault(lang.code)}
                className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                  !isEnabled
                    ? 'border-gray-200 bg-gray-100 opacity-50 dark:border-gray-700 dark:bg-gray-800/50'
                    : isDefault
                      ? 'border-aris-primary-300 bg-aris-primary-50/50 shadow-sm ring-1 ring-aris-primary-200 dark:border-aris-primary-700 dark:bg-aris-primary-900/20 dark:ring-aris-primary-800'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-gray-600'
                } ${canEdit && isEnabled ? 'cursor-pointer' : ''}`}
              >
                {/* Enable/Disable toggle */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLocale(lang.code);
                    }}
                    disabled={isDefault}
                    className={`absolute right-2 top-2 z-10 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-aris-primary-500 focus:ring-offset-2 ${
                      isDefault
                        ? 'cursor-not-allowed bg-aris-primary-400 opacity-60'
                        : isEnabled
                          ? 'cursor-pointer bg-aris-primary-500'
                          : 'cursor-pointer bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={isDefault ? 'Default language cannot be disabled' : isEnabled ? 'Disable language' : 'Enable language'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                        isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
                {isDefault && (
                  <div className={canEdit ? 'mt-1' : 'absolute right-2 top-2'}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-aris-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aris-primary-700 dark:bg-aris-primary-900/50 dark:text-aris-primary-300">
                      <Check className="h-3 w-3" />
                      Default
                    </span>
                  </div>
                )}
                <div className="mb-2 text-3xl">{lang.flag}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {lang.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {lang.native}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {lang.code.toUpperCase()}
                  </span>
                  {lang.rtl && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <ArrowRightLeft className="h-2.5 w-2.5" />
                      RTL
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Locale Configuration */}
      {localeConfigs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            Locale Configuration
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="space-y-2">
            {localeConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.en ?? config.key}
                description={config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.key, v)}
                options={config.options}
                disabled={!canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Date & Number Formats */}
      {formatConfigs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <Calendar className="h-3.5 w-3.5" />
            Regional Formats
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="space-y-2">
            {formatConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.en ?? config.key}
                description={config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.key, v)}
                options={config.options}
                disabled={!canEdit}
              />
            ))}
          </div>
          {/* Format preview */}
          <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Preview
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
              <span>
                <span className="text-xs text-gray-400">Today: </span>
                {formatPreview(
                  (formatConfigs[0] ? getValue(formatConfigs[0]) : 'DD/MM/YYYY') as string,
                )}
              </span>
              <span>
                <span className="text-xs text-gray-400">Number: </span>
                1,450,300,000
              </span>
            </div>
          </div>
        </section>
      )}

      {/* RTL Info */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Text Direction
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Right-to-Left (RTL) Support
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Arabic (\u0627\u0644\u0639\u0631\u0628\u064a\u0629) uses right-to-left text direction. The UI automatically
                mirrors layout, navigation, and content alignment when users select Arabic.
              </p>
              <div className="mt-3 flex gap-6">
                <div className="text-center">
                  <div className="mb-1 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-8 rounded bg-gray-300 dark:bg-gray-600" />
                      <div className="h-2 w-12 rounded bg-gray-300 dark:bg-gray-600" />
                      <div className="h-2 w-6 rounded bg-gray-300 dark:bg-gray-600" />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400">LTR</span>
                </div>
                <div className="text-center">
                  <div className="mb-1 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-2 w-6 rounded bg-amber-300 dark:bg-amber-700" />
                      <div className="h-2 w-12 rounded bg-amber-300 dark:bg-amber-700" />
                      <div className="h-2 w-8 rounded bg-amber-300 dark:bg-amber-700" />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-amber-500">RTL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Other configs */}
      {otherConfigs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            Advanced
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="space-y-2">
            {otherConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.en ?? config.key}
                description={config.description?.en}
                type={config.type}
                value={getValue(config)}
                onChange={(v) => handleChange(config.key, v)}
                options={config.options}
                disabled={!canEdit}
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

/** Render a date preview based on the format pattern */
function formatPreview(pattern: string): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = String(now.getFullYear());
  return pattern
    .replace('DD', d)
    .replace('MM', m)
    .replace('YYYY', y)
    .replace('YY', y.slice(-2));
}
