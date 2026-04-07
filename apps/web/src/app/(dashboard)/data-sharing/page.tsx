'use client';

// Data Sharing — list of bilateral agreements with Sent / Received / All tabs.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Share2, Eye, Inbox } from 'lucide-react';
import {
  useDataShareAgreements,
  SHARE_STATUSES,
  DATA_DOMAINS,
  statusBadgeClasses,
  type ShareStatus,
  type AgreementFilters,
} from '@/lib/api/data-sharing';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';

type RoleTab = 'sent' | 'received' | 'all';

const PRIVILEGED_ROLES = new Set(['CONTINENTAL_ADMIN', 'SUPER_ADMIN']);

export default function DataSharingListPage() {
  const t = useTranslations('dataSharing');
  const tCommon = useTranslations('common');
  const user = useAuthStore((s) => s.user);
  const formatDate = useFormattedDate();

  const canSeeAll = !!user && PRIVILEGED_ROLES.has(user.role);
  const [tab, setTab] = useState<RoleTab>('sent');
  const [status, setStatus] = useState<ShareStatus | ''>('');
  const [domain, setDomain] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const filters: AgreementFilters = useMemo(
    () => ({ role: tab, status: status || undefined, dataDomain: domain || undefined, page, limit }),
    [tab, status, domain, page],
  );
  const { data, isLoading, isError } = useDataShareAgreements(filters);
  const agreements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const tabs: { key: RoleTab; label: string }[] = [
    { key: 'sent', label: t('tabSent') },
    { key: 'received', label: t('tabReceived') },
    ...(canSeeAll ? [{ key: 'all' as RoleTab, label: t('tabAll') }] : []),
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeAll && (
            <Link
              href="/data-sharing/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            >
              <Eye className="h-4 w-4" /> {t('dashboard.title')}
            </Link>
          )}
          <Link
            href="/data-sharing/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t('newAgreement')}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => {
              setTab(x.key);
              setPage(1);
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === x.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('filterStatus')}
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ShareStatus | '');
              setPage(1);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filterAll')}</option>
            {SHARE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('filterDomain')}
          </label>
          <select
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filterAll')}</option>
            {DATA_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / states */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-destructive">
            {tCommon('retry')}
          </div>
        ) : agreements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t('emptyTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
            </div>
            <Link
              href="/data-sharing/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> {t('newAgreement')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('columnReference')}</th>
                  <th className="px-4 py-3">{t('columnTitle')}</th>
                  <th className="px-4 py-3">{t('columnParties')}</th>
                  <th className="px-4 py-3">{t('columnDomain')}</th>
                  <th className="px-4 py-3">{t('columnStatus')}</th>
                  <th className="px-4 py-3">{t('columnValidity')}</th>
                  <th className="px-4 py-3 text-right">{t('columnActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agreements.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{a.reference}</td>
                    <td className="px-4 py-3 font-medium">{a.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="font-mono">{a.ownerTenantId.slice(0, 8)}</span>
                      <span className="mx-1">→</span>
                      <span className="font-mono">{a.recipientTenantId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{a.dataDomain}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(a.status)}`}
                      >
                        {t(`status.${a.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(a.validFrom)}
                      {a.validUntil && ` → ${formatDate(a.validUntil)}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/data-sharing/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {agreements.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              {tCommon('previous')}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              {tCommon('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
