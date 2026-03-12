'use client';

import React, { useState } from 'react';
import { useSettingsConfig, useBulkUpdateConfig } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { ConfigField } from '@/components/settings/ConfigField';
import { SaveBar } from '@/components/settings/SaveBar';
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  Clock,
  MapPin,
  BookOpen,
  Copy,
  Timer,
  TrendingUp,
} from 'lucide-react';

const QUALITY_GATES = [
  'Completeness',
  'Temporal consistency',
  'Geographic consistency',
  'Codes & vocabularies',
  'Units validation',
  'Deduplication',
  'Auditability',
  'Confidence score',
] as const;

interface SectionDef {
  title: string;
  icon: React.ReactNode;
  prefixes: string[];
}

const SECTIONS: SectionDef[] = [
  {
    title: 'General Validation',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.validation.'],
  },
  {
    title: 'Completeness',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.completeness.'],
  },
  {
    title: 'Temporal Consistency',
    icon: <Clock className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.temporal.'],
  },
  {
    title: 'Geographic Consistency',
    icon: <MapPin className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.geographic.'],
  },
  {
    title: 'Codes & Vocabularies',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.codes.'],
  },
  {
    title: 'Duplicate Detection',
    icon: <Copy className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.duplicateDetection.'],
  },
  {
    title: 'Timeliness & SLA',
    icon: <Timer className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.timeliness.', 'dataQuality.correction.'],
  },
  {
    title: 'Confidence Score',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    prefixes: ['dataQuality.confidence.'],
  },
];

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

  const getConfigsForSection = (prefixes: string[]) =>
    configs.filter((c: any) => prefixes.some((p) => c.key.startsWith(p)));

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Data Quality
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Validation rules, completeness thresholds, and quality gates configuration
            </p>
          </div>
        </div>
      </div>

      {/* 8 Quality Gates Info Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              8 Mandatory Quality Gates
            </p>
            <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              Every record must pass these gates before publication. Configure thresholds and behavior below.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUALITY_GATES.map((gate) => (
                <span
                  key={gate}
                  className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                >
                  {gate}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Sections */}
      {SECTIONS.map((section) => {
        const items = getConfigsForSection(section.prefixes);
        if (items.length === 0) return null;
        return (
          <section key={section.title}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              {section.icon}
              {section.title}
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </h2>
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
        );
      })}

      <SaveBar
        show={Object.keys(changes).length > 0}
        saving={bulkMutation.isPending}
        onSave={handleSave}
        onDiscard={() => setChanges({})}
      />
    </div>
  );
}
