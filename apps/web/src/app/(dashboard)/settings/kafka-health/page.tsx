'use client';

import React, { useState, useMemo } from 'react';
import {
  Radio, RefreshCw, ChevronDown, ChevronRight, RotateCcw, Send,
  Plus, X, AlertTriangle, CheckCircle2, XCircle, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface PartitionLag {
  topic: string;
  partition: number;
  currentOffset: string;
  logEndOffset: string;
  lag: number;
}

interface ConsumerGroupHealth {
  groupId: string;
  state: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
  members: number;
  totalLag: number;
  partitions: PartitionLag[];
  serviceName: string | null;
}

interface KafkaHealthSummary {
  totalGroups: number;
  healthy: number;
  warning: number;
  critical: number;
  totalLag: number;
  consumers: ConsumerGroupHealth[];
  polledAt: string;
}

/* ─── Hooks ────────────────────────────────────────────────────────────────── */

function useKafkaHealth() {
  return useQuery<KafkaHealthSummary>({
    queryKey: ['kafka-health'],
    queryFn: () => apiClient.get('/admin/kafka/health'),
    refetchInterval: 15_000,
  });
}

function useAlertRecipients() {
  return useQuery<{ recipients: string[] }>({
    queryKey: ['kafka-alert-recipients'],
    queryFn: () => apiClient.get('/admin/kafka/alert-recipients'),
  });
}

function useUpdateAlertRecipients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recipients: string[]) =>
      apiClient.put('/admin/kafka/alert-recipients', { recipients }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kafka-alert-recipients'] }),
  });
}

function useRestartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serviceName: string) =>
      apiClient.post('/admin/kafka/restart-service', { serviceName }),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['kafka-health'] }), 5000);
    },
  });
}

function useTestAlert() {
  return useMutation({
    mutationFn: () => apiClient.post('/admin/kafka/test-alert'),
  });
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const statusColors: Record<string, string> = {
  healthy: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
};

const statusBg: Record<string, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const statusBadge: Record<string, string> = {
  healthy: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

/* ─── Consumer Row ─────────────────────────────────────────────────────────── */

function ConsumerRow({
  consumer, onRestart, restarting,
}: {
  consumer: ConsumerGroupHealth;
  onRestart: (svc: string) => void;
  restarting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
        onClick={() => consumer.partitions.length > 0 && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', statusBg[consumer.healthStatus])} />
            <StatusIcon status={consumer.healthStatus} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {consumer.partitions.length > 0 && (
              expanded
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            )}
            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{consumer.groupId}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusBadge[consumer.healthStatus])}>
            {consumer.state}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {consumer.serviceName ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          {consumer.members}
        </td>
        <td className="px-4 py-3">
          <span className={cn('text-sm font-mono font-medium', statusColors[consumer.healthStatus])}>
            {consumer.totalLag.toLocaleString()}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {consumer.serviceName && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(consumer.serviceName!); }}
              disabled={restarting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded
                bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40
                disabled:opacity-50 transition-colors"
              title={`Restart ${consumer.serviceName}`}
            >
              <RotateCcw className={cn('w-3 h-3', restarting && 'animate-spin')} />
              Restart
            </button>
          )}
        </td>
      </tr>
      {expanded && consumer.partitions.length > 0 && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/30">
          <td colSpan={7} className="px-8 py-3">
            <div className="text-xs space-y-1">
              <div className="grid grid-cols-5 gap-4 font-medium text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-200 dark:border-gray-700">
                <span>Topic</span>
                <span>Partition</span>
                <span>Current Offset</span>
                <span>End Offset</span>
                <span>Lag</span>
              </div>
              {consumer.partitions.map((p) => (
                <div key={`${p.topic}-${p.partition}`} className="grid grid-cols-5 gap-4 text-gray-700 dark:text-gray-300 font-mono">
                  <span className="truncate">{p.topic}</span>
                  <span>{p.partition}</span>
                  <span>{p.currentOffset}</span>
                  <span>{p.logEndOffset}</span>
                  <span className={cn(p.lag > 1000 ? 'text-red-600 dark:text-red-400 font-bold' : p.lag > 100 ? 'text-amber-600 dark:text-amber-400' : '')}>
                    {p.lag.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Alert Recipients ─────────────────────────────────────────────────────── */

function AlertRecipientsPanel() {
  const { data, isLoading } = useAlertRecipients();
  const updateMut = useUpdateAlertRecipients();
  const testMut = useTestAlert();
  const [newEmail, setNewEmail] = useState('');
  const [open, setOpen] = useState(false);

  const recipients = data?.recipients ?? [];

  const add = () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@') || recipients.includes(email)) return;
    updateMut.mutate([...recipients, email]);
    setNewEmail('');
  };

  const remove = (email: string) => updateMut.mutate(recipients.filter(r => r !== email));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Alert Recipients</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} — Emails sent via Postmark when a consumer is unhealthy
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex flex-wrap gap-2">
            {isLoading ? (
              <span className="text-xs text-gray-400">Loading...</span>
            ) : recipients.length === 0 ? (
              <span className="text-xs text-gray-400">No recipients configured. Alerts will not be sent.</span>
            ) : (
              recipients.map((email) => (
                <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aris-primary-50 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400 text-xs font-medium">
                  {email}
                  <button onClick={() => remove(email)} className="hover:text-red-500 transition-colors" title="Remove">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Add email address..."
              className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent"
            />
            <button
              onClick={add}
              disabled={!newEmail.includes('@') || updateMut.isPending}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending || recipients.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3 h-3" />
              {testMut.isPending ? 'Sending...' : 'Send Test Alert'}
            </button>
            {testMut.isSuccess && <span className="text-xs text-green-600 dark:text-green-400">Test alert sent!</span>}
            {testMut.isError && <span className="text-xs text-red-600 dark:text-red-400">Failed to send</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export default function KafkaHealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useKafkaHealth();
  const restartMut = useRestartService();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmRestart, setConfirmRestart] = useState<string | null>(null);

  const consumers = data?.consumers ?? [];

  const filtered = useMemo(() => consumers.filter((c) => {
    if (search && !c.groupId.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && c.healthStatus !== statusFilter) return false;
    return true;
  }), [consumers, search, statusFilter]);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  const kpis = [
    { label: 'Total', value: data?.totalGroups ?? 0, color: 'text-aris-primary-600 dark:text-aris-primary-400' },
    { label: 'Healthy', value: data?.healthy ?? 0, color: 'text-green-600 dark:text-green-400' },
    { label: 'Warning', value: data?.warning ?? 0, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Critical', value: data?.critical ?? 0, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <SuperAdminGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
            Kafka Consumer Health
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time monitoring of {data?.totalGroups ?? 0} consumer groups across all ARIS services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SettingsBackButton />
          <span className="text-xs text-gray-400">{lastUpdated}</span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{k.label}</p>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search consumer group..."
            className="w-full pl-10 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-16">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Consumer Group</th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-28">State</th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-28">Service</th>
              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-20">Members</th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-20">Lag</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((c) => (
                <ConsumerRow
                  key={c.groupId}
                  consumer={c}
                  onRestart={(svc) => setConfirmRestart(svc)}
                  restarting={restartMut.isPending}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  {consumers.length === 0 ? 'No consumer groups found' : 'No results matching filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Restart feedback */}
      {restartMut.isSuccess && (
        <div className="rounded-lg p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
          <p className="text-sm text-green-700 dark:text-green-400">Restart signal sent. Service will be back in ~10 seconds.</p>
        </div>
      )}
      {restartMut.isError && (
        <div className="rounded-lg p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">Failed to restart service. It may already be down.</p>
        </div>
      )}

      {/* Alert Recipients */}
      <AlertRecipientsPanel />

      {/* Confirm Restart Dialog */}
      {confirmRestart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Restart</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to restart <strong className="text-gray-900 dark:text-white">aris-{confirmRestart}</strong>?
              This will temporarily disconnect all Kafka consumers in this service.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmRestart(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { restartMut.mutate(confirmRestart); setConfirmRestart(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Restart Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SuperAdminGuard>
  );
}
