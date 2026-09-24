'use client';

import { useState, useMemo } from 'react';
import {
  Radio,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Send,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import {
  useKafkaHealth,
  useKafkaAlertRecipients,
  useUpdateKafkaAlertRecipients,
  useRestartService,
  useTestKafkaAlert,
} from '@/lib/api/hooks';
import type { ConsumerGroupHealth } from '@/lib/api/hooks';

// ── Helpers ──

function statusColor(status: string) {
  if (status === 'healthy') return 'text-status-healthy';
  if (status === 'warning') return 'text-status-degraded';
  return 'text-status-down';
}

function statusBg(status: string) {
  if (status === 'healthy') return 'bg-status-healthy';
  if (status === 'warning') return 'bg-status-degraded';
  return 'bg-status-down';
}

function statusBgLight(status: string) {
  if (status === 'healthy') return 'bg-status-healthy/10';
  if (status === 'warning') return 'bg-status-degraded/10';
  return 'bg-status-down/10';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle className="w-4 h-4 text-status-healthy" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-status-degraded" />;
  return <XCircle className="w-4 h-4 text-status-down" />;
}

// ── Summary Cards ──

function SummaryCards({ data }: { data: { total: number; healthy: number; warning: number; critical: number; totalLag: number } }) {
  const cards = [
    { label: 'Total Consumers', value: data.total, color: 'text-primary-400', bg: 'bg-primary-900/30' },
    { label: 'Healthy', value: data.healthy, color: 'text-status-healthy', bg: 'bg-status-healthy/10' },
    { label: 'Warning', value: data.warning, color: 'text-status-degraded', bg: 'bg-status-degraded/10' },
    { label: 'Critical', value: data.critical, color: 'text-status-down', bg: 'bg-status-down/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="admin-card p-4">
          <p className="text-xs text-admin-muted mb-1">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Consumer Row ──

function ConsumerRow({
  consumer,
  onRestart,
  restarting,
}: {
  consumer: ConsumerGroupHealth;
  onRestart: (svc: string) => void;
  restarting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors cursor-pointer"
        onClick={() => consumer.partitions.length > 0 && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBg(consumer.healthStatus)}`} />
            <StatusIcon status={consumer.healthStatus} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {consumer.partitions.length > 0 && (
              expanded
                ? <ChevronDown className="w-3.5 h-3.5 text-admin-muted flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-admin-muted flex-shrink-0" />
            )}
            <span className="text-sm font-mono text-admin-text">{consumer.groupId}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBgLight(consumer.healthStatus)} ${statusColor(consumer.healthStatus)}`}>
            {consumer.state}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-admin-muted">
          {consumer.serviceName ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-admin-muted text-center">
          {consumer.members}
        </td>
        <td className="px-4 py-3">
          <span className={`text-sm font-mono font-medium ${statusColor(consumer.healthStatus)}`}>
            {consumer.totalLag.toLocaleString()}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {consumer.serviceName && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(consumer.serviceName!); }}
              disabled={restarting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded
                bg-status-down/10 text-status-down hover:bg-status-down/20 disabled:opacity-50
                transition-colors"
              title={`Restart ${consumer.serviceName}`}
            >
              <RotateCcw className={`w-3 h-3 ${restarting ? 'animate-spin' : ''}`} />
              Restart
            </button>
          )}
        </td>
      </tr>
      {expanded && consumer.partitions.length > 0 && (
        <tr className="bg-admin-surface/50">
          <td colSpan={7} className="px-8 py-3">
            <div className="text-xs space-y-1">
              <div className="grid grid-cols-5 gap-4 font-medium text-admin-muted pb-1 border-b border-admin-border/30">
                <span>Topic</span>
                <span>Partition</span>
                <span>Current Offset</span>
                <span>End Offset</span>
                <span>Lag</span>
              </div>
              {consumer.partitions.map((p) => (
                <div key={`${p.topic}-${p.partition}`} className="grid grid-cols-5 gap-4 text-admin-text font-mono">
                  <span className="truncate">{p.topic}</span>
                  <span>{p.partition}</span>
                  <span>{p.currentOffset}</span>
                  <span>{p.logEndOffset}</span>
                  <span className={p.lag > 1000 ? 'text-status-down font-bold' : p.lag > 100 ? 'text-status-degraded' : ''}>
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

// ── Alert Recipients Panel ──

function AlertRecipientsPanel() {
  const { data, isLoading } = useKafkaAlertRecipients();
  const updateMutation = useUpdateKafkaAlertRecipients();
  const testMutation = useTestKafkaAlert();
  const [newEmail, setNewEmail] = useState('');
  const [expanded, setExpanded] = useState(false);

  const recipients = data?.recipients ?? [];

  const addRecipient = () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@') || recipients.includes(email)) return;
    updateMutation.mutate([...recipients, email]);
    setNewEmail('');
  };

  const removeRecipient = (email: string) => {
    updateMutation.mutate(recipients.filter(r => r !== email));
  };

  return (
    <div className="admin-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-primary-400" />
          <div>
            <h2 className="text-sm font-semibold text-admin-heading">Alert Recipients</h2>
            <p className="text-xs text-admin-muted">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-admin-muted" /> : <ChevronRight className="w-4 h-4 text-admin-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-admin-border pt-4">
          {/* Recipient list */}
          <div className="flex flex-wrap gap-2">
            {isLoading ? (
              <span className="text-xs text-admin-muted">Loading...</span>
            ) : recipients.length === 0 ? (
              <span className="text-xs text-admin-muted">No recipients configured. Alerts will not be sent.</span>
            ) : (
              recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-900/30 text-primary-400 text-xs font-medium"
                >
                  {email}
                  <button
                    onClick={() => removeRecipient(email)}
                    className="hover:text-status-down transition-colors"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Add recipient */}
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
              placeholder="Add email address..."
              className="admin-input flex-1 text-sm"
            />
            <button
              onClick={addRecipient}
              disabled={!newEmail.includes('@') || updateMutation.isPending}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded
                bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {/* Test alert */}
          <div className="flex items-center gap-3 pt-2 border-t border-admin-border/50">
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || recipients.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded
                bg-admin-surface border border-admin-border text-admin-text
                hover:bg-admin-hover disabled:opacity-50 transition-colors"
            >
              <Send className="w-3 h-3" />
              {testMutation.isPending ? 'Sending...' : 'Send Test Alert'}
            </button>
            {testMutation.isSuccess && (
              <span className="text-xs text-status-healthy">Test alert sent successfully!</span>
            )}
            {testMutation.isError && (
              <span className="text-xs text-status-down">Failed to send test alert</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function KafkaHealthPage() {
  const { data: healthData, isLoading, refetch, dataUpdatedAt } = useKafkaHealth();
  const restartMutation = useRestartService();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [confirmRestart, setConfirmRestart] = useState<string | null>(null);

  const consumers = healthData?.consumers ?? [];

  const filtered = useMemo(() => {
    return consumers.filter((c) => {
      if (search && !c.groupId.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && c.healthStatus !== statusFilter) return false;
      if (stateFilter && c.state.toLowerCase() !== stateFilter.toLowerCase()) return false;
      return true;
    });
  }, [consumers, search, statusFilter, stateFilter]);

  const uniqueStates = useMemo(() => {
    return [...new Set(consumers.map(c => c.state))].sort();
  }, [consumers]);

  const handleRestart = (serviceName: string) => {
    setConfirmRestart(serviceName);
  };

  const executeRestart = () => {
    if (confirmRestart) {
      restartMutation.mutate(confirmRestart);
      setConfirmRestart(null);
    }
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-heading flex items-center gap-3">
            <Radio className="w-6 h-6 text-primary-400" />
            Kafka Consumer Health
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Monitor {healthData?.totalGroups ?? 0} consumer groups across all ARIS services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-admin-muted">
            Updated: {lastUpdated}
          </span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded
              bg-admin-surface border border-admin-border text-admin-text
              hover:bg-admin-hover transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <SummaryCards
        data={{
          total: healthData?.totalGroups ?? 0,
          healthy: healthData?.healthy ?? 0,
          warning: healthData?.warning ?? 0,
          critical: healthData?.critical ?? 0,
          totalLag: healthData?.totalLag ?? 0,
        }}
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search consumer group..."
            className="admin-input pl-10 w-full text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-input text-sm"
        >
          <option value="">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="admin-input text-sm"
        >
          <option value="">All States</option>
          {uniqueStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Consumer Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-16">Status</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">Consumer Group</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-32">State</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-32">Service</th>
              <th className="text-center text-xs font-medium text-admin-muted px-4 py-3 w-20">Members</th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3 w-24">Lag</th>
              <th className="text-right text-xs font-medium text-admin-muted px-4 py-3 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-admin-surface rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((consumer) => (
                <ConsumerRow
                  key={consumer.groupId}
                  consumer={consumer}
                  onRestart={handleRestart}
                  restarting={restartMutation.isPending}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-admin-muted">
                  {consumers.length === 0 ? 'No consumer groups found' : 'No results matching filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Restart notification */}
      {restartMutation.isSuccess && (
        <div className="admin-card p-4 border-l-4 border-status-healthy">
          <p className="text-sm text-status-healthy">
            Restart signal sent. Service will be back in ~10 seconds.
          </p>
        </div>
      )}
      {restartMutation.isError && (
        <div className="admin-card p-4 border-l-4 border-status-down">
          <p className="text-sm text-status-down">
            Failed to restart service. The container may already be down.
          </p>
        </div>
      )}

      {/* Alert Recipients */}
      <AlertRecipientsPanel />

      {/* Confirm Restart Dialog */}
      {confirmRestart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="admin-card p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-admin-heading">Confirm Restart</h3>
            <p className="text-sm text-admin-muted">
              Are you sure you want to restart <strong className="text-admin-text">aris-{confirmRestart}</strong>?
              This will temporarily disconnect all Kafka consumers in this service.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmRestart(null)}
                className="px-4 py-2 text-sm font-medium rounded bg-admin-surface border border-admin-border
                  text-admin-text hover:bg-admin-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeRestart}
                className="px-4 py-2 text-sm font-medium rounded bg-status-down text-white
                  hover:bg-red-700 transition-colors"
              >
                Restart Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
