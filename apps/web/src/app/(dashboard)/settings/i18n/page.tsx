'use client';

import React, { useState } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2 } from 'lucide-react';

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Languages & i18n</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          4 languages: English, Fran\u00e7ais, Portugu\u00eas, \u0627\u0644\u0639\u0631\u0628\u064a\u0629
        </p>
      </div>

      {/* Language badges */}
      <div className="flex gap-2">
        {['EN', 'FR', 'PT', 'AR'].map((lang) => (
          <span
            key={lang}
            className="rounded-lg border border-aris-primary-200 bg-aris-primary-50 px-3 py-1.5 text-sm font-semibold text-aris-primary-700 dark:border-aris-primary-800 dark:bg-aris-primary-900/30 dark:text-aris-primary-400"
          >
            {lang}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {configs.map((config: any) => (
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

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}
