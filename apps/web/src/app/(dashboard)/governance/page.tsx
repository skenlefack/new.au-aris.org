'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, ChevronLeft, ChevronRight, Activity, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, FileText, ArrowRight, Landmark, Scale, Users,
  GraduationCap, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDataDashboard } from '@/components/domain/CampaignDataDashboard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';
import { useCollectionCampaigns } from '@/lib/api/workflow-hooks';
import { useFormSubmissions, useFormBuilderTemplates } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const GOV_ALERT_TEMPLATE_ID = 'e81014c7-7bb1-4fde-8d82-4d6024776113';

export default function GovernancePage() {
  const t = useTranslations('governance');
  const { sections } = useDomainConfig('governance');
  const campaignsQuery = useCollectionCampaigns({ domain: 'governance', limit: 20 });
  const campaigns: any[] = Array.isArray(campaignsQuery.data?.data) ? campaignsQuery.data.data : [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
  const totalSubmissions = campaigns.reduce((s: number, c: any) => s + (c.totalSubmissions ?? 0), 0);
  const targetSubmissions = campaigns.reduce((s: number, c: any) => s + (c.targetSubmissions ?? 0), 0);
  const completionRate = targetSubmissions > 0 ? Math.round((totalSubmissions / targetSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <Link href={`/collecte/forms/${GOV_ALERT_TEMPLATE_ID}/fill?returnTo=/governance`} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> {t('reportIssue') || 'Report Event'}
        </Link>
      </div>

      {sections.kpis && (campaignsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label={t('activeCampaigns') || 'Active Campaigns'} value={activeCampaigns.length} icon={<Activity className="h-5 w-5" />} color="#4527A0" />
          <KpiCard label={t('totalSubmissions') || 'Total Submissions'} value={totalSubmissions} icon={<CheckCircle2 className="h-5 w-5" />} color="#2E7D32" />
          <KpiCard label={t('completionRate') || 'Completion Rate'} value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="#1565C0" />
          <KpiCard label={t('totalCampaigns') || 'Total Campaigns'} value={campaigns.length} icon={<Landmark className="h-5 w-5" />} color="#C62828" />
        </div>
      ))}

      {sections.chart && <CampaignCarousel campaigns={campaigns} isLoading={campaignsQuery.isLoading} />}
      {(sections.map || sections.statistics || sections.curve) && (
        <CampaignDataDashboard domain="governance" showMap={sections.map} showStats={sections.statistics} showCurve={sections.curve} />
      )}

      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/governance/legal-frameworks', label: t('legalFrameworks'), desc: t('legalFrameworksDesc'), icon: Scale, color: '#4527A0' },
            { href: '/governance/vet-evaluations', label: t('vetEvaluations'), desc: t('vetEvaluationsDesc'), icon: Landmark, color: '#1565C0' },
            { href: '/governance/stakeholders', label: t('stakeholders'), desc: t('stakeholdersDesc'), icon: Users, color: '#00695C' },
            { href: '/governance/capacity', label: t('capacity'), desc: t('capacityDesc'), icon: GraduationCap, color: '#2E7D32' },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: `${link.color}14`, color: link.color }}><link.icon className="h-5 w-5" /></div>
              <div><span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 dark:text-gray-300">{link.label}</span><p className="mt-0.5 text-xs text-gray-400">{link.desc}</p></div>
            </Link>
          ))}
        </div>
      )}

      <GovCatalog />

      {sections.alertForm && <RecentEventsCard templateId={GOV_ALERT_TEMPLATE_ID} />}
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  const formatted = typeof value === 'number' ? (value >= 1000 ? value.toLocaleString() : String(value)) : value;
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatted}</p></div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>{icon}</span>
      </div>
    </div>
  );
}

const COLORS = ['#4527A0', '#1565C0', '#2E7D32', '#C62828', '#E65100', '#00695C'];
function CampaignCarousel({ campaigns, isLoading }: { campaigns: any[]; isLoading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const updateScroll = useCallback(() => { const el = scrollRef.current; if (!el) return; setCanScrollLeft(el.scrollLeft > 4); setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4); }, []);
  const scroll = (d: 'left' | 'right') => { scrollRef.current?.scrollBy({ left: d === 'left' ? -320 : 320, behavior: 'smooth' }); setTimeout(updateScroll, 350); };
  const ml = (n: any) => typeof n === 'object' ? (n?.en ?? n?.fr ?? Object.values(n)[0]) : n;
  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton className="mb-4 h-6 w-48" /><div className="flex gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-72 shrink-0 rounded-xl" />)}</div></div>;
  if (!campaigns.length) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Campaign Overview</h3><p className="py-8 text-center text-sm text-gray-400">No campaign data yet</p></div>;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Campaign Overview</h3><p className="mt-0.5 text-xs text-gray-400">{campaigns.length} campaigns</p></div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={scrollRef} onScroll={updateScroll} className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {campaigns.map((c: any, i: number) => {
          const p = c.targetSubmissions > 0 ? Math.min(100, Math.round(((c.totalSubmissions ?? 0) / c.targetSubmissions) * 100)) : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <Link key={c.id} href={`/collecte/campaigns/${c.id}`} className="group relative w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}><Activity className="h-5 w-5" /></div><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{c.status}</span></div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-700 dark:text-white">{ml(c.name)}</h4>
              <div className="mt-3 flex items-end justify-between"><div><p className="text-2xl font-bold text-gray-900 dark:text-white">{(c.totalSubmissions ?? 0).toLocaleString()}</p><p className="text-[10px] text-gray-400">{c.targetSubmissions ? `/ ${c.targetSubmissions}` : 'submissions'}</p></div><div className="text-right"><p className="text-lg font-bold" style={{ color }}>{p}%</p><p className="text-[10px] text-gray-400">complete</p></div></div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: color }} /></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function GovCatalog() {
  const { data, isLoading } = useFormBuilderTemplates({ domain: 'governance', limit: 20, status: 'PUBLISHED' });
  const allT: any[] = data?.data ?? [];
  const latest = new Map<string, any>();
  for (const t of allT) { const e = latest.get(t.name); if (!e || (t.version ?? 0) > (e.version ?? 0)) latest.set(t.name, t); }
  const templates = Array.from(latest.values());
  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton className="mb-4 h-6 w-60" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></div>;
  if (!templates.length) return null;
  const CM: Record<string, string> = { 'Legal Framework Assessment': '#4527A0', 'Veterinary Services Evaluation Report': '#1565C0', 'Stakeholder Registry': '#00695C', 'Capacity Building Report': '#2E7D32', 'Governance Event Alert': '#C62828' };
  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 dark:border-indigo-800 dark:from-indigo-950/30 dark:to-gray-800">
      <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white"><Landmark className="h-5 w-5" /></div><div><h3 className="text-lg font-bold text-gray-900 dark:text-white">Governance — Data Collection Forms</h3><p className="text-xs text-gray-500">{templates.length} published templates</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tmpl: any) => { const color = CM[tmpl.name] ?? '#607D8B'; return (
          <div key={tmpl.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{tmpl.formType === 'EVENT_ALERT' ? 'Event Alert' : 'Campaign'}</span>
            <p className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2 dark:text-white">{tmpl.name}</p>
            <div className="mt-3"><Link href={`/collecte/forms/${tmpl.id}/fill?returnTo=/governance`} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90" style={{ backgroundColor: color }}><Plus className="h-3 w-3" /> Fill</Link></div>
          </div>
        ); })}
      </div>
    </div>
  );
}

const SEV: Record<string, { bg: string; text: string; dot: string }> = { low: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }, medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' }, high: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' }, critical: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' } };
function RecentEventsCard({ templateId }: { templateId: string }) {
  const { data, isLoading } = useFormSubmissions(templateId, { page: 1, limit: 6, status: 'SUBMITTED' });
  const submissions: any[] = data?.data ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-indigo-600" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Events</h3></div><Link href={`/collecte/forms/${templateId}/fill?returnTo=/governance`} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"><Plus className="h-3 w-3" /> Report</Link></div>
      {isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> : !submissions.length ? (
        <div className="flex flex-col items-center py-8 text-center"><Landmark className="h-10 w-10 text-gray-200" /><p className="mt-3 text-sm text-gray-400">No governance events reported yet</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{submissions.map((sub: any) => { const d = sub.data ?? {}; const sev = SEV[d.severity] ?? SEV.low; return (
          <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"><div className="absolute inset-x-0 top-0 h-1 bg-indigo-600" /><div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', sev.dot)} /><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', sev.bg, sev.text)}>{d.severity ?? '—'}</span></div><p className="mt-2 text-sm font-medium text-gray-900 line-clamp-2 dark:text-white">{d.description?.slice(0, 80) ?? '—'}</p>{d.date_event && <p className="mt-2 flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{new Date(d.date_event).toLocaleDateString()}</p>}</div>
        ); })}</div>
      )}
    </div>
  );
}
