'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Settings, GitBranch, ArrowLeftRight, Map, FileCode, TestTube,
  Play, Pause, CheckCircle2, XCircle, AlertTriangle, Wifi, WifiOff,
  Activity, Clock, Zap, TrendingUp,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubConnection,
  useHubPipelines,
  useHubReferentialMappings,
  useHubFieldMappings,
  useHubTransactions,
  useUpdateHubConnection,
  useTestHubConnection,
  useActivateHubConnection,
  useSuspendHubConnection,
  type HubPipeline,
  type HubReferentialMapping,
  type HubFieldMapping,
  type HubTransaction,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_CFG: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
  INACTIVE: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600 dark:text-gray-400' },
  SUSPENDED: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300' },
  ERROR: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300' },
};

const HEALTH_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  ACTIVE: { icon: Wifi, cls: 'text-emerald-500' },
  INACTIVE: { icon: WifiOff, cls: 'text-gray-400' },
  SUSPENDED: { icon: WifiOff, cls: 'text-amber-500' },
  ERROR: { icon: AlertTriangle, cls: 'text-red-500' },
};

const TABS = ['overview', 'pipelines', 'refMappings', 'fieldMappings', 'transactions', 'settings'] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, React.ElementType> = {
  overview: Activity,
  pipelines: GitBranch,
  refMappings: Map,
  fieldMappings: FileCode,
  transactions: ArrowLeftRight,
  settings: Settings,
};

/* ── Page ─────────────────────────────────────────────────────── */

export default function ConnectionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('interopHub');
  const [tab, setTab] = useState<Tab>('overview');

  const { data: connData, isLoading } = useHubConnection(id);
  const conn = connData?.data;

  const { data: pipelinesData } = useHubPipelines({ connectionId: id, limit: 100 });
  const pipelines = pipelinesData?.data ?? [];

  const { data: refMapData } = useHubReferentialMappings(id);
  const refMappings = refMapData?.data ?? [];

  const { data: fieldMapData } = useHubFieldMappings(id);
  const fieldMappings = fieldMapData?.data ?? [];

  const { data: txData } = useHubTransactions({ connectionId: id, limit: 20 });
  const transactions = txData?.data ?? [];

  const testMut = useTestHubConnection();
  const activateMut = useActivateHubConnection();
  const suspendMut = useSuspendHubConnection();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-48 animate-pulse rounded-xl bg-card/50 border border-border/50" />
        <div className="h-12 animate-pulse rounded-xl bg-card/50 border border-border/50" />
        <div className="h-64 animate-pulse rounded-xl bg-card/50 border border-border/50" />
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t('connections.notFound')}</p>
        <Link href="/interop-hub/connections" className="mt-2 text-sm text-primary hover:underline">
          {t('actions.back')}
        </Link>
      </div>
    );
  }

  const stCfg = STATUS_CFG[conn.status] ?? STATUS_CFG.INACTIVE;
  const healthCfg = HEALTH_ICON[conn.status] ?? HEALTH_ICON.INACTIVE;
  const HealthIcon = healthCfg.icon;

  const successRate = transactions.length > 0
    ? Math.round((transactions.filter((tx) => tx.status === 'COMPLETED').length / transactions.length) * 100)
    : 0;
  const totalRecords = transactions.reduce((sum, tx) => sum + tx.totalRecords, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/interop-hub/connections')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('connections.title')}
      </button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl', healthCfg.cls, 'bg-card border border-border/50')}>
              <HealthIcon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{conn.name}</h1>
              {conn.description && <p className="mt-0.5 text-sm text-muted-foreground">{conn.description}</p>}
              <div className="mt-2 flex items-center gap-3">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', stCfg.bg, stCfg.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', stCfg.dot)} />
                  {conn.status}
                </span>
                <span className="text-xs text-muted-foreground">{conn.externalSystem} / {conn.transportType}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => testMut.mutate(id)}
              disabled={testMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-xs font-medium transition-all hover:bg-accent disabled:opacity-50"
            >
              <TestTube className="h-3.5 w-3.5" /> {t('actions.test')}
            </button>
            {conn.status !== 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => activateMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
              >
                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => suspendMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5"
              >
                <Pause className="h-3.5 w-3.5" /> {t('actions.suspend')}
              </button>
            )}
          </div>
        </div>

        {/* Mini KPI stats row */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiMini icon={GitBranch} label={t('detail.totalPipelines')} value={pipelines.length} />
          <KpiMini icon={ArrowLeftRight} label={t('detail.recentTx')} value={transactions.length} />
          <KpiMini icon={TrendingUp} label={t('kpi.successRate') || 'Success Rate'} value={`${successRate}%`} />
          <KpiMini icon={Zap} label={t('kpi.totalRecords') || 'Total Records'} value={totalRecords} />
        </div>
      </div>

      {/* Tabs - underline style */}
      <div className="flex gap-1 overflow-x-auto border-b border-border/50">
        {TABS.map((t2) => {
          const Icon = TAB_ICONS[t2];
          const active = tab === t2;
          return (
            <button
              key={t2}
              type="button"
              onClick={() => setTab(t2)}
              className={cn(
                '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="h-4 w-4" /> {t(`tab.${t2}`)}
            </button>
          );
        })}
      </div>

      {/* Tab content in glass card */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
        {tab === 'overview' && <OverviewTab conn={conn} pipelines={pipelines} transactions={transactions} t={t} />}
        {tab === 'pipelines' && <PipelinesTab pipelines={pipelines} connectionId={id} t={t} />}
        {tab === 'refMappings' && <RefMappingsTab mappings={refMappings} t={t} />}
        {tab === 'fieldMappings' && <FieldMappingsTab mappings={fieldMappings} t={t} />}
        {tab === 'transactions' && <TransactionsTab transactions={transactions} t={t} />}
        {tab === 'settings' && <SettingsTab conn={conn} t={t} />}
      </div>
    </div>
  );
}

/* ── Tab sub-components ───────────────────────────────────────── */

function OverviewTab({ conn, pipelines, transactions, t }: {
  conn: any; pipelines: HubPipeline[]; transactions: HubTransaction[];
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t('detail.info')}</h3>
        <dl className="space-y-2 text-sm">
          <InfoRow label={t('field.direction')} value={t(`direction.${conn.direction}`)} />
          <InfoRow label={t('field.systemType')} value={conn.externalSystem} />
          <InfoRow label={t('field.transportType')} value={conn.transportType} />
          <InfoRow label={t('field.baseUrl')} value={conn.baseUrl || '-'} />
          <InfoRow label={t('field.authType')} value={conn.authType} />
          <InfoRow label={t('field.created')} value={new Date(conn.createdAt).toLocaleDateString()} />
        </dl>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">{t('detail.stats')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t('kpi.activePipelines')} value={pipelines.filter((p) => p.status === 'ACTIVE').length} color="emerald" />
          <StatCard label={t('detail.totalPipelines')} value={pipelines.length} color="blue" />
          <StatCard label={t('detail.recentTx')} value={transactions.length} color="indigo" />
          <StatCard label={t('detail.failedTx')} value={transactions.filter((tx) => tx.status === 'FAILED').length} color="red" />
        </div>
      </div>
    </div>
  );
}

function PipelinesTab({ pipelines, connectionId, t }: {
  pipelines: HubPipeline[]; connectionId: string; t: (k: string) => string;
}) {
  const statusDot: Record<string, string> = { ACTIVE: 'bg-emerald-500', PAUSED: 'bg-amber-500', DRAFT: 'bg-gray-400', ARCHIVED: 'bg-red-400' };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('tab.pipelines')}</h3>
        <Link href={`/interop-hub/pipelines?connectionId=${connectionId}`} className="text-xs text-primary hover:underline">{t('actions.viewAll')}</Link>
      </div>
      {pipelines.length === 0 ? (
        <EmptyState icon={GitBranch} message={t('pipelines.empty')} />
      ) : (
        <div className="space-y-2">
          {pipelines.map((p) => (
            <Link
              key={p.id}
              href={`/interop-hub/pipelines/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span className={cn('h-2 w-2 rounded-full', statusDot[p.status] ?? 'bg-gray-400')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.domain} / {p.entity || '-'}</p>
              </div>
              <span className="text-xs text-muted-foreground">{p.lastExecutedAt ? new Date(p.lastExecutedAt).toLocaleDateString() : '-'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RefMappingsTab({ mappings, t }: { mappings: HubReferentialMapping[]; t: (k: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('tab.refMappings')}</h3>
        <span className="text-xs text-muted-foreground">{mappings.length} {t('detail.entries')}</span>
      </div>
      {mappings.length === 0 ? (
        <EmptyState icon={Map} message={t('mappings.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">{t('col.refType')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.externalCode')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.internalCode')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.status')}</th>
            </tr></thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs font-medium">{m.referentialType}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.externalCode}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.internalCode}</td>
                  <td className="px-3 py-2"><StatusDot status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FieldMappingsTab({ mappings, t }: { mappings: HubFieldMapping[]; t: (k: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('tab.fieldMappings')}</h3>
        <span className="text-xs text-muted-foreground">{mappings.length} {t('detail.entries')}</span>
      </div>
      {mappings.length === 0 ? (
        <EmptyState icon={FileCode} message={t('mappings.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">{t('col.sourceField')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.targetField')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.transform')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('col.required')}</th>
            </tr></thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{m.sourceField}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.targetField}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs">{m.transformExpression ?? '-'}</td>
                  <td className="px-3 py-2 text-xs">{m.isRequired ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionsTab({ transactions, t }: { transactions: HubTransaction[]; t: (k: string) => string }) {
  const txDot: Record<string, string> = {
    COMPLETED: 'bg-emerald-500', FAILED: 'bg-red-500', IN_PROGRESS: 'bg-blue-500',
    PENDING: 'bg-gray-400', AWAITING_APPROVAL: 'bg-purple-500',
  };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('tab.transactions')}</h3>
      {transactions.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} message={t('transactions.empty')} />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Link
              key={tx.id}
              href={`/interop-hub/transactions/${tx.id}`}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span className={cn('h-2 w-2 rounded-full', txDot[tx.status] ?? 'bg-gray-400')} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs">{tx.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{tx.domain} / {tx.direction}</p>
              </div>
              <span className="text-xs text-muted-foreground">{tx.totalRecords} records</span>
              <span className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ conn, t }: { conn: any; t: (k: string) => string }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h3 className="text-sm font-semibold">{t('tab.settings')}</h3>
      <dl className="space-y-3 text-sm">
        <InfoRow label={t('field.name')} value={conn.name} />
        <InfoRow label={t('field.description')} value={conn.description || '-'} />
        <InfoRow label={t('field.direction')} value={conn.direction} />
        <InfoRow label={t('field.systemType')} value={conn.externalSystem} />
        <InfoRow label={t('field.transportType')} value={conn.transportType} />
        <InfoRow label={t('field.baseUrl')} value={conn.baseUrl || '-'} />
        <InfoRow label={t('field.authType')} value={conn.authType} />
        <InfoRow label={t('field.created')} value={new Date(conn.createdAt).toLocaleDateString()} />
        <InfoRow label={t('field.updated')} value={new Date(conn.updatedAt).toLocaleDateString()} />
      </dl>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/30 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-green-500/5 border-emerald-200/50 dark:border-emerald-800/50',
    blue: 'from-blue-500/10 to-cyan-500/5 border-blue-200/50 dark:border-blue-800/50',
    indigo: 'from-indigo-500/10 to-purple-500/5 border-indigo-200/50 dark:border-indigo-800/50',
    red: 'from-red-500/10 to-rose-500/5 border-red-200/50 dark:border-red-800/50',
  };
  return (
    <div className={cn('rounded-lg border bg-gradient-to-br p-3 text-center', colors[color])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function KpiMini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-card/50 p-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const dots: Record<string, string> = { ACTIVE: 'bg-emerald-500', INACTIVE: 'bg-gray-400', DRAFT: 'bg-gray-400' };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[status] ?? 'bg-gray-400')} />
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
