'use client';

import { useTranslations } from '@/lib/i18n/translations';

interface GeoAggregationConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const METRICS = [
  { value: 'submissions', labelKey: 'dbGeoSubmissions' },
  { value: 'outbreaks', labelKey: 'dbGeoOutbreaks' },
  { value: 'cases', labelKey: 'dbGeoCases' },
  { value: 'vaccinations', labelKey: 'dbGeoVaccinations' },
];

const MODES = [
  { value: 'default', labelKey: 'dbGeoModeDefault' },
  { value: 'benefiting', labelKey: 'dbGeoModeBenefiting' },
];

export function GeoAggregationConfig({ config, onChange }: GeoAggregationConfigProps) {
  const t = useTranslations('dashboard');
  const metric = (config.metric as string) || 'submissions';
  const mode = (config.mode as string) || 'default';
  const domain = (config.domain as string) || '';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {t('dbGeoMetric')}
        </label>
        <select
          value={metric}
          onChange={e => onChange({ ...config, metric: e.target.value })}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        >
          {METRICS.map(m => (
            <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {t('dbGeoMode')}
        </label>
        <select
          value={mode}
          onChange={e => onChange({ ...config, mode: e.target.value })}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        >
          {MODES.map(m => (
            <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {t('dbGeoDomain')}
        </label>
        <input
          type="text"
          value={domain}
          onChange={e => onChange({ ...config, domain: e.target.value })}
          placeholder="animal-health, fisheries..."
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
