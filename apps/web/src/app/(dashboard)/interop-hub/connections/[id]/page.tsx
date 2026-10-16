'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Settings, GitBranch, ArrowLeftRight, Map, FileCode, TestTube,
  Play, Pause, CheckCircle2, XCircle, AlertTriangle, HelpCircle,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
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

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  ERROR: 'bg-red-100 text-red-700',
};

const TABS = ['overview', 'pipelines', 'refMappings', 'fieldMappings', 'transactions', 'settings'] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, React.ElementType> = {
  overview: CheckCircle2,
  pipelines: GitBranch,
  refMappings: Map,
  fieldMappings: FileCode,
  transactions: ArrowLeftRight,
  settings: Settings,
};

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
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('connections.notFound')}</p>
        <Link href="/interop-hub/connections" className="mt-2 text-sm text-primary hover:underline">
          {t('actions.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/interop-hub/connections')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('connections.title')}
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{conn.name}</h1>
            <p className="text-sm text-muted-foreground">{conn.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[conn.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {conn.status}
            </span>
            <button
              type="button"
              onClick={() => testMut.mutate(id)}
              disabled={testMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <TestTube className="h-3.5 w-3.5" /> {t('actions.test')}
            </button>
            {conn.status !== 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => activateMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
              >
                <Play className="h-3.5 w-3.5" /> {t('actions.activate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => suspendMut.mutate(id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs text-white hover:bg-orange-700"
              >
                <Pause className="h-3.5 w-3.5" /> {t('actions.suspend')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t2) => {
          const Icon = TAB_ICONS[t2];
          return (
            <button
              key={t2}
              type="button"
              onClick={() => setTab(t2)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {t(`tab.${t2}`)}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab conn={conn} pipelines={pipelines} transactions={transactions} t={t} />}
      {tab === 'pipelines' && <PipelinesTab pipelines={pipelines} connectionId={id} t={t} />}
      {tab === 'refMappings' && <RefMappingsTab mappings={refMappings} t={t} />}
      {tab === 'fieldMappings' && <FieldMappingsTab mappings={fieldMappings} t={t} />}
      {tab === 'transactions' && <TransactionsTab transactions={transactions} t={t} />}
      {tab === 'settings' && <SettingsTab conn={conn} t={t} />}
    </div>
  );
}

// ── Tab sub-components ────────────────────────────────────────────────────────

function OverviewTab({ conn, pipelines, transactions, t }: {
  conn: any; pipelines: HubPipeline[]; transactions: HubTransaction[]; t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('detail.info')}</h3>
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
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">{t('detail.stats')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label={t('kpi.activePipelines')} value={pipelines.filter((p) => p.status === 'ACTIVE').length} />
            <StatBox label={t('detail.totalPipelines')} value={pipelines.length} />
            <StatBox label={t('detail.recentTx')} value={transactions.length} />
            <StatBox label={t('detail.failedTx')} value={transactions.filter((tx) => tx.status === 'FAILED').length} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelinesTab({ pipelines, connectionId, t }: {
  pipelines: HubPipeline[]; connectionId: string; t: (k: string) => string;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-semibold">{t('tab.pipelines')}</h3>
        <Link
          href={`/interop-hub/pipelines?connectionId=${connectionId}`}
          className="text-xs text-primary hover:underline"
        >
          {t('actions.viewAll')}
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t('col.name')}</th>
            <th className="px-4 py-2 font-medium">{t('col.domain')}</th>
            <th className="px-4 py-2 font-medium">{t('col.status')}</th>
            <th className="px-4 py-2 font-medium">{t('col.lastRun')}</th>
          </tr>
        </thead>
        <tbody>
          {pipelines.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t('pipelines.empty')}</td></tr>
          ) : pipelines.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="px-4 py-2">
                <Link href={`/interop-hub/pipelines/${p.id}`} className="text-primary hover:underline">{p.name}</Link>
              </td>
              <td className="px-4 py-2 text-xs">{p.domain}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {p.lastExecutedAt ? new Date(p.lastExecutedAt).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefMappingsTab({ mappings, t }: { mappings: HubReferentialMapping[]; t: (k: string) => string }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-semibold">{t('tab.refMappings')}</h3>
        <span className="text-xs text-muted-foreground">{mappings.length} {t('detail.entries')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t('col.refType')}</th>
              <th className="px-4 py-2 font-medium">{t('col.externalCode')}</th>
              <th className="px-4 py-2 font-medium">{t('col.externalLabel')}</th>
              <th className="px-4 py-2 font-medium">{t('col.internalCode')}</th>
              <th className="px-4 py-2 font-medium">{t('col.internalLabel')}</th>
              <th className="px-4 py-2 font-medium">{t('col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t('mappings.empty')}</td></tr>
            ) : mappings.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2 text-xs font-medium">{m.referentialType}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.externalCode}</td>
                <td className="px-4 py-2 text-xs">{m.externalLabel ?? '-'}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.internalCode}</td>
                <td className="px-4 py-2 text-xs">{m.internalLabel ?? '-'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[m.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldMappingsTab({ mappings, t }: { mappings: HubFieldMapping[]; t: (k: string) => string }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-semibold">{t('tab.fieldMappings')}</h3>
        <span className="text-xs text-muted-foreground">{mappings.length} {t('detail.entries')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t('col.sourceField')}</th>
              <th className="px-4 py-2 font-medium">{t('col.targetField')}</th>
              <th className="px-4 py-2 font-medium">{t('col.transform')}</th>
              <th className="px-4 py-2 font-medium">{t('col.required')}</th>
              <th className="px-4 py-2 font-medium">{t('col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t('mappings.empty')}</td></tr>
            ) : mappings.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2 font-mono text-xs">{m.sourceField}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.targetField}</td>
                <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs">{m.transformExpression ?? '-'}</td>
                <td className="px-4 py-2 text-xs">{m.isRequired ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[m.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTab({ transactions, t }: { transactions: HubTransaction[]; t: (k: string) => string }) {
  const TX_CLS: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-gray-100 text-gray-700',
    AWAITING_APPROVAL: 'bg-purple-100 text-purple-700',
  };
  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t('col.id')}</th>
            <th className="px-4 py-2 font-medium">{t('col.direction')}</th>
            <th className="px-4 py-2 font-medium">{t('col.domain')}</th>
            <th className="px-4 py-2 font-medium">{t('col.records')}</th>
            <th className="px-4 py-2 font-medium">{t('col.status')}</th>
            <th className="px-4 py-2 font-medium">{t('col.date')}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t('transactions.empty')}</td></tr>
          ) : transactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="px-4 py-2">
                <Link href={`/interop-hub/transactions/${tx.id}`} className="font-mono text-xs text-primary hover:underline">
                  {tx.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-2 text-xs">{tx.direction}</td>
              <td className="px-4 py-2 text-xs">{tx.domain}</td>
              <td className="px-4 py-2 text-xs">{tx.totalRecords}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TX_CLS[tx.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {tx.status}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {new Date(tx.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({ conn, t }: { conn: any; t: (k: string) => string }) {
  return (
    <div className="max-w-2xl space-y-4 rounded-lg border bg-card p-6">
      <h3 className="font-semibold">{t('tab.settings')}</h3>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
