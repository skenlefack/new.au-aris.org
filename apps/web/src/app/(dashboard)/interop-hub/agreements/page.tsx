'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText, Send, Check, X, Ban, ArrowRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useHubAgreements,
  useProposeHubAgreement,
  useAcceptHubAgreement,
  useRejectHubAgreement,
  useRevokeHubAgreement,
  type HubAgreementStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

/* ── Constants ────────────────────────────────────────────────── */

const STATUS_CFG: Record<string, { dot: string; bg: string; text: string; step: number }> = {
  DRAFT: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600', step: 0 },
  PROPOSED: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', step: 1 },
  ACCEPTED: { dot: 'bg-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300', step: 2 },
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', step: 3 },
  SUSPENDED: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', step: -1 },
  REVOKED: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', step: -1 },
  EXPIRED: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-500', step: -1 },
};

const PROGRESS_STEPS = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'ACTIVE'];
const STATUSES: HubAgreementStatus[] = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'];

const DIR_ICON: Record<string, React.ElementType> = {
  INBOUND: ArrowDownLeft, OUTBOUND: ArrowUpRight, BIDIRECTIONAL: ArrowLeftRight,
};

/* ── Page ─────────────────────────────────────────────────────── */

export default function AgreementsListPage() {
  const t = useTranslations('interopHub');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubAgreements({
    status: (status as HubAgreementStatus) || undefined,
    page, limit,
  });

  const agreements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const proposeMut = useProposeHubAgreement();
  const acceptMut = useAcceptHubAgreement();
  const rejectMut = useRejectHubAgreement();
  const revokeMut = useRevokeHubAgreement();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('agreements.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('agreements.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">{t('filter.status')}:</span>
        <FilterPill label={t('filter.all')} active={!status} onClick={() => { setStatus(''); setPage(1); }} />
        {STATUSES.map((s) => (
          <FilterPill
            key={s}
            label={s}
            active={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            dot={(STATUS_CFG[s] ?? STATUS_CFG.DRAFT).dot}
          />
        ))}
      </div>

      {/* Agreement cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-card/50 border border-border/50" />
          ))}
        </div>
      ) : agreements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t('agreements.empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {agreements.map((ag) => {
              const stCfg = STATUS_CFG[ag.status] ?? STATUS_CFG.DRAFT;
              const DirI = DIR_ICON[ag.direction] ?? ArrowLeftRight;
              const daysLeft = ag.validTo ? Math.ceil((new Date(ag.validTo).getTime() - Date.now()) / 86400000) : null;
              const expiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

              return (
                <div
                  key={ag.id}
                  className="rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Partner + direction */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                      <DirI className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/interop-hub/agreements/${ag.id}`} className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                        {ag.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Partner: {ag.partnerTenantId?.slice(0, 8) ?? '-'}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', stCfg.bg, stCfg.text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', stCfg.dot)} />
                      {ag.status}
                    </span>
                  </div>

                  {/* Domain chips */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ag.domains.map((d) => (
                      <span key={d} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Progress bar DRAFT -> PROPOSED -> ACCEPTED -> ACTIVE */}
                  {stCfg.step >= 0 && (
                    <div className="mt-4 flex items-center gap-1">
                      {PROGRESS_STEPS.map((ps, i) => (
                        <div key={ps} className="flex items-center gap-1 flex-1">
                          <div className={cn(
                            'h-1 flex-1 rounded-full transition-all',
                            i <= stCfg.step ? 'bg-emerald-500' : 'bg-muted'
                          )} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: valid until + actions */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {ag.validTo ? (
                        <span className={cn(expiring && 'text-amber-600 font-medium')}>
                          {expiring && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                          Until {new Date(ag.validTo).toLocaleDateString()}
                          {expiring && ` (${daysLeft}d)`}
                        </span>
                      ) : '-'}
                    </div>
                    <div className="flex gap-1">
                      {ag.status === 'DRAFT' && (
                        <ActionBtn icon={Send} label={t('actions.propose')} onClick={() => proposeMut.mutate(ag.id)} className="text-primary" />
                      )}
                      {ag.status === 'PROPOSED' && (
                        <>
                          <ActionBtn icon={Check} label={t('actions.accept')} onClick={() => acceptMut.mutate(ag.id)} className="text-emerald-600" />
                          <ActionBtn icon={X} label={t('actions.reject')} onClick={() => rejectMut.mutate({ id: ag.id })} className="text-red-600" />
                        </>
                      )}
                      {['ACTIVE', 'ACCEPTED'].includes(ag.status) && (
                        <ActionBtn
                          icon={Ban}
                          label={t('actions.revoke')}
                          onClick={() => { const reason = prompt(t('agreements.revokeReason')); if (reason) revokeMut.mutate({ id: ag.id, reason }); }}
                          className="text-destructive"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
              </p>
              <div className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.prev')}</button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent disabled:opacity-40">{t('pagination.next')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function FilterPill({ label, active, onClick, dot }: {
  label: string; active: boolean; onClick: () => void; dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card/50 border border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, className }: {
  icon: React.ElementType; label: string; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all hover:bg-accent', className)}
    >
      <Icon className="h-3 w-3" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
