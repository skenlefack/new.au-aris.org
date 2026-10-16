'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, MoreHorizontal, Send, Check, X, Ban } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useHubAgreements,
  useProposeHubAgreement,
  useAcceptHubAgreement,
  useRejectHubAgreement,
  useRevokeHubAgreement,
  type HubAgreementStatus,
  type HubDirection,
} from '@/lib/api/hub-hooks';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PROPOSED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  REVOKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

const STATUSES: HubAgreementStatus[] = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'];

export default function AgreementsListPage() {
  const t = useTranslations('interopHub');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useHubAgreements({
    status: (status as HubAgreementStatus) || undefined,
    page,
    limit,
  });

  const agreements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const proposeMut = useProposeHubAgreement();
  const acceptMut = useAcceptHubAgreement();
  const rejectMut = useRejectHubAgreement();
  const revokeMut = useRevokeHubAgreement();

  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('agreements.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agreements.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('filter.status')}</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filter.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('col.title')}</th>
                <th className="px-4 py-3 font-medium">{t('col.partner')}</th>
                <th className="px-4 py-3 font-medium">{t('col.direction')}</th>
                <th className="px-4 py-3 font-medium">{t('col.domains')}</th>
                <th className="px-4 py-3 font-medium">{t('col.status')}</th>
                <th className="px-4 py-3 font-medium">{t('col.validUntil')}</th>
                <th className="px-4 py-3 font-medium">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : agreements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">{t('agreements.empty')}</td>
                </tr>
              ) : (
                agreements.map((ag) => (
                  <tr key={ag.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/interop-hub/agreements/${ag.id}`} className="font-medium text-primary hover:underline">
                        {ag.name}
                      </Link>
                      {ag.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" style={{ maxWidth: 240 }}>
                          {ag.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{ag.partnerTenantId?.slice(0, 8) ?? '-'}</td>
                    <td className="px-4 py-3 text-xs">{t(`direction.${ag.direction}`)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ag.domains.slice(0, 3).map((d) => (
                          <span key={d} className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px]">{d}</span>
                        ))}
                        {ag.domains.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{ag.domains.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[ag.status] ?? 'bg-gray-100'}`}>
                        {ag.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {ag.validTo ? new Date(ag.validTo).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpen(menuOpen === ag.id ? null : ag.id)}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === ag.id && (
                          <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border bg-popover py-1 shadow-md">
                            <Link
                              href={`/interop-hub/agreements/${ag.id}`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => setMenuOpen(null)}
                            >
                              {t('actions.edit')}
                            </Link>
                            {ag.status === 'DRAFT' && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => { proposeMut.mutate(ag.id); setMenuOpen(null); }}
                              >
                                <Send className="h-3.5 w-3.5" /> {t('actions.propose')}
                              </button>
                            )}
                            {ag.status === 'PROPOSED' && (
                              <>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                  onClick={() => { acceptMut.mutate(ag.id); setMenuOpen(null); }}
                                >
                                  <Check className="h-3.5 w-3.5" /> {t('actions.accept')}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                                  onClick={() => { rejectMut.mutate({ id: ag.id }); setMenuOpen(null); }}
                                >
                                  <X className="h-3.5 w-3.5" /> {t('actions.reject')}
                                </button>
                              </>
                            )}
                            {['ACTIVE', 'ACCEPTED'].includes(ag.status) && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                                onClick={() => {
                                  const reason = prompt(t('agreements.revokeReason'));
                                  if (reason) revokeMut.mutate({ id: ag.id, reason });
                                  setMenuOpen(null);
                                }}
                              >
                                <Ban className="h-3.5 w-3.5" /> {t('actions.revoke')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t('pagination.showing', { from: String((page - 1) * limit + 1), to: String(Math.min(page * limit, total)), total: String(total) })}
            </p>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.prev')}</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t('pagination.next')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
