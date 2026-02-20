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
  User,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQualityReport, type QualityGateStatus } from '@/lib/api/hooks';
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
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

export default function QualityReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading } = useQualityReport(id);

  if (isLoading) return <DetailSkeleton />;

  const report = data?.data;
  if (!report) {
    return (
      <div className="space-y-4">
        <Link
          href="/quality/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <div className="rounded-card border border-gray-200 bg-white p-8 text-center text-gray-400">
          Report not found
        </div>
      </div>
    );
  }

  const resultStyles: Record<string, string> = {
    pass: 'bg-green-50 border-green-200 text-green-700',
    fail: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  const passCount = report.gateResults.filter(
    (g) => g.status === 'pass',
  ).length;
  const failCount = report.gateResults.filter(
    (g) => g.status === 'fail',
  ).length;
  const warningCount = report.gateResults.filter(
    (g) => g.status === 'warning',
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/quality/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {report.entityTitle}
          </h1>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              resultStyles[report.overallResult] ?? resultStyles.pass,
            )}
          >
            {report.overallResult === 'fail' && (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {report.overallResult === 'warning' && (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {report.overallResult === 'pass' && (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {report.overallResult.charAt(0).toUpperCase() +
              report.overallResult.slice(1)}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            {report.entityType} &mdash; {report.domain}
          </span>
          <span className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Submitted by: {report.submittedBy}
          </span>
          {report.reviewedBy && (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              Reviewed by: {report.reviewedBy}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            {new Date(report.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Summary banner */}
      <div
        className={cn(
          'rounded-card border p-5',
          resultStyles[report.overallResult] ?? resultStyles.pass,
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">
              Overall Result:{' '}
              {report.overallResult.charAt(0).toUpperCase() +
                report.overallResult.slice(1)}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {passCount} passed, {failCount} failed, {warningCount} warnings
              out of {report.gateResults.length} gates
            </p>
          </div>
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-xs font-medium',
              report.status === 'corrected'
                ? 'bg-green-100 text-green-700'
                : report.status === 'overridden'
                  ? 'bg-blue-100 text-blue-700'
                  : report.status === 'accepted'
                    ? 'bg-aris-primary-100 text-aris-primary-700'
                    : 'bg-gray-100 text-gray-700',
            )}
          >
            Status: {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Per-gate results */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Quality Gate Results
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {report.gateResults.map((gate) => (
            <div
              key={gate.gate}
              className={cn(
                'rounded-card border p-4',
                gate.status === 'fail'
                  ? 'border-red-200 bg-red-50'
                  : gate.status === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : gate.status === 'pass'
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50',
              )}
            >
              <div className="flex items-start gap-3">
                <GateIcon status={gate.status} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {GATE_LABELS[gate.gate] ?? gate.gate}
                  </p>
                  {gate.message && (
                    <p className="mt-1 text-xs text-gray-600">{gate.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Violations */}
      {report.violations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Violations ({report.violations.length})
          </h2>
          <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Gate</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.violations.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          v.severity === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {v.severity === 'error' ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {v.severity.charAt(0).toUpperCase() +
                          v.severity.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {GATE_LABELS[v.gate] ?? v.gate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {v.field}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.message}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.suggestion ?? '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
