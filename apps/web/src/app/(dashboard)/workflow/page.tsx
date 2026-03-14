'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useMyWorkflowTasks,
  useMyWorkflowSubmissions,
  useWorkflowStats,
} from '@/lib/api/workflow-hooks';

/* ── Status & Priority styling ── */

const STATUS_STYLE: Record<string, { bg: string; text: string; tKey: string }> = {
  IN_PROGRESS: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', tKey: 'inProgress' },
  COMPLETED: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', tKey: 'completed' },
  REJECTED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', tKey: 'rejected' },
  RETURNED: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', tKey: 'returned' },
  EXPIRED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', tKey: 'expired' },
  CANCELLED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-500', tKey: 'cancelled' },
};

const PRIORITY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  URGENT: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  HIGH: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  NORMAL: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  LOW: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-400' },
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('workflow');
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['IN_PROGRESS'];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.bg, s.text)}>
      {t(s.tKey)}
    </span>
  );
}

const PRIORITY_TKEY: Record<string, string> = {
  CRITICAL: 'priorityCritical',
  URGENT: 'priorityUrgent',
  HIGH: 'priorityHigh',
  NORMAL: 'priorityNormal',
  LOW: 'priorityLow',
};

function PriorityBadge({ priority }: { priority: string }) {
  const t = useTranslations('workflow');
  const p = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE['NORMAL'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', p.bg, p.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />
      {t(PRIORITY_TKEY[priority] ?? 'priorityNormal')}
    </span>
  );
}

function deadlineColor(deadline: string | null): string {
  if (!deadline) return 'text-gray-500 dark:text-gray-400';
  const remaining = new Date(deadline).getTime() - Date.now();
  const hours = remaining / (1000 * 60 * 60);
  if (hours < 0) return 'text-red-600 dark:text-red-400 font-semibold';
  if (hours < 24) return 'text-red-500 dark:text-red-400';
  if (hours < 48) return 'text-orange-500 dark:text-orange-400';
  return 'text-gray-600 dark:text-gray-400';
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '—';
  const d = new Date(deadline);
  const remaining = d.getTime() - Date.now();
  const hours = Math.round(remaining / (1000 * 60 * 60));
  if (hours < 0) return `${Math.abs(hours)}h overdue`;
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.round(hours / 24);
  return `${days}d remaining`;
}

function i18nText(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj['en'] ?? obj['fr'] ?? Object.values(obj)[0] ?? '—';
  }
  return String(val);
}

/* ── Loading skeleton ── */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

/* ── Main Page ── */
export default function WorkflowDashboardPage() {
  const t = useTranslations('workflow');
  const [activeTab, setActiveTab] = useState<'tasks' | 'submissions'>('tasks');
  const [taskPage, setTaskPage] = useState(1);
  const [subPage, setSubPage] = useState(1);

  const { data: statsRes, isLoading: statsLoading } = useWorkflowStats();
  const { data: tasksRes, isLoading: tasksLoading } = useMyWorkflowTasks({ page: taskPage, limit: 20 });
  const { data: subsRes, isLoading: subsLoading } = useMyWorkflowSubmissions({ page: subPage, limit: 20 });

  const stats = statsRes?.data;
  const tasks = tasksRes?.data ?? [];
  const tasksMeta = tasksRes?.meta;
  const subs = subsRes?.data ?? [];
  const subsMeta = subsRes?.meta;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('dashboardSubtitle')}
        </p>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={<Inbox className="h-5 w-5 text-blue-600" />}
            label={t('pendingValidation')}
            value={stats?.pendingValidation ?? 0}
            bg="bg-blue-50 dark:bg-blue-900/20"
            accent="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            label={t('validatedToday')}
            value={stats?.validatedToday ?? 0}
            bg="bg-green-50 dark:bg-green-900/20"
            accent="text-green-600 dark:text-green-400"
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label={t('overdue')}
            value={stats?.overdue ?? 0}
            bg="bg-red-50 dark:bg-red-900/20"
            accent={cn(
              'text-red-600 dark:text-red-400',
              (stats?.overdue ?? 0) > 0 && 'font-bold',
            )}
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
            label={t('completionRate')}
            value={`${stats?.completionRate ?? 0}%`}
            bg="bg-purple-50 dark:bg-purple-900/20"
            accent="text-purple-600 dark:text-purple-400"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'tasks'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            {t('awaitingValidation')}
            {(stats?.pendingValidation ?? 0) > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs text-white">
                {stats?.pendingValidation}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'submissions'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            {t('mySubmissions')}
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'tasks' ? (
            tasksLoading ? (
              <TableSkeleton />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                title={t('noPendingTasks')}
                description={t('noPendingTasksDesc')}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <th className="px-3 py-2">{t('submission')}</th>
                        <th className="px-3 py-2">{t('country')}</th>
                        <th className="px-3 py-2">{t('step')}</th>
                        <th className="px-3 py-2">{t('priority')}</th>
                        <th className="px-3 py-2">{t('deadline')}</th>
                        <th className="px-3 py-2">{t('status')}</th>
                        <th className="px-3 py-2 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {tasks.map((task: any) => {
                        const step = task.workflow?.steps?.find(
                          (s: any) => s.stepOrder === task.currentStepOrder,
                        );
                        return (
                          <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-3">
                              <span className="font-mono text-xs text-gray-500">
                                {task.submissionId?.slice(0, 8)}...
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {i18nText(task.workflow?.country?.name)}
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {i18nText(step?.name) ?? `${t('step')} ${task.currentStepOrder}`}
                            </td>
                            <td className="px-3 py-3">
                              <PriorityBadge priority={task.priority} />
                            </td>
                            <td className={cn('px-3 py-3 text-xs', deadlineColor(task.currentDeadline))}>
                              {formatDeadline(task.currentDeadline)}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={task.status} />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Link
                                href={`/workflow/${task.id}`}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t('view')}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={taskPage}
                  total={tasksMeta?.total ?? 0}
                  limit={20}
                  onPageChange={setTaskPage}
                />
              </>
            )
          ) : subsLoading ? (
            <TableSkeleton />
          ) : subs.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
              title={t('noSubmissions')}
              description={t('noSubmissionsDesc')}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">{t('submission')}</th>
                      <th className="px-3 py-2">{t('date')}</th>
                      <th className="px-3 py-2">{t('currentStep')}</th>
                      <th className="px-3 py-2">{t('status')}</th>
                      <th className="px-3 py-2">{t('progressLabel')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {subs.map((sub: any) => {
                      const steps = sub.workflow?.steps ?? [];
                      const totalSteps = steps.length;
                      const currentStep = steps.find(
                        (s: any) => s.stepOrder === sub.currentStepOrder,
                      );
                      const progress = totalSteps > 1
                        ? Math.round((sub.currentStepOrder / (totalSteps - 1)) * 100)
                        : sub.status === 'COMPLETED' ? 100 : 0;

                      return (
                        <tr
                          key={sub.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          onClick={() => window.location.href = `/workflow/${sub.id}`}
                        >
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs text-gray-500">
                              {sub.submissionId?.slice(0, 8)}...
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {formatDate(sub.submittedAt)}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {i18nText(currentStep?.name) ?? `${t('step')} ${sub.currentStepOrder}`}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                                <div
                                  className={cn(
                                    'h-2 rounded-full transition-all',
                                    sub.status === 'COMPLETED'
                                      ? 'bg-green-500'
                                      : sub.status === 'REJECTED'
                                        ? 'bg-red-500'
                                        : 'bg-blue-500',
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{progress}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={subPage}
                total={subsMeta?.total ?? 0}
                limit={20}
                onPageChange={setSubPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Components ── */

function KpiCard({
  icon,
  label,
  value,
  bg,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
  accent: string;
}) {
  return (
    <div className={cn('rounded-xl p-4', bg)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/60 dark:bg-gray-800/60">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={cn('text-2xl font-bold', accent)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {icon}
      <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function Pagination({
  page,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  const t = useTranslations('workflow');
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('showing')} {(page - 1) * limit + 1}–{Math.min(page * limit, total)} {t('of')} {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
