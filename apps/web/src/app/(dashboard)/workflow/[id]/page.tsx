'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkflowDetail,
  useWorkflowAction,
  type WorkflowDetail,
  type WorkflowHistoryEntry,
  type QualityGateStatus,
} from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 — National Technical Validation',
  2: 'Level 2 — National Official Approval (CVO)',
  3: 'Level 3 — REC Harmonization',
  4: 'Level 4 — Continental Analytics (AU-IBAR)',
};

const GATE_STATUS_STYLE: Record<string, { class: string; icon: React.ReactNode }> = {
  pass: {
    class: 'text-green-700 bg-green-50',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  },
  fail: {
    class: 'text-red-700 bg-red-50',
    icon: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  },
  warning: {
    class: 'text-amber-700 bg-amber-50',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  },
  skipped: {
    class: 'text-gray-500 bg-gray-50',
    icon: <Clock className="h-3.5 w-3.5 text-gray-400" />,
  },
};

const ACTION_BADGE: Record<string, { class: string; icon: React.ReactNode }> = {
  submitted: { class: 'text-blue-700', icon: <Clock className="h-3 w-3" /> },
  approved: { class: 'text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { class: 'text-red-700', icon: <XCircle className="h-3 w-3" /> },
  returned: { class: 'text-blue-700', icon: <CornerUpLeft className="h-3 w-3" /> },
  escalated: { class: 'text-purple-700', icon: <ShieldCheck className="h-3 w-3" /> },
};

const PLACEHOLDER_DETAIL: WorkflowDetail = {
  id: 'wf-1',
  entityType: 'health_event',
  entityId: 'ev-1',
  title: 'FMD Outbreak — Kenya, Rift Valley',
  country: 'Kenya',
  submittedBy: 'Dr. Ochieng',
  submittedAt: '2026-02-16T09:00:00Z',
  currentLevel: 2,
  status: 'pending',
  priority: 'high',
  description:
    'Foot-and-Mouth Disease outbreak reported in Nakuru County, Rift Valley region. 234 cases confirmed by RT-PCR. Ring vaccination initiated. Awaiting CVO office approval for official WAHIS notification.',
  entityData: {
    disease: 'Foot-and-Mouth Disease',
    diseaseCode: 'FMD',
    country: 'Kenya',
    region: 'Rift Valley',
    cases: 234,
    deaths: 12,
    severity: 'high',
    status: 'confirmed',
  },
  history: [
    {
      id: 'wh-1', level: 1, action: 'submitted',
      actor: 'Dr. Ochieng', actorRole: 'Field Agent',
      comment: 'Initial event submission with field data and samples',
      timestamp: '2026-02-15T10:30:00Z',
    },
    {
      id: 'wh-2', level: 1, action: 'approved',
      actor: 'Dr. Kamau', actorRole: 'Data Steward',
      comment: 'Technical validation passed. Quality score 92%. Lab results confirm FMDV serotype O.',
      timestamp: '2026-02-16T09:00:00Z',
    },
    {
      id: 'wh-3', level: 2, action: 'submitted',
      actor: 'System', actorRole: 'System',
      comment: 'Auto-escalated to Level 2 after L1 approval',
      timestamp: '2026-02-16T09:01:00Z',
    },
  ],
  qualityGates: [
    { gate: 'completeness', status: 'pass' },
    { gate: 'temporal_consistency', status: 'pass' },
    { gate: 'geographic_consistency', status: 'pass' },
    { gate: 'codes_vocabularies', status: 'pass' },
    { gate: 'units', status: 'pass' },
    { gate: 'deduplication', status: 'pass' },
    { gate: 'auditability', status: 'pass' },
    { gate: 'confidence_score', status: 'warning', message: 'Confidence: verified (awaiting additional lab confirmation)' },
  ],
};

const GATE_LABELS: Record<string, string> = {
  completeness: 'Completeness',
  temporal_consistency: 'Temporal Consistency',
  geographic_consistency: 'Geographic Consistency',
  codes_vocabularies: 'Codes & Vocabularies',
  units: 'Units',
  deduplication: 'Deduplication',
  auditability: 'Auditability',
  confidence_score: 'Confidence Score',
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const [comment, setComment] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);

  const { data, isLoading, isError, error, refetch } = useWorkflowDetail(itemId);
  const workflowAction = useWorkflowAction();

  const item = data?.data ?? PLACEHOLDER_DETAIL;

  const handleAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!comment.trim()) {
      setActionType(action);
      return;
    }
    try {
      await workflowAction.mutateAsync({
        id: itemId,
        action,
        comment: comment.trim(),
      });
      router.push('/workflow');
    } catch {
      // error displayed via mutation state
    }
  };

  if (isLoading) return <DetailSkeleton />;
  if (isError) {
    return (
      <QueryError
        message={error instanceof Error ? error.message : 'Failed to load workflow item'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/workflow"
          className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                item.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : item.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : item.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700',
              )}
            >
              {item.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {LEVEL_LABELS[item.currentLevel]} — submitted by{' '}
            {item.submittedBy} on{' '}
            {new Date(item.submittedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Validation level progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((level) => (
          <React.Fragment key={level}>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                level < item.currentLevel
                  ? 'bg-green-100 text-green-700'
                  : level === item.currentLevel
                    ? 'bg-aris-primary-100 text-aris-primary-700 ring-2 ring-aris-primary-300'
                    : 'bg-gray-100 text-gray-400',
              )}
            >
              L{level}
            </div>
            {level < 4 && (
              <div
                className={cn(
                  'h-0.5 flex-1',
                  level < item.currentLevel ? 'bg-green-300' : 'bg-gray-200',
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <section className="rounded-card border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900">
              Submission Details
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {item.description}
            </p>

            {/* Entity data summary */}
            <h3 className="mt-4 text-sm font-semibold text-gray-900">
              Entity Data
            </h3>
            <div className="mt-2 rounded-lg bg-gray-50 p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(item.entityData).map(([key, val]) => (
                  <div key={key}>
                    <dt className="text-xs text-gray-400">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </dt>
                    <dd className="font-medium text-gray-900">
                      {String(val)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Quality Gates */}
          <section className="rounded-card border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-aris-secondary-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Data Quality Gates
              </h2>
            </div>
            <div className="mt-4 space-y-2">
              {item.qualityGates.map((gate: QualityGateStatus) => {
                const style = GATE_STATUS_STYLE[gate.status];
                return (
                  <div
                    key={gate.gate}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2',
                      style?.class ?? 'bg-gray-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {style?.icon}
                      <span className="text-sm font-medium">
                        {GATE_LABELS[gate.gate] ?? gate.gate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {gate.message && (
                        <span className="text-xs opacity-75">
                          {gate.message}
                        </span>
                      )}
                      <span className="text-xs font-medium uppercase">
                        {gate.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Review action */}
          {item.status === 'pending' && (
            <section className="rounded-card border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Review Action
              </h2>

              {workflowAction.error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {workflowAction.error instanceof Error
                    ? workflowAction.error.message
                    : 'Action failed'}
                </div>
              )}

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700">
                  Comment {actionType && !comment.trim() && (
                    <span className="text-red-500">(required)</span>
                  )}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className={cn(
                    'mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2',
                    actionType && !comment.trim()
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-aris-primary-500 focus:ring-aris-primary-200',
                  )}
                  placeholder="Add your review comment..."
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={workflowAction.isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleAction('return')}
                  disabled={workflowAction.isPending}
                  className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  <CornerUpLeft className="h-4 w-4" />
                  Return
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={workflowAction.isPending}
                  className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — History */}
        <div className="space-y-6">
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Validation History
            </h3>
            <div className="mt-3 space-y-0">
              {item.history.map((entry: WorkflowHistoryEntry, i: number) => {
                const badge = ACTION_BADGE[entry.action];
                return (
                  <div key={entry.id} className="relative flex gap-3 pb-4">
                    {i < item.history.length - 1 && (
                      <div className="absolute left-[7px] top-5 h-full w-px bg-gray-200" />
                    )}
                    <div className="relative z-10 mt-0.5 flex-shrink-0">
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          entry.action === 'approved'
                            ? 'bg-green-100'
                            : entry.action === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-gray-100',
                        )}
                      >
                        {badge?.icon ?? <Clock className="h-3 w-3 text-gray-400" />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium capitalize',
                            badge?.class ?? 'text-gray-700',
                          )}
                        >
                          L{entry.level} {entry.action}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{entry.comment}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span>
                          {entry.actor} ({entry.actorRole})
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
