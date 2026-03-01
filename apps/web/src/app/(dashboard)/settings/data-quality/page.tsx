'use client';

import React, { useState } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import { Loader2 } from 'lucide-react';

export default function DataQualitySettingsPage() {
  const { canManageConfig } = useSettingsAccess();
  const canEdit = canManageConfig('data-quality');
  const { data, isLoading } = useSettingsConfig('data-quality');
  const bulkMutation = useBulkUpdateConfig();
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const configs: any[] = data?.data ?? [];

  const handleChange = (key: string, value: unknown) => {
    setChanges((prev) => ({ ...prev, [`data-quality:${key}`]: value }));
  };

  const getValue = (config: any) => {
    const ck = `data-quality:${config.key}`;
    return ck in changes ? changes[ck] : config.value;
  };

  const handleSave = async () => {
    const list = Object.entries(changes).map(([ck, value]) => {
      const [category, ...rest] = ck.split(':');
      return { category, key: rest.join(':'), value };
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Quality</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Validation rules, completeness thresholds, and quality gates
        </p>
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
