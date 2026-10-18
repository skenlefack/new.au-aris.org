'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, Check, X, Ban, FileText, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  Clock,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubAgreement,
  useHubTransactions,
  useProposeHubAgreement,
  useAcceptHubAgreement,
  useRejectHubAgreement,
  useRevokeHubAgreement,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_CFG: Record<string, { dot: string; bg: string; text: string }> = {
  DRAFT: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600' },
  PROPOSED: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300' },
  ACCEPTED: { dot: 'bg-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300' },
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
  SUSPENDED: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300' },
  REVOKED: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300' },
  EXPIRED: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-500' },
};

const TX_DOT: Record<string, string> = {
  COMPLETED: 'bg-emerald-500', FAILED: 'bg-red-500', IN_PROGRESS: 'bg-blue-500', PENDING: 'bg-gray-400',
};

const TIMELINE_EVENTS = [
  { key: 'proposedAt', label: 'Proposed', icon: Send },
  { key: 'acceptedAt', label: 'Accepted', icon: Check },
  { key: 'revokedAt', label: 'Revoked', icon: Ban },
] as const;

/* ── Page ─────────────────────────────────────────────────────── */

export default function AgreementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations('interopHub');

  const { data: agData, isLoading } = useHubAgreement(id);
  const ag = agData?.data;

  const { data: txData } = useHubTransactions({ limit: 20 });
  const transactions = txData?.data ?? [];

  const proposeMut = useProposeHubAgreement();
  const acceptMut = useAcceptHubAgreement();
  const rejectMut = useRejectHubAgreement();
  const revokeMut = useRevokeHubAgreement();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-40 animate-pulse rounded-xl bg-card/50 border border-border/50" />
        <div className="h-64 animate-pulse rounded-xl bg-card/50 border border-border/50" />
      </div>
    );
  }

  if (!ag) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t('agreements.notFound')}</p>
      </div>
    );
  }

  const stCfg = STATUS_CFG[ag.status] ?? STATUS_CFG.DRAFT;

  // SLA compliance (mock from terms)
  const slaTarget = (ag.terms as any)?.slaTarget ?? 95;
  const completedTx = transactions.filter((tx) => tx.status === 'COMPLETED').length;
  const slaActual = transactions.length > 0 ? Math.round((completedTx / transactions.length) * 100) : 100;

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/interop-hub/agreements')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('agreements.title')}
      </button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ag.name}</h1>
            {ag.description && <p className="mt-1 text-sm text-muted-foreground">{ag.description}</p>}
            <div className="mt-2 flex items-center gap-3">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', stCfg.bg, stCfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', stCfg.dot)} />
                {ag.status}
              </span>
              <span className="text-xs text-muted-foreground">{t(`direction.${ag.direction}`)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ag.status === 'DRAFT' && (
              <button type="button" onClick={() => proposeMut.mutate(id)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5">
                <Send className="h-3.5 w-3.5" /> {t('actions.propose')}
              </button>
            )}
            {ag.status === 'PROPOSED' && (
              <>
                <button type="button" onClick={() => acceptMut.mutate(id)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5">
                  <Check className="h-3.5 w-3.5" /> {t('actions.accept')}
                </button>
                <button type="button" onClick={() => rejectMut.mutate({ id })} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-red-500/25 transition-all hover:-translate-y-0.5">
                  <X className="h-3.5 w-3.5" /> {t('actions.reject')}
                </button>
              </>
            )}
            {['ACTIVE', 'ACCEPTED'].includes(ag.status) && (
              <button type="button" onClick={() => { const reason = prompt(t('agreements.revokeReason')); if (reason) revokeMut.mutate({ id, reason }); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-950/20">
                <Ban className="h-3.5 w-3.5" /> {t('actions.revoke')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agreement document-style card */}
        <div className="lg:col-span-2 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 space-y-5">
          <h3 className="text-sm font-semibold">{t('detail.info')}</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label={t('col.direction')} value={t(`direction.${ag.direction}`)} />
            <InfoRow label={t('col.partner')} value={ag.partnerTenantId ?? '-'} />
            <InfoRow label={t('col.dataClassification')} value={ag.dataClassification ?? '-'} />
            <InfoRow label={t('col.validFrom')} value={ag.validFrom ? new Date(ag.validFrom).toLocaleDateString() : '-'} />
            <InfoRow label={t('col.validUntil')} value={ag.validTo ? new Date(ag.validTo).toLocaleDateString() : '-'} />
            <InfoRow label={t('col.proposedAt')} value={ag.proposedAt ? new Date(ag.proposedAt).toLocaleDateString() : '-'} />
            {ag.acceptedAt && <InfoRow label={t('col.acceptedAt')} value={new Date(ag.acceptedAt).toLocaleDateString()} />}
          </dl>

          {/* Domains */}
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t('col.domains')}</h4>
            <div className="flex flex-wrap gap-2">
              {ag.domains.map((d) => (
                <span key={d} className="inline-flex rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* SLA terms */}
          {ag.terms && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t('agreement.slaTerms')}</h4>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 border border-border/30 p-3 text-xs font-mono">
                {JSON.stringify(ag.terms, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right column: SLA gauge + timeline */}
        <div className="space-y-5">
          {/* SLA compliance gauge */}
          <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
            <h3 className="mb-3 text-sm font-semibold">SLA Compliance</h3>
            <div className="flex flex-col items-center">
              <div className="relative h-28 w-28">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    strokeWidth="8" strokeLinecap="round"
                    className={cn(slaActual >= slaTarget ? 'text-emerald-500' : 'text-amber-500')}
                    strokeDasharray={`${(slaActual / 100) * 251.2} 251.2`}
                    stroke="currentColor"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{slaActual}%</span>
                  <span className="text-[10px] text-muted-foreground">Target: {slaTarget}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline of status changes */}
          <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <div className="relative ml-3">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/50" />
              <TimelineItem icon={Clock} label="Created" date={ag.createdAt} />
              {ag.proposedAt && <TimelineItem icon={Send} label="Proposed" date={ag.proposedAt} />}
              {ag.acceptedAt && <TimelineItem icon={Check} label="Accepted" date={ag.acceptedAt} />}
              {ag.revokedAt && <TimelineItem icon={Ban} label="Revoked" date={ag.revokedAt} reason={ag.revokeReason} />}
            </div>
          </div>
        </div>
      </div>

      {/* Related transactions */}
      <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5">
        <h3 className="mb-4 text-sm font-semibold">{t('agreement.relatedTx')}</h3>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t('transactions.empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx) => (
              <Link
                key={tx.id}
                href={`/interop-hub/transactions/${tx.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span className={cn('h-2 w-2 rounded-full', TX_DOT[tx.status] ?? 'bg-gray-400')} />
                <span className="font-mono text-xs">{tx.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">{tx.direction}</span>
                <span className="text-xs text-muted-foreground">{tx.domain}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function TimelineItem({ icon: Icon, label, date, reason }: {
  icon: React.ElementType; label: string; date: string; reason?: string | null;
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(date).toLocaleString()}</p>
        {reason && <p className="mt-0.5 text-[10px] text-red-500">Reason: {reason}</p>}
      </div>
    </div>
  );
}
