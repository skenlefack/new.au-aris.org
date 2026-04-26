'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Activity,
  Server,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import {
  useAiHealth,
  useAiModels,
  useAiUsageStats,
  useAiRecentDrafts,
} from '@/lib/api/ai-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

export default function AiConsolePage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <AiConsoleContent />;
}

function AiConsoleContent() {
  const t = useTranslations('ai');
  const [usagePeriod, setUsagePeriod] = useState<'hour' | 'day' | 'week'>('day');

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useAiHealth();
  const { data: modelsData, isLoading: modelsLoading } = useAiModels();
  const { data: usageData, isLoading: usageLoading } = useAiUsageStats(usagePeriod);
  const { data: draftsData, isLoading: draftsLoading } = useAiRecentDrafts(20);

  const health = healthData?.data;
  const models = modelsData?.data ?? [];
  const usage = usageData?.data;
  const drafts = draftsData?.data ?? [];

  const statusColor = health?.status === 'ok'
    ? 'bg-emerald-500'
    : health?.status === 'degraded'
    ? 'bg-amber-500'
    : 'bg-red-500';

  const statusLabel = health?.status === 'ok'
    ? t('statusOnline')
    : health?.status === 'degraded'
    ? t('statusDegraded')
    : t('statusOffline');

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F4E79]/10 to-[#C9A227]/10">
            <Sparkles className="h-5 w-5" style={{ color: '#C9A227' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('consoleTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('consoleDesc')}</p>
          </div>
        </div>

        {/* Health status badge */}
        <div className="flex items-center gap-2">
          {healthLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <>
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {statusLabel}
              </span>
            </>
          )}
          <button
            onClick={() => refetchHealth()}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Grid: Models + Usage + Drafts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Section 1: Models */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-4">
            <Server className="h-4 w-4 text-gray-400" />
            {t('modelsLoaded')}
          </h2>

          {modelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : models.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t('noModels')}</p>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        model.status === 'loaded'
                          ? 'bg-emerald-500'
                          : model.status === 'available'
                          ? 'bg-amber-400'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {model.type === 'ollama' ? 'Ollama LLM' : 'ML Model'}
                        {model.size ? ` - ${model.size}` : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      model.status === 'loaded'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : model.status === 'available'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {model.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Usage Stats */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Activity className="h-4 w-4 text-gray-400" />
              {t('usageStats')}
            </h2>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {(['hour', 'day', 'week'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setUsagePeriod(p)}
                  className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    usagePeriod === p
                      ? 'bg-[#1F4E79] text-white'
                      : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`period_${p}`)}
                </button>
              ))}
            </div>
          </div>

          {usageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : !usage ? (
            <p className="py-4 text-center text-sm text-gray-400">{t('noUsageData')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.totalRequests.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">{t('totalRequests')}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.totalTokens.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">{t('totalTokens')}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center dark:border-gray-800 dark:bg-gray-800/50">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(usage.avgDurationMs)}ms
                </p>
                <p className="mt-1 text-[10px] text-gray-400">{t('avgDuration')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Recent Drafts */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-4">
          <FileText className="h-4 w-4 text-gray-400" />
          {t('recentDrafts')}
        </h2>

        {draftsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t('noDrafts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t('draftType')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t('draftPrompt')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t('draftStatus')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t('draftDate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {drafts.map((draft) => (
                  <tr key={draft.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {draft.type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-gray-700 dark:text-gray-300">
                      {draft.prompt}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        {draft.status === 'ACCEPTED' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {draft.status === 'REJECTED' && (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {draft.status === 'DRAFT' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            draft.status === 'ACCEPTED'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : draft.status === 'REJECTED'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {draft.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(draft.createdAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
