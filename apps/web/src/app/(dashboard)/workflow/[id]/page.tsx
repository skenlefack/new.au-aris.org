'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  Send,
  MessageSquare,
  Zap,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useWorkflowTimeline,
  useValidateInstance,
  useRejectInstance,
  useReturnInstance,
  useCommentInstance,
} from '@/lib/api/workflow-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

/* ── Action icons ── */
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; tKey: string }> = {
  submitted: { icon: <Send className="h-4 w-4" />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40', tKey: 'actionSubmitted' },
  validated: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600 bg-green-100 dark:bg-green-900/40', tKey: 'actionValidated' },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600 bg-red-100 dark:bg-red-900/40', tKey: 'actionRejected' },
  returned: { icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40', tKey: 'actionReturned' },
  auto_transmitted: { icon: <Timer className="h-4 w-4" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40', tKey: 'actionAutoTransmitted' },
  auto_validated: { icon: <Timer className="h-4 w-4" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40', tKey: 'actionAutoValidated' },
  escalated: { icon: <Zap className="h-4 w-4" />, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40', tKey: 'actionEscalated' },
  commented: { icon: <MessageSquare className="h-4 w-4" />, color: 'text-gray-600 bg-gray-100 dark:bg-gray-800', tKey: 'actionComment' },
  reassigned: { icon: <RotateCcw className="h-4 w-4" />, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40', tKey: 'actionReassigned' },
};

const STATUS_LABEL: Record<string, { tKey: string; class: string }> = {
  IN_PROGRESS: { tKey: 'inProgress', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  COMPLETED: { tKey: 'completed', class: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  REJECTED: { tKey: 'rejected', class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  RETURNED: { tKey: 'returned', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
};

function i18n(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj['en'] ?? obj['fr'] ?? Object.values(obj)[0] ?? '—';
  }
  return String(val);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDeadline(d: string | null): string {
  if (!d) return '—';
  const remaining = new Date(d).getTime() - Date.now();
  const hours = Math.round(remaining / (1000 * 60 * 60));
  if (hours < 0) return `${Math.abs(hours)}h overdue`;
  if (hours < 24) return `${hours}h remaining`;
  return `${Math.round(hours / 24)}d remaining`;
}

export default function WorkflowInstancePage() {
  const t = useTranslations('workflow');
  const params = useParams();
  const instanceId = params.id as string;
  const { user } = useAuthStore();

  const { data: timelineRes, isLoading } = useWorkflowTimeline(instanceId);
  const validateMut = useValidateInstance();
  const rejectMut = useRejectInstance();
  const returnMut = useReturnInstance();
  const commentMut = useCommentInstance();

  const [dialog, setDialog] = useState<'validate' | 'reject' | 'return' | 'comment' | null>(null);
  const [commentText, setCommentText] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [showData, setShowData] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  const data = timelineRes?.data;
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-gray-500">{t('workflowInstance')} — not found.</p>
        <Link href="/workflow" className="mt-2 text-sm text-blue-600 hover:underline">{t('dashboard')}</Link>
      </div>
    );
  }

  const instance = data.instance;
  const timeline = data.timeline ?? [];
  const currentStep = data.currentStep;
  const steps = instance.workflow?.steps ?? [];
  const isCurrentAssignee = user?.id === instance.currentAssigneeId;
  const isTerminal = ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(instance.status);

  const handleValidate = async () => {
    await validateMut.mutateAsync({ id: instanceId, comment: commentText || undefined });
    setDialog(null);
    setCommentText('');
  };

  const handleReject = async () => {
    if (!reasonText.trim()) return;
    await rejectMut.mutateAsync({ id: instanceId, reason: reasonText, comment: commentText || undefined });
    setDialog(null);
    setReasonText('');
    setCommentText('');
  };

  const handleReturn = async () => {
    if (!reasonText.trim()) return;
    await returnMut.mutateAsync({ id: instanceId, reason: reasonText, comment: commentText || undefined });
    setDialog(null);
    setReasonText('');
    setCommentText('');
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await commentMut.mutateAsync({ id: instanceId, comment: commentText });
    setDialog(null);
    setCommentText('');
  };

  const st = STATUS_LABEL[instance.status] ?? STATUS_LABEL['IN_PROGRESS'];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/workflow" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('workflowInstance')}
          </h1>
          <p className="text-xs font-mono text-gray-500">{instanceId}</p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', st.class)}>{t(st.tKey)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline (left 2/3) */}
        <div className="lg:col-span-2 space-y-0">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            {t('validationTimeline')}
          </h2>

          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            {/* History entries */}
            {timeline.map((entry: any, idx: number) => {
              const cfg = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG['commented'];
              return (
                <div key={entry.id ?? idx} className="relative mb-6 last:mb-0">
                  {/* Dot */}
                  <div className={cn(
                    'absolute -left-5 flex h-8 w-8 items-center justify-center rounded-full',
                    cfg.color,
                  )}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="ml-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {t(cfg.tKey)}
                        </span>
                        {entry.performedByName && (
                          <span className="ml-2 text-xs text-gray-500">
                            by {entry.performedByName}
                          </span>
                        )}
                        {entry.isAutomatic && (
                          <span className="ml-2 inline-flex items-center rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-600 dark:text-purple-400">
                            {t('auto')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{fmtDate(entry.performedAt)}</span>
                    </div>
                    {entry.stepName && (
                      <p className="mt-1 text-xs text-gray-500">
                        {i18n(entry.stepName)} ({entry.levelType})
                      </p>
                    )}
                    {entry.reason && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 border-l-2 border-orange-300 pl-2">
                        {entry.reason}
                      </p>
                    )}
                    {entry.comment?.text && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 italic">
                        &quot;{entry.comment.text}&quot;
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Future steps (not yet reached) */}
            {!isTerminal && steps
              .filter((s: any) => s.stepOrder > instance.currentStepOrder)
              .map((step: any) => (
                <div key={step.id} className="relative mb-6 last:mb-0 opacity-40">
                  <div className="absolute -left-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <Clock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="ml-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <span className="text-sm text-gray-500">
                      {i18n(step.name)} — {t('pendingValidation')}
                    </span>
                  </div>
                </div>
              ))}

            {/* Current step actions */}
            {isCurrentAssignee && !isTerminal && (
              <div className="relative mb-6">
                <div className="absolute -left-5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/40">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div className="ml-4 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    {t('awaitingYourAction')} — {i18n(currentStep?.name)}
                  </p>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {t('deadline')}: {fmtDeadline(instance.currentDeadline)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setDialog('validate')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> {t('validate')}
                    </button>
                    <button
                      onClick={() => setDialog('reject')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {t('reject')}
                    </button>
                    <button
                      onClick={() => setDialog('return')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t('return')}
                    </button>
                    <button
                      onClick={() => setDialog('comment')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> {t('comment')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Instance info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('details')}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('status')}</dt>
                <dd><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.class)}>{t(st.tKey)}</span></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('priority')}</dt>
                <dd className="text-xs font-medium">{instance.priority}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('country')}</dt>
                <dd className="text-xs">{i18n(instance.workflow?.country?.name)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('submitted')}</dt>
                <dd className="text-xs">{fmtDate(instance.submittedAt)}</dd>
              </div>
              {instance.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">{t('completed')}</dt>
                  <dd className="text-xs">{fmtDate(instance.completedAt)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('deadline')}</dt>
                <dd className="text-xs">{fmtDeadline(instance.currentDeadline)}</dd>
              </div>
            </dl>
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('progressLabel')}</h3>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('step')} {instance.currentStepOrder + 1} / {steps.length}</span>
                <span>{data.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    instance.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500',
                  )}
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              {/* Step dots */}
              <div className="mt-3 space-y-1">
                {steps.map((step: any) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-2 text-xs rounded px-2 py-1',
                      step.stepOrder < instance.currentStepOrder
                        ? 'text-green-700 dark:text-green-400'
                        : step.stepOrder === instance.currentStepOrder
                          ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium'
                          : 'text-gray-400 dark:text-gray-500',
                    )}
                  >
                    {step.stepOrder < instance.currentStepOrder ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : step.stepOrder === instance.currentStepOrder ? (
                      <div className="h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-200" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-gray-300 dark:border-gray-600" />
                    )}
                    {i18n(step.name)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Submission data */}
          {instance.submission && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <button
                onClick={() => setShowData(!showData)}
                className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                {t('submissionData')}
                {showData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showData && (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 dark:bg-gray-800 p-3 text-[11px] text-gray-700 dark:text-gray-300">
                  {JSON.stringify(instance.submission.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action Dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {dialog === 'validate' && t('validateSubmission')}
              {dialog === 'reject' && t('rejectSubmission')}
              {dialog === 'return' && t('returnForCorrection')}
              {dialog === 'comment' && t('addCommentTitle')}
            </h3>

            {(dialog === 'reject' || dialog === 'return') && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('reason')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  rows={3}
                  placeholder={dialog === 'reject' ? t('reasonForRejection') : t('whatNeedsCorrecting')}
                />
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('commentLabel')} {dialog !== 'comment' && t('commentOptional')}
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                rows={3}
                placeholder={t('addCommentPlaceholder')}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setDialog(null); setCommentText(''); setReasonText(''); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={
                  dialog === 'validate' ? handleValidate
                    : dialog === 'reject' ? handleReject
                      : dialog === 'return' ? handleReturn
                        : handleComment
                }
                disabled={
                  (dialog === 'reject' && !reasonText.trim()) ||
                  (dialog === 'return' && !reasonText.trim()) ||
                  (dialog === 'comment' && !commentText.trim()) ||
                  validateMut.isPending || rejectMut.isPending || returnMut.isPending || commentMut.isPending
                }
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  dialog === 'validate' ? 'bg-green-600 hover:bg-green-700'
                    : dialog === 'reject' ? 'bg-red-600 hover:bg-red-700'
                      : dialog === 'return' ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-blue-600 hover:bg-blue-700',
                )}
              >
                {(validateMut.isPending || rejectMut.isPending || returnMut.isPending || commentMut.isPending)
                  ? t('processing')
                  : dialog === 'validate' ? t('validateAndAdvance')
                    : dialog === 'reject' ? t('reject')
                      : dialog === 'return' ? t('returnForCorrection')
                        : t('addCommentTitle')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
