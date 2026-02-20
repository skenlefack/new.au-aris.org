'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  User,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubmission, type QualityGateStatus } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';

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

function GateIcon({ status }: { status: QualityGateStatus['status'] }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading } = useSubmission(id);

  if (isLoading) return <DetailSkeleton />;

  const submission = data?.data;
  if (!submission) {
    return (
      <div className="space-y-4">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <div className="rounded-card border border-gray-200 bg-white p-8 text-center text-gray-400">
          Submission not found
        </div>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    validated: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    corrected: 'bg-amber-100 text-amber-700',
  };

  const qualityResultStyles: Record<string, string> = {
    pass: 'bg-green-50 border-green-200 text-green-700',
    fail: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    pending: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/collecte/campaigns/${submission.campaignId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {submission.campaignName}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Submission {submission.id.slice(0, 8)}
          </h1>
          <span
            className={cn(
              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusStyles[submission.status] ?? statusStyles.draft,
            )}
          >
            {submission.status.charAt(0).toUpperCase() +
              submission.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            {submission.submittedByName}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            {submission.zone}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            {new Date(submission.submittedAt).toLocaleString()}
          </span>
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Workflow Level {submission.workflowLevel}
          </span>
        </div>
      </div>

      {/* Quality Report */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Quality Report
        </h2>

        <div
          className={cn(
            'mb-4 rounded-card border p-4',
            qualityResultStyles[submission.qualityResult] ??
              qualityResultStyles.pending,
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {submission.qualityResult === 'pass' && (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {submission.qualityResult === 'fail' && (
                <XCircle className="h-5 w-5" />
              )}
              {submission.qualityResult === 'warning' && (
                <AlertTriangle className="h-5 w-5" />
              )}
              <span className="font-semibold">
                Overall:{' '}
                {submission.qualityResult.charAt(0).toUpperCase() +
                  submission.qualityResult.slice(1)}
              </span>
            </div>
            <span className="text-2xl font-bold">
              {submission.qualityScore}%
            </span>
          </div>
        </div>

        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Gate</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(submission.qualityGates ?? []).map((gate) => (
                <tr key={gate.gate}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {GATE_LABELS[gate.gate] ?? gate.gate}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <GateIcon status={gate.status} />
                      <span className="text-xs font-medium">
                        {gate.status.charAt(0).toUpperCase() +
                          gate.status.slice(1)}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {gate.message ?? '\u2014'}
                  </td>
                </tr>
              ))}
              {(submission.qualityGates ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No quality gate results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corrections */}
      {(submission.corrections ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Corrections
          </h2>
          <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Old Value</th>
                  <th className="px-4 py-3">New Value</th>
                  <th className="px-4 py-3">Corrected By</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submission.corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.field}
                    </td>
                    <td className="px-4 py-3 text-red-600 line-through">
                      {c.oldValue}
                    </td>
                    <td className="px-4 py-3 text-green-600">{c.newValue}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.correctedBy}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      {(submission.timeline ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Timeline
          </h2>
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <div className="space-y-4">
              {submission.timeline.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-aris-primary-500" />
                    {idx < submission.timeline.length - 1 && (
                      <div className="flex-1 w-px bg-gray-200" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-900">
                      {entry.action}
                    </p>
                    <p className="text-xs text-gray-500">{entry.detail}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {entry.actor} ({entry.actorRole}) &mdash;{' '}
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Raw form data */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Form Data</h2>
        <div className="rounded-card border border-gray-200 bg-white p-5">
          <pre className="overflow-auto text-xs text-gray-600">
            {JSON.stringify(submission.formData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
