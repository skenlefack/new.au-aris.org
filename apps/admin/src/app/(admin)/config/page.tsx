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
import {
  useFeatureFlags,
  useUpdateFeatureFlag,
  useRateLimits,
  useUpdateRateLimit,
  useKafkaTopics,
} from '@/lib/api/hooks';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">
          Runtime Configuration
        </h1>
        <p className="text-sm text-admin-muted mt-1">
          Manage feature flags, rate limits, and Kafka topics across all services
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'px-4 py-2 text-sm font-medium rounded-lg bg-primary-900/50 text-primary-400 border border-primary-800/50'
                : 'px-4 py-2 text-sm font-medium rounded-lg text-admin-muted hover:text-admin-text hover:bg-admin-hover'
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
    <div className="admin-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-border">
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-8" />
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
              Key
            </th>
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
              Description
            </th>
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
              Global Status
            </th>
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
              Tenant Overrides
            </th>
            <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
              Last Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-admin-border/50">
                <td colSpan={6} className="px-4 py-3">
                  <div className="h-4 bg-admin-surface rounded animate-pulse" />
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
                className="px-4 py-8 text-center text-sm text-admin-muted"
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
      <tr className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors">
        <td className="px-4 py-3">
          {overrideCount > 0 && (
            <button
              onClick={onToggleExpand}
              className="p-0.5 rounded hover:bg-admin-surface transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-admin-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-admin-muted" />
              )}
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-admin-muted">{flag.key}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-admin-text">{flag.description}</span>
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
                <ToggleRight className="w-6 h-6 text-status-healthy" />
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-healthy/10 text-status-healthy">
                  On
                </span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-admin-muted" />
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-admin-surface text-admin-muted">
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
              className="text-xs font-medium px-2 py-0.5 rounded bg-status-degraded/10 text-status-degraded cursor-pointer hover:opacity-80"
            >
              {overrideCount} override{overrideCount !== 1 ? 's' : ''}
            </button>
          ) : (
            <span className="text-xs text-admin-muted">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-admin-muted">
          {new Date(flag.updatedAt).toLocaleDateString()}
        </td>
      </tr>
      {isExpanded && overrideCount > 0 && (
        <tr className="bg-admin-surface/50">
          <td colSpan={6} className="px-8 py-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-admin-muted uppercase tracking-wider">
                Tenant-Specific Overrides
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(flag.tenantOverrides).map(
                  ([tenantId, enabled]) => (
                    <div
                      key={tenantId}
                      className="flex items-center justify-between admin-card p-2"
                    >
                      <span className="text-xs font-mono text-admin-muted">
                        {tenantId.slice(0, 8)}...
                      </span>
                      <span
                        className={
                          enabled
                            ? 'text-xs font-medium px-2 py-0.5 rounded bg-status-healthy/10 text-status-healthy'
                            : 'text-xs font-medium px-2 py-0.5 rounded bg-admin-surface text-admin-muted'
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
        <h2 className="text-lg font-semibold text-admin-heading">
          Rate Limit Overrides
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="admin-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Override
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Tenant
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Endpoint
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Max Requests
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Window (seconds)
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Last Updated
              </th>
              <th className="text-right text-xs font-medium text-admin-muted px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Add form row */}
            {showAddForm && (
              <tr className="border-b border-admin-border/50 bg-primary-900/10">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={newLimit.tenantId}
                    onChange={(e) =>
                      setNewLimit({ ...newLimit, tenantId: e.target.value })
                    }
                    className="admin-input w-full"
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
                    className="admin-input w-full"
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
                    className="admin-input w-full"
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
                    className="admin-input w-full"
                    min={1}
                  />
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleAddSubmit}
                      disabled={updateMutation.isPending}
                      className="admin-btn-primary flex items-center gap-1 text-xs disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="admin-btn-secondary text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : limits && limits.length > 0 ? (
              limits.map((limit) => {
                const isEditing = editingId === limit.id;
                return (
                  <tr
                    key={limit.id}
                    className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-admin-text">
                          {limit.tenantName}
                        </p>
                        <p className="text-xs font-mono text-admin-muted">
                          {limit.tenantId.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-admin-muted">
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
                          className="admin-input w-full"
                          min={1}
                        />
                      ) : (
                        <span className="text-sm text-admin-text">
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
                          className="admin-input w-full"
                          min={1}
                        />
                      ) : (
                        <span className="text-sm text-admin-text">
                          {limit.windowSeconds}s
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-admin-muted">
                      {new Date(limit.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditSave(limit.id)}
                            disabled={updateMutation.isPending}
                            className="admin-btn-primary flex items-center gap-1 text-xs disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="admin-btn-secondary text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditStart(limit)}
                          className="p-1.5 rounded hover:bg-admin-surface transition-colors"
                          title="Edit rate limit"
                        >
                          <Pencil className="w-4 h-4 text-admin-muted" />
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
                  className="px-4 py-8 text-center text-sm text-admin-muted"
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
        <h2 className="text-lg font-semibold text-admin-heading">
          Kafka Topics
        </h2>
        <button
          onClick={() => refetch()}
          className="admin-btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Topic Name
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Partitions
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Replication
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Messages
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Consumer Groups
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : topics && topics.length > 0 ? (
              topics.map((topic) => (
                <tr
                  key={topic.name}
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-admin-muted">
                      {topic.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-admin-text">
                      {topic.partitions}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-admin-text">
                      {topic.replicationFactor}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-admin-text">
                      {topic.messageCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {topic.consumerGroups.length > 0 ? (
                        topic.consumerGroups.map((group) => (
                          <span
                            key={group}
                            className="text-xs font-medium px-2 py-0.5 rounded bg-primary-900/30 text-primary-400"
                          >
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-admin-muted">None</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-admin-muted"
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
