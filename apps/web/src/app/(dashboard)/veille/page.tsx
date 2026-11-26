'use client';

// Veille — information watch: triage queue of classified signals, sources and watchlists.

import { useMemo, useState } from 'react';
import {
  Radar, Rss, ListFilter, AlertTriangle, Search, ExternalLink, Play, Plus, Trash2, Pencil, X, Download,
  CheckCircle2, Sparkles, Loader2,
} from 'lucide-react';
import {
  useVeilleStats, useWatchSignals, useWatchSignal, useWatchSources, useWatchLists, useReviewSignal, useIntegrateSignal,
  useSaveSource, useDeleteSource, useRunSource, useSaveWatchList, useDeleteWatchList, downloadVeilleDataset,
  SIGNAL_STATUSES, SIGNAL_CATEGORIES, RELIABILITY_LEVELS, CONFIDENCE_LEVELS, NEXT_STATUSES,
  type SignalFilters, type SignalStatus, type WatchList, type WatchSource,
} from '@/lib/api/veille';
import { DATA_DOMAINS, DATA_CLASSIFICATIONS } from '@/lib/api/data-sharing';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';

type Tab = 'signals' | 'sources' | 'watchlists';
type T = (key: string, params?: Record<string, string | number>) => string;

const MANAGE_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

const STATUS_STYLE: Record<SignalStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  IN_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  TO_VERIFY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  VALIDATED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  REJECTED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  INTEGRATED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
};
const SEVERITY_STYLE = ['', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'];

const input = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800';
const btn = 'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50';
const btnPrimary = `${btn} bg-[#0B4D2C] text-white hover:bg-[#0a3f25]`;
const btnGhost = `${btn} border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800`;

const splitTerms = (s: string) => s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function VeillePage() {
  const t = useTranslations('veille');
  const role = useAuthStore((s) => s.user?.role);
  const canManage = !!role && MANAGE_ROLES.has(role);
  const [tab, setTab] = useState<Tab>('signals');
  const stats = useVeilleStats().data?.data;

  const cards = [
    { label: t('statNew'), value: stats?.byStatus?.NEW ?? 0 },
    { label: t('statAlerts'), value: stats?.openAlerts ?? 0, alert: true },
    { label: t('statWeek'), value: stats?.last7Days ?? 0 },
    { label: t('statValidated'), value: (stats?.byStatus?.VALIDATED ?? 0) + (stats?.byStatus?.INTEGRATED ?? 0) },
    { label: t('statSources'), value: `${stats?.sources.active ?? 0}/${stats?.sources.total ?? 0}`, alert: (stats?.sources.failing ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#0B4D2C]/10 p-2.5 text-[#0B4D2C] dark:text-emerald-300"><Radar className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <button className={btnGhost} onClick={() => downloadVeilleDataset().catch((e) => alert(errMsg(e)))}>
          <Download className="h-4 w-4" /> {t('downloadDataset')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.alert && c.value !== 0 && c.value !== '0/0' ? 'text-red-600' : ''}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['signals', t('tabSignals'), AlertTriangle], ['sources', t('tabSources'), Rss], ['watchlists', t('tabWatchlists'), ListFilter]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? 'border-[#0B4D2C] text-[#0B4D2C] dark:text-emerald-300' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'signals' && <SignalsTab t={t} />}
      {tab === 'sources' && <SourcesTab t={t} canManage={canManage} />}
      {tab === 'watchlists' && <WatchListsTab t={t} canManage={canManage} />}
    </div>
  );
}

/* ───────────── Signals ───────────── */

function SignalsTab({ t }: { t: T }) {
  const formatDate = useFormattedDate();
  const [filters, setFilters] = useState<SignalFilters>({ status: 'NEW', page: 1, limit: 25 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError } = useWatchSignals(filters);
  const signals = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (filters.limit ?? 25)));
  const set = (patch: Partial<SignalFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <form className="relative min-w-[14rem] flex-1" onSubmit={(e) => { e.preventDefault(); set({ search }); }}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input className={`${input} pl-9`} placeholder={t('searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <select className={`${input} w-auto`} value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
            <option value="">{t('allStatuses')}</option>
            {SIGNAL_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          <select className={`${input} w-auto`} value={filters.domain ?? ''} onChange={(e) => set({ domain: e.target.value })}>
            <option value="">{t('allDomains')}</option>
            {DATA_DOMAINS.map((d) => <option key={d} value={d}>{t(`domain.${d}`)}</option>)}
          </select>
          <select className={`${input} w-auto`} value={filters.category ?? ''} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{t('allCategories')}</option>
            {SIGNAL_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
          <select className={`${input} w-auto`} value={filters.severity ?? ''} onChange={(e) => set({ severity: e.target.value })}>
            <option value="">{t('allSeverities')}</option>
            {[3, 2, 1].map((s) => <option key={s} value={s}>{t(`severity.${s}`)}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {isLoading && <p className="p-6 text-sm text-muted-foreground">{t('loading')}</p>}
          {isError && <p className="p-6 text-sm text-red-600">{t('loadError')}</p>}
          {!isLoading && !isError && signals.length === 0 && <p className="p-6 text-sm text-muted-foreground">{t('noSignals')}</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {signals.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelected(s.id)} className={`flex w-full items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 ${selected === s.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                  <span className="mt-0.5 w-10 shrink-0 rounded-md bg-[#0B4D2C] py-1 text-center text-xs font-bold text-white" title={t('priority')}>{s.priority}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">{s.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{s.source?.name}</span>
                      <span>·</span>
                      <span>{formatDate(s.publishedAt ?? s.collectedAt)}</span>
                      {s.countries.length > 0 && <><span>·</span><span>{s.countries.join(', ')}</span></>}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge className={STATUS_STYLE[s.status]}>{t(`status.${s.status}`)}</Badge>
                      <Badge className={SEVERITY_STYLE[s.severity]}>{t(`severity.${s.severity}`)}</Badge>
                      <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t(`category.${s.category}`)}</Badge>
                      <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t(`domain.${s.domain}`)}</Badge>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('totalSignals', { total })}</span>
            <div className="flex gap-2">
              <button className={btnGhost} disabled={(filters.page ?? 1) <= 1} onClick={() => set({ page: (filters.page ?? 1) - 1 })}>{t('previous')}</button>
              <span className="self-center">{filters.page} / {pages}</span>
              <button className={btnGhost} disabled={(filters.page ?? 1) >= pages} onClick={() => set({ page: (filters.page ?? 1) + 1 })}>{t('next')}</button>
            </div>
          </div>
        )}
      </div>

      {selected ? <SignalPanel id={selected} t={t} onClose={() => setSelected(null)} /> : (
        <div className="hidden rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-muted-foreground lg:block dark:border-gray-600">{t('selectSignal')}</div>
      )}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function SignalPanel({ id, t, onClose }: { id: string; t: T; onClose: () => void }) {
  const formatDate = useFormattedDate();
  const { data, isLoading } = useWatchSignal(id);
  const review = useReviewSignal();
  const integrate = useIntegrateSignal();
  const campaigns = useCollectionCampaigns({ limit: 100, status: 'ACTIVE' }).data?.data ?? [];
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<'dataset' | 'campaign'>('dataset');
  const [campaignId, setCampaignId] = useState('');
  const [classification, setClassification] = useState('RESTRICTED');
  const [error, setError] = useState('');
  const s = data?.data;

  if (isLoading || !s) return <div className="rounded-xl border border-gray-200 p-6 text-sm dark:border-gray-700">{t('loading')}</div>;

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      setNote('');
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const summary = s.aiClassification?.summary_fr || s.aiSummary;
  const campaignName = (c: any) => (typeof c.name === 'object' ? c.name.fr ?? c.name.en : c.name) ?? c.code;

  return (
    <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold leading-snug">{s.title}</h2>
        <button onClick={onClose} aria-label={t('close')} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
      </div>
      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#8B041D] hover:underline dark:text-red-300">
        {s.source?.name} <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t('published')}</dt><dd>{s.publishedAt ? formatDate(s.publishedAt) : '—'}</dd>
        <dt className="text-muted-foreground">{t('countries')}</dt><dd>{s.countries.join(', ') || t('continental')}</dd>
        <dt className="text-muted-foreground">{t('reliability')}</dt><dd>{s.reliability} · {t(`reliabilityLevel.${s.reliability}`)}</dd>
        <dt className="text-muted-foreground">{t('relevance')}</dt><dd>{s.relevance}/100 · {t('priority')} {s.priority}</dd>
        <dt className="text-muted-foreground">{t('keywords')}</dt><dd>{s.matchedTerms.join(', ') || '—'}</dd>
      </dl>

      {summary && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> {t('aiSummary')}</p>
          {summary}
        </div>
      )}
      {s.excerpt && <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{s.excerpt.slice(0, 1200)}</p>}

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">{t('categoryLabel')}
          <select className={input} value={s.category} disabled={s.status === 'INTEGRATED'} onChange={(e) => run(() => review.mutateAsync({ id, category: e.target.value }))}>
            {SIGNAL_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">{t('severityLabel')}
          <select className={input} value={s.severity} disabled={s.status === 'INTEGRATED'} onChange={(e) => run(() => review.mutateAsync({ id, severity: Number(e.target.value) }))}>
            {[1, 2, 3].map((v) => <option key={v} value={v}>{t(`severity.${v}`)}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">{t('confidence')}
          <select className={input} value={s.confidence} disabled={s.status === 'INTEGRATED'} onChange={(e) => run(() => review.mutateAsync({ id, confidence: e.target.value }))}>
            {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{t(`confidenceLevel.${c}`)}</option>)}
          </select>
        </label>
      </div>

      {s.status !== 'INTEGRATED' && (
        <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-gray-700">
          <p className="text-sm font-medium">{t('decision')} <Badge className={STATUS_STYLE[s.status]}>{t(`status.${s.status}`)}</Badge></p>
          <textarea className={input} rows={2} placeholder={t('notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUSES[s.status].map((next) => (
              <button
                key={next}
                disabled={review.isPending}
                className={next === 'VALIDATED' ? btnPrimary : btnGhost}
                onClick={() => run(() => review.mutateAsync({ id, status: next, note: note || undefined }))}
              >
                {t(`action.${next}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {s.status === 'VALIDATED' && (
        <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-gray-700">
          <p className="text-sm font-medium">{t('integrate')}</p>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={target === 'dataset'} onChange={() => setTarget('dataset')} /> {t('targetDataset')}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={target === 'campaign'} onChange={() => setTarget('campaign')} /> {t('targetCampaign')}</label>
          </div>
          {target === 'campaign' ? (
            <select className={input} value={campaignId || s.campaignId || ''} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">{t('chooseCampaign')}</option>
              {campaigns.map((c: any) => <option key={c.id} value={c.id}>{campaignName(c)}</option>)}
            </select>
          ) : (
            <select className={input} value={classification} onChange={(e) => setClassification(e.target.value)}>
              {DATA_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{t(`classification.${c}`)}</option>)}
            </select>
          )}
          <button
            className={btnPrimary}
            disabled={integrate.isPending || (target === 'campaign' && !(campaignId || s.campaignId))}
            onClick={() => run(() => integrate.mutateAsync({ id, target, campaignId: target === 'campaign' ? campaignId || s.campaignId || undefined : undefined, dataClassification: target === 'dataset' ? classification : undefined, note: note || undefined }))}
          >
            <CheckCircle2 className="h-4 w-4" /> {t('integrateButton')}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(s.actions?.length ?? 0) > 0 && (
        <div className="border-t border-gray-100 pt-4 dark:border-gray-700">
          <p className="mb-2 text-sm font-medium">{t('history')}</p>
          <ul className="space-y-2 text-xs">
            {s.actions!.map((a) => (
              <li key={a.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatDate(a.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {' · '}{a.toStatus ? t(`status.${a.toStatus}`) : t('edited')} · {a.actorRole}
                {a.note && <span className="block italic">« {a.note} »</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/* ───────────── Sources ───────────── */

const EMPTY_SOURCE: Partial<WatchSource> = { name: '', type: 'RSS', url: '', reliability: 'C', intervalMinutes: 60, isActive: true, countryCode: '', language: '' };

function SourcesTab({ t, canManage }: { t: T; canManage: boolean }) {
  const formatDate = useFormattedDate();
  const sources = useWatchSources().data?.data ?? [];
  const save = useSaveSource();
  const remove = useDeleteSource();
  const runNow = useRunSource();
  const [editing, setEditing] = useState<Partial<WatchSource> | null>(null);
  const [message, setMessage] = useState('');

  const submit = async () => {
    try {
      await save.mutateAsync({ ...editing, countryCode: editing?.countryCode || null, language: editing?.language || null });
      setEditing(null);
      setMessage('');
    } catch (e) {
      setMessage(errMsg(e));
    }
  };
  const runSource = async (src: WatchSource) => {
    setMessage(t('scanRunning', { name: src.name }));
    try {
      const r = (await runNow.mutateAsync(src.id)).data;
      setMessage(r.error ? t('scanError', { error: r.error }) : t('scanResult', { fetched: r.fetched, created: r.created, duplicates: r.duplicates }));
    } catch (e) {
      setMessage(errMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      {canManage && <button className={btnPrimary} onClick={() => setEditing({ ...EMPTY_SOURCE })}><Plus className="h-4 w-4" /> {t('addSource')}</button>}
      {message && <p className="rounded-md bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800">{runNow.isPending && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />}{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-muted-foreground dark:bg-gray-900/40">
            <tr><th className="p-3">{t('sourceName')}</th><th className="p-3">{t('type')}</th><th className="p-3">{t('reliability')}</th><th className="p-3">{t('frequency')}</th><th className="p-3">{t('lastRun')}</th><th className="p-3">{t('signals')}</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sources.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t('noSources')}</td></tr>}
            {sources.map((src) => (
              <tr key={src.id} className={src.isActive ? '' : 'opacity-50'}>
                <td className="p-3"><p className="font-medium">{src.name}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{src.url}</p></td>
                <td className="p-3">{src.type}{src.countryCode ? ` · ${src.countryCode}` : ''}</td>
                <td className="p-3">{src.reliability}</td>
                <td className="p-3">{t('everyMinutes', { n: src.intervalMinutes })}</td>
                <td className="p-3">
                  {src.lastRunAt ? formatDate(src.lastRunAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  {src.lastStatus === 'error' && <p className="max-w-[14rem] truncate text-xs text-red-600" title={src.lastError ?? ''}>{src.lastError}</p>}
                </td>
                <td className="p-3">{src.signalCount ?? 0}</td>
                <td className="p-3">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button title={t('runNow')} className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700" disabled={runNow.isPending} onClick={() => runSource(src)}><Play className="h-4 w-4" /></button>
                      <button title={t('edit')} className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setEditing(src)}><Pencil className="h-4 w-4" /></button>
                      <button title={t('delete')} className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => confirm(t('confirmDeleteSource')) && remove.mutate(src.id)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? t('editSource') : t('addSource')} onClose={() => setEditing(null)} t={t}>
          <Field label={t('sourceName')}><input className={input} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('type')}>
              <select className={input} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as WatchSource['type'], url: e.target.value === 'GDELT' && !editing.url ? 'https://api.gdeltproject.org/api/v2/doc/doc' : editing.url })}>
                <option value="RSS">{t('typeRss')}</option>
                <option value="GDELT">{t('typeGdelt')}</option>
              </select>
            </Field>
            <Field label={t('reliability')}>
              <select className={input} value={editing.reliability} onChange={(e) => setEditing({ ...editing, reliability: e.target.value })}>
                {RELIABILITY_LEVELS.map((r) => <option key={r} value={r}>{r} · {t(`reliabilityLevel.${r}`)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('url')} hint={editing.type === 'GDELT' ? t('gdeltHint') : t('rssHint')}><input className={input} value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('countryCode')}><input className={input} maxLength={2} value={editing.countryCode ?? ''} onChange={(e) => setEditing({ ...editing, countryCode: e.target.value.toUpperCase() })} /></Field>
            <Field label={t('language')}><input className={input} maxLength={5} value={editing.language ?? ''} onChange={(e) => setEditing({ ...editing, language: e.target.value.toLowerCase() })} /></Field>
            <Field label={t('frequencyMinutes')}><input className={input} type="number" min={15} value={editing.intervalMinutes ?? 60} onChange={(e) => setEditing({ ...editing, intervalMinutes: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> {t('active')}</label>
          {message && <p className="text-sm text-red-600">{message}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setEditing(null)}>{t('cancel')}</button><button className={btnPrimary} disabled={save.isPending} onClick={submit}>{t('save')}</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── Watchlists ───────────── */

interface WatchListForm { id?: string; name: string; description: string; domain: string; campaignId: string; anyTerms: string; allTerms: string; excludeTerms: string; countries: string; isActive: boolean }

const toForm = (w?: WatchList): WatchListForm => ({
  id: w?.id, name: w?.name ?? '', description: w?.description ?? '', domain: w?.domain ?? 'animal-health', campaignId: w?.campaignId ?? '',
  anyTerms: (w?.anyTerms ?? []).join('\n'), allTerms: (w?.allTerms ?? []).join(', '), excludeTerms: (w?.excludeTerms ?? []).join(', '),
  countries: (w?.countries ?? []).join(', '), isActive: w?.isActive ?? true,
});

function WatchListsTab({ t, canManage }: { t: T; canManage: boolean }) {
  const lists = useWatchLists().data?.data ?? [];
  const campaigns = useCollectionCampaigns({ limit: 100 }).data?.data ?? [];
  const save = useSaveWatchList();
  const remove = useDeleteWatchList();
  const [form, setForm] = useState<WatchListForm | null>(null);
  const [error, setError] = useState('');
  const campaignName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campaigns as any[]) m.set(c.id, (typeof c.name === 'object' ? c.name.fr ?? c.name.en : c.name) ?? c.code);
    return m;
  }, [campaigns]);

  const submit = async () => {
    if (!form) return;
    setError('');
    try {
      await save.mutateAsync({
        id: form.id, name: form.name, description: form.description, domain: form.domain, campaignId: form.campaignId || null,
        anyTerms: splitTerms(form.anyTerms), allTerms: splitTerms(form.allTerms), excludeTerms: splitTerms(form.excludeTerms),
        countries: splitTerms(form.countries).map((c) => c.toUpperCase()), isActive: form.isActive,
      });
      setForm(null);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      {canManage && <button className={btnPrimary} onClick={() => setForm(toForm())}><Plus className="h-4 w-4" /> {t('addWatchlist')}</button>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lists.length === 0 && <p className="text-sm text-muted-foreground">{t('noWatchlists')}</p>}
        {lists.map((w) => (
          <div key={w.id} className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${w.isActive ? '' : 'opacity-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{w.name}</p>
                <p className="text-xs text-muted-foreground">{t(`domain.${w.domain}`)}{w.campaignId ? ` · ${campaignName.get(w.campaignId) ?? t('linkedCampaign')}` : ''}</p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button title={t('edit')} className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setForm(toForm(w))}><Pencil className="h-4 w-4" /></button>
                  <button title={t('delete')} className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => confirm(t('confirmDeleteWatchlist')) && remove.mutate(w.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {w.anyTerms.slice(0, 12).map((term) => <Badge key={term} className="bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">{term}</Badge>)}
              {w.anyTerms.length > 12 && <Badge className="bg-gray-100 text-gray-600">+{w.anyTerms.length - 12}</Badge>}
            </div>
            {w.allTerms.length > 0 && <p className="mt-2 text-xs"><span className="text-muted-foreground">{t('allTerms')}:</span> {w.allTerms.join(', ')}</p>}
            {w.excludeTerms.length > 0 && <p className="mt-1 text-xs"><span className="text-muted-foreground">{t('excludeTerms')}:</span> {w.excludeTerms.join(', ')}</p>}
            {w.countries.length > 0 && <p className="mt-1 text-xs"><span className="text-muted-foreground">{t('countries')}:</span> {w.countries.join(', ')}</p>}
          </div>
        ))}
      </div>

      {form && (
        <Modal title={form.id ? t('editWatchlist') : t('addWatchlist')} onClose={() => setForm(null)} t={t}>
          <Field label={t('watchlistName')}><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('domainLabel')}>
              <select className={input} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                {DATA_DOMAINS.map((d) => <option key={d} value={d}>{t(`domain.${d}`)}</option>)}
              </select>
            </Field>
            <Field label={t('linkedCampaign')}>
              <select className={input} value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">{t('noCampaign')}</option>
                {(campaigns as any[]).map((c) => <option key={c.id} value={c.id}>{campaignName.get(c.id)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('anyTerms')} hint={t('anyTermsHint')}><textarea className={input} rows={5} value={form.anyTerms} onChange={(e) => setForm({ ...form, anyTerms: e.target.value })} /></Field>
          <Field label={t('allTerms')} hint={t('allTermsHint')}><input className={input} value={form.allTerms} onChange={(e) => setForm({ ...form, allTerms: e.target.value })} /></Field>
          <Field label={t('excludeTerms')} hint={t('excludeTermsHint')}><input className={input} value={form.excludeTerms} onChange={(e) => setForm({ ...form, excludeTerms: e.target.value })} /></Field>
          <Field label={t('countries')} hint={t('countriesHint')}><input className={input} value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> {t('active')}</label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setForm(null)}>{t('cancel')}</button><button className={btnPrimary} disabled={save.isPending} onClick={submit}>{t('save')}</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── UI helpers ───────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Modal({ title, onClose, children, t }: { title: string; onClose: () => void; children: React.ReactNode; t: T }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label={t('close')} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
