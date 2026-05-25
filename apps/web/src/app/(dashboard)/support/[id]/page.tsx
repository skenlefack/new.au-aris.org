'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  Shield,
} from 'lucide-react';
import {
  useSupportTicket,
  useTicketComments,
  useUpdateTicket,
  useAddComment,
  statusBadgeClasses,
  priorityBadgeClasses,
  categoryBadgeClasses,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  type TicketStatus,
  type TicketPriority,
} from '@/lib/api/support-hooks';
import { useTranslations, useFormattedDate } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'];

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const t = useTranslations('support');
  const tCommon = useTranslations('common');
  const formatDate = useFormattedDate();
  const { user } = useAuthStore();
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);

  const { data, isLoading, isError } = useSupportTicket(id);
  const ticket = data?.data;

  const { data: commentsData } = useTicketComments(id);
  const comments = commentsData?.data ?? [];

  const updateMutation = useUpdateTicket();
  const addCommentMutation = useAddComment();

  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [tab, setTab] = useState<'details' | 'comments'>('details');

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="p-6">
        <Link href="/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
        </Link>
        <div className="mt-8 text-center text-sm text-destructive">{t('errors.notFound')}</div>
      </div>
    );
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    await updateMutation.mutateAsync({ id: ticket!.id, status: newStatus });
  }

  async function handlePriorityChange(newPriority: TicketPriority) {
    await updateMutation.mutateAsync({ id: ticket!.id, priority: newPriority });
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await addCommentMutation.mutateAsync({
      ticketId: ticket!.id,
      content: commentText.trim(),
      isInternal,
    });
    setCommentText('');
  }

  const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon('back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{ticket.reference}</span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(ticket.status)}`}>
              {t(`status.${ticket.status.toLowerCase()}`)}
            </span>
            {ticket.sla_breached && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                {t('slaBreached')}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
        </div>

        {/* Admin actions */}
        {isAdmin && !isClosed && (
          <div className="flex flex-wrap gap-2">
            {ticket.status === 'OPEN' && (
              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {t('actions.startProgress')}
              </button>
            )}
            {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' || ticket.status === 'ESCALATED') && (
              <button
                onClick={() => handleStatusChange('RESOLVED')}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t('actions.resolve')}
              </button>
            )}
            {ticket.status === 'RESOLVED' && (
              <button
                onClick={() => handleStatusChange('CLOSED')}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {t('actions.close')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('details')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'details'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('tabDetails')}
        </button>
        <button
          onClick={() => setTab('comments')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'comments'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('tabComments')} ({comments.length})
        </button>
      </div>

      {tab === 'details' ? (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main info */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{t('detailDescription')}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
            </div>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <InfoRow label={t('detailCategory')}>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClasses(ticket.category)}`}>
                  {t(`category.${ticket.category.toLowerCase()}`)}
                </span>
              </InfoRow>

              <InfoRow label={t('detailPriority')}>
                {isAdmin && !isClosed ? (
                  <select
                    value={ticket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{t(`priority.${p.toLowerCase()}`)}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClasses(ticket.priority)}`}>
                    {t(`priority.${ticket.priority.toLowerCase()}`)}
                  </span>
                )}
              </InfoRow>

              <InfoRow label={t('detailCreatedAt')}>
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {formatDate(ticket.created_at)}
                </span>
              </InfoRow>

              <InfoRow label={t('detailCreatedBy')}>
                <span className="flex items-center gap-1 text-xs">
                  <User className="h-3 w-3" />
                  {ticket.created_by.slice(0, 8)}...
                </span>
              </InfoRow>

              {ticket.sla_deadline && (
                <InfoRow label={t('detailSlaDeadline')}>
                  <span className={`text-xs ${ticket.sla_breached ? 'text-red-600 font-medium' : ''}`}>
                    {formatDate(ticket.sla_deadline)}
                  </span>
                </InfoRow>
              )}

              {ticket.resolved_at && (
                <InfoRow label={t('detailResolvedAt')}>
                  <span className="text-xs">{formatDate(ticket.resolved_at)}</span>
                </InfoRow>
              )}

              {ticket.closed_at && (
                <InfoRow label={t('detailClosedAt')}>
                  <span className="text-xs">{formatDate(ticket.closed_at)}</span>
                </InfoRow>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Comments tab */
        <div className="space-y-4">
          {/* Comment list */}
          {comments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noComments')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-4 ${
                    comment.is_internal
                      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-950/20'
                      : 'bg-card'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {comment.created_by.slice(0, 8)}...
                      {comment.is_internal && (
                        <span className="inline-flex items-center gap-1 rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300">
                          <Shield className="h-2.5 w-2.5" />
                          {t('internalNote')}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {!isClosed && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder={t('commentPlaceholder')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                {isAdmin && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <Shield className="h-3 w-3" />
                    {t('markInternal')}
                  </label>
                )}
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {t('sendComment')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
