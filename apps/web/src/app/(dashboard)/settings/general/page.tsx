'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2 } from 'lucide-react';

export default function GeneralSettingsPage() {
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('general');
  const { data: generalData, isLoading: loadingGeneral } = useSettingsConfig('general');
  const { data: brandingData, isLoading: loadingBranding } = useSettingsConfig('branding');
  const bulkMutation = useBulkUpdateConfig();

  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const generalConfigs: any[] = generalData?.data ?? [];
  const brandingConfigs: any[] = brandingData?.data ?? [];
  const allConfigs = [...generalConfigs, ...brandingConfigs];

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
    await bulkMutation.mutateAsync(configs);
    setChanges({});
  };

  const isLoading = loadingGeneral || loadingBranding;

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform configuration and branding
        </p>
      </div>

      {/* General */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Platform</h2>
        <div className="space-y-2">
          {generalConfigs.map((config: any) => (
            <ConfigField
              key={config.id}
              label={config.label?.en ?? config.key}
              description={config.description?.en}
              type={config.type}
              value={getValue(config)}
              onChange={(v) => handleChange(config.category, config.key, v)}
              options={config.options}
              disabled={!canEdit}
            />
          ))}
        </div>
      </section>

      {/* Branding */}
      {brandingConfigs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Branding</h2>
          <div className="space-y-2">
            {brandingConfigs.map((config: any) => (
              <ConfigField
                key={config.id}
                label={config.label?.en ?? config.key}
                description={config.description?.en}
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

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}
