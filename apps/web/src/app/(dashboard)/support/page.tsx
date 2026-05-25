'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  LifeBuoy,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  useSupportTickets,
  useSlaStats,
  statusBadgeClasses,
  priorityBadgeClasses,
  categoryBadgeClasses,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketFilters,
} from '@/lib/api/support-hooks';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'];

export default function SupportListPage() {
  const t = useTranslations('support');
  const tCommon = useTranslations('common');
  const formatDate = useFormattedDate();
  const { user } = useAuthStore();
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);

  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const filters: TicketFilters = useMemo(
    () => ({
      page,
      limit,
      status: status || undefined,
      category: category || undefined,
      priority: priority || undefined,
    }),
    [page, status, category, priority],
  );

  const { data, isLoading, isError } = useSupportTickets(filters);
  const tickets = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // SLA stats for admins
  const { data: slaData } = useSlaStats('30d');
  const sla = slaData?.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/support/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t('newTicket')}
        </Link>
      </div>

      {/* SLA Stats Cards (admins only) */}
      {isAdmin && sla && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LifeBuoy className="h-4 w-4" />
              {t('slaTotal')}
            </div>
            <p className="mt-1 text-2xl font-bold">{sla.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t('slaResolved')}
            </div>
            <p className="mt-1 text-2xl font-bold">{sla.resolved}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              {t('slaCompliance')}
            </div>
            <p className="mt-1 text-2xl font-bold">{sla.slaComplianceRate}%</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-yellow-600" />
              {t('slaAvgResolution')}
            </div>
            <p className="mt-1 text-2xl font-bold">{sla.avgResolutionHours}h</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('filterStatus')}
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as TicketStatus | ''); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filterAll')}</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('filterCategory')}
          </label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value as TicketCategory | ''); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filterAll')}</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`category.${c.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('filterPriority')}
          </label>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value as TicketPriority | ''); setPage(1); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('filterAll')}</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>{t(`priority.${p.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-destructive">{tCommon('retry')}</div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <LifeBuoy className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t('emptyTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
            </div>
            <Link
              href="/support/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> {t('newTicket')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('columnRef')}</th>
                  <th className="px-4 py-3">{t('columnTitle')}</th>
                  <th className="px-4 py-3">{t('columnCategory')}</th>
                  <th className="px-4 py-3">{t('columnStatus')}</th>
                  <th className="px-4 py-3">{t('columnPriority')}</th>
                  <th className="px-4 py-3">{t('columnSla')}</th>
                  <th className="px-4 py-3">{t('columnCreatedAt')}</th>
                  <th className="px-4 py-3 text-right">{t('columnActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{ticket.reference}</td>
                    <td className="px-4 py-3 font-medium max-w-[250px] truncate">{ticket.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClasses(ticket.category)}`}>
                        {t(`category.${ticket.category.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(ticket.status)}`}>
                        {t(`status.${ticket.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClasses(ticket.priority)}`}>
                        {t(`priority.${ticket.priority.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.sla_breached ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {t('slaBreached')}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">{t('slaOnTrack')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/support/${ticket.id}`}
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
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              {tCommon('previous')}
            </button>
            <button
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
