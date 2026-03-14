'use client';

import React, { useState } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

export default function SecuritySettingsPage() {
  const t = useTranslations('settings');
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('security');
  const { data, isLoading } = useSettingsConfig('security');
  const bulkMutation = useBulkUpdateConfig();
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const configs: any[] = data?.data ?? [];

  const handleChange = (key: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [`security:${key}`]: value }));
  };

  const getValue = (config: any) => {
    const ck = `security:${config.key}`;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Group configs by sub-category
  const passwordConfigs = configs.filter((c: any) => c.key.startsWith('security.password'));
  const mfaConfigs = configs.filter((c: any) => c.key.startsWith('security.mfa'));
  const sessionConfigs = configs.filter((c: any) => c.key.startsWith('security.session'));
  const loginConfigs = configs.filter((c: any) => c.key.startsWith('security.login'));

  const renderGroup = (title: string, items: any[]) => (
    items.length > 0 && (
      <section className="space-y-2" key={title}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <div className="space-y-2">
          {items.map((config: any) => (
            <ConfigField
              key={config.id}
              label={config.label?.en ?? config.key.split('.').pop()}
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
    )
  );

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('securitySettings')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('securitySubtitle')}
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" />
          {t('securityAdminOnly')}
        </div>
      )}

      {renderGroup(t('passwordPolicy'), passwordConfigs)}
      {renderGroup(t('multiFactorAuth'), mfaConfigs)}
      {renderGroup(t('sessionManagement'), sessionConfigs)}
      {renderGroup(t('loginProtection'), loginConfigs)}

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}
