'use client';

import { useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Plus,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';

// ── Types ──

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  tenantOverrides: Record<string, boolean>;
  updatedAt: string;
}

interface RateLimitOverride {
  id: string;
  tenantId: string;
  tenantName: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  updatedAt: string;
}

interface KafkaTopicInfo {
  name: string;
  partitions: number;
  replicationFactor: number;
  messageCount: number;
  consumerGroups: string[];
}

// ── Inline Hooks ──

function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['settings', 'feature-flags'],
    queryFn: async () => {
      const res: any = await apiClient.get('/admin/config/feature-flags');
      return res?.data ?? res;
    },
  });
}

function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<FeatureFlag>) => {
      const res: any = await apiClient.patch<FeatureFlag>(`/admin/config/feature-flags/${id}`, data);
      return res?.data ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'feature-flags'] }),
  });
}

function useRateLimits() {
  return useQuery<RateLimitOverride[]>({
    queryKey: ['settings', 'rate-limits'],
    queryFn: async () => {
      const res: any = await apiClient.get('/admin/config/rate-limits');
      return res?.data ?? res;
    },
  });
}

function useUpdateRateLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RateLimitOverride> & { id?: string }) => {
      const res: any = data.id
        ? await apiClient.patch<RateLimitOverride>(`/admin/config/rate-limits/${data.id}`, data)
        : await apiClient.post<RateLimitOverride>('/admin/config/rate-limits', data);
      return res?.data ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'rate-limits'] }),
  });
}

function useKafkaTopics() {
  return useQuery<KafkaTopicInfo[]>({
    queryKey: ['settings', 'kafka-topics'],
    queryFn: async () => {
      const res: any = await apiClient.get('/admin/config/kafka/topics');
      return res?.data ?? res;
    },
  });
}

// ── Page ──

type Tab = 'feature-flags' | 'rate-limits' | 'kafka-topics';

interface NewRateLimit {
  tenantId: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
}

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feature-flags');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'feature-flags', label: 'Feature Flags' },
    { key: 'rate-limits', label: 'Rate Limits' },
    { key: 'kafka-topics', label: 'Kafka Topics' },
  ];

  return (
    <SuperAdminGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Runtime Configuration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage feature flags, rate limits, and Kafka topics across all services
          </p>
        </div>
        <SettingsBackButton />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/50 text-aris-primary-600 dark:text-aris-primary-400 border border-aris-primary-200 dark:border-aris-primary-800/50'
                : 'px-4 py-2 text-sm font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'feature-flags' && <FeatureFlagsTab />}
      {activeTab === 'rate-limits' && <RateLimitsTab />}
      {activeTab === 'kafka-topics' && <KafkaTopicsTab />}
    </div>
    </SuperAdminGuard>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Feature Flags Tab                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function FeatureFlagsTab() {
  const { data: flags, isLoading } = useFeatureFlags();
  const updateMutation = useUpdateFeatureFlag();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (flag: { id: string; enabled: boolean }) => {
    updateMutation.mutate({ id: flag.id, enabled: !flag.enabled });
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-8" />
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
              Key
            </th>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
              Description
            </th>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
              Global Status
            </th>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
              Tenant Overrides
            </th>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
              Last Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-200/50 dark:border-gray-700/50">
                <td colSpan={6} className="px-4 py-3">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </td>
              </tr>
            ))
          ) : flags && flags.length > 0 ? (
            flags.map((flag) => {
              const overrideCount = Object.keys(flag.tenantOverrides).length;
              const isExpanded = expandedId === flag.id;
              return (
                <FeatureFlagRow
                  key={flag.id}
                  flag={flag}
                  overrideCount={overrideCount}
                  isExpanded={isExpanded}
                  onToggleExpand={() =>
                    setExpandedId(isExpanded ? null : flag.id)
                  }
                  onToggleEnabled={() => handleToggle(flag)}
                  isUpdating={updateMutation.isPending}
                />
              );
            })
          ) : (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                No feature flags configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FeatureFlagRow({
  flag,
  overrideCount,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  isUpdating,
}: {
  flag: { id: string; key: string; description: string; enabled: boolean; tenantOverrides: Record<string, boolean>; updatedAt: string };
  overrideCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  isUpdating: boolean;
}) {
  return (
    <>
      <tr className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <td className="px-4 py-3">
          {overrideCount > 0 && (
            <button
              onClick={onToggleExpand}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{flag.key}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-700 dark:text-gray-300">{flag.description}</span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={onToggleEnabled}
            disabled={isUpdating}
            className="flex items-center gap-2 disabled:opacity-50"
            title={flag.enabled ? 'Disable globally' : 'Enable globally'}
          >
            {flag.enabled ? (
              <>
                <ToggleRight className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                  On
                </span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Off
                </span>
              </>
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          {overrideCount > 0 ? (
            <button
              onClick={onToggleExpand}
              className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:opacity-80"
            >
              {overrideCount} override{overrideCount !== 1 ? 's' : ''}
            </button>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          {new Date(flag.updatedAt).toLocaleDateString()}
        </td>
      </tr>
      {isExpanded && overrideCount > 0 && (
        <tr className="bg-gray-100/50 dark:bg-gray-800/50">
          <td colSpan={6} className="px-8 py-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tenant-Specific Overrides
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(flag.tenantOverrides).map(
                  ([tenantId, enabled]) => (
                    <div
                      key={tenantId}
                      className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2"
                    >
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {tenantId.slice(0, 8)}...
                      </span>
                      <span
                        className={
                          enabled
                            ? 'text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }
                      >
                        {enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rate Limits Tab                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function RateLimitsTab() {
  const { data: limits, isLoading } = useRateLimits();
  const updateMutation = useUpdateRateLimit();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<NewRateLimit>({
    tenantId: '',
    endpoint: '',
    maxRequests: 100,
    windowSeconds: 60,
  });
  const [editValues, setEditValues] = useState<{
    maxRequests: number;
    windowSeconds: number;
  }>({ maxRequests: 0, windowSeconds: 0 });

  const handleAddSubmit = () => {
    if (!newLimit.tenantId || !newLimit.endpoint) return;
    updateMutation.mutate(newLimit, {
      onSuccess: () => {
        setShowAddForm(false);
        setNewLimit({ tenantId: '', endpoint: '', maxRequests: 100, windowSeconds: 60 });
      },
    });
  };

  const handleEditStart = (limit: { id: string; maxRequests: number; windowSeconds: number }) => {
    setEditingId(limit.id);
    setEditValues({ maxRequests: limit.maxRequests, windowSeconds: limit.windowSeconds });
  };

  const handleEditSave = (id: string) => {
    updateMutation.mutate(
      { id, maxRequests: editValues.maxRequests, windowSeconds: editValues.windowSeconds },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Rate Limit Overrides
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Override
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Tenant
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Endpoint
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Max Requests
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Window (seconds)
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Last Updated
              </th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Add form row */}
            {showAddForm && (
              <tr className="border-b border-gray-200/50 dark:border-gray-700/50 bg-aris-primary-50/10 dark:bg-aris-primary-900/10">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={newLimit.tenantId}
                    onChange={(e) =>
                      setNewLimit({ ...newLimit, tenantId: e.target.value })
                    }
                    className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                    placeholder="Tenant ID"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={newLimit.endpoint}
                    onChange={(e) =>
                      setNewLimit({ ...newLimit, endpoint: e.target.value })
                    }
                    className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                    placeholder="/api/v1/..."
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={newLimit.maxRequests}
                    onChange={(e) =>
                      setNewLimit({
                        ...newLimit,
                        maxRequests: parseInt(e.target.value) || 0,
                      })
                    }
                    className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                    min={1}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={newLimit.windowSeconds}
                    onChange={(e) =>
                      setNewLimit({
                        ...newLimit,
                        windowSeconds: parseInt(e.target.value) || 0,
                      })
                    }
                    className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                    min={1}
                  />
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleAddSubmit}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1 text-xs"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-200/50 dark:border-gray-700/50">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : limits && limits.length > 0 ? (
              limits.map((limit) => {
                const isEditing = editingId === limit.id;
                return (
                  <tr
                    key={limit.id}
                    className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {limit.tenantName}
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {limit.tenantId.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {limit.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.maxRequests}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              maxRequests: parseInt(e.target.value) || 0,
                            })
                          }
                          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                          min={1}
                        />
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {limit.maxRequests.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.windowSeconds}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              windowSeconds: parseInt(e.target.value) || 0,
                            })
                          }
                          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
                          min={1}
                        />
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {limit.windowSeconds}s
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(limit.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditSave(limit.id)}
                            disabled={updateMutation.isPending}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1 text-xs"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditStart(limit)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Edit rate limit"
                        >
                          <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No rate limit overrides configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Kafka Topics Tab                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function KafkaTopicsTab() {
  const { data: topics, isLoading, refetch } = useKafkaTopics();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Kafka Topics
        </h2>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Topic Name
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Partitions
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Replication
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Messages
              </th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">
                Consumer Groups
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-200/50 dark:border-gray-700/50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : topics && topics.length > 0 ? (
              topics.map((topic) => (
                <tr
                  key={topic.name}
                  className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {topic.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {topic.partitions}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {topic.replicationFactor}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {topic.messageCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {topic.consumerGroups.length > 0 ? (
                        topic.consumerGroups.map((group) => (
                          <span
                            key={group}
                            className="text-xs font-medium px-2 py-0.5 rounded bg-aris-primary-50 dark:bg-aris-primary-900/30 text-aris-primary-600 dark:text-aris-primary-400"
                          >
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">None</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No Kafka topics found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
