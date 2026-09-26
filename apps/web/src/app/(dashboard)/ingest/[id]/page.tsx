'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  Columns, Target, Play, Upload as UploadIcon, AlertTriangle, Ban,
} from 'lucide-react';
import {
  useIngestFile, useIngestProfile, useIngestProposals, useIngestQualityReport,
  useConfirmMapping, useResolveCampaign, useStartDryRun, useCommitIngest, useCancelIngest,
} from '@/lib/api/ingest-hooks';

export default function IngestDetailPage() {
  const params = useParams();
  const fileId = params.id as string;

  const { data: fileRes } = useIngestFile(fileId);
  const { data: profileRes } = useIngestProfile(fileId);
  const { data: proposalsRes } = useIngestProposals(fileId);
  const { data: reportRes } = useIngestQualityReport(fileId);

  const confirmMut = useConfirmMapping();
  const campaignMut = useResolveCampaign();
  const dryRunMut = useStartDryRun();
  const commitMut = useCommitIngest();
  const cancelMut = useCancelIngest();

  const file = (fileRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const profile = (profileRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const proposals = ((proposalsRes as Record<string, unknown>)?.data ?? []) as Array<Record<string, unknown>>;
  const report = (reportRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;

  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);

  if (!file) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const status = file.status as string;
  const canMap = status === 'MATCHED' && proposals.length > 0;
  const canDryRun = status === 'MAPPED';
  const canCommit = status === 'DRY_RUN' && report;
  const canCancel = !['COMMITTED', 'CANCELLED'].includes(status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/ingest" className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <FileSpreadsheet className="h-5 w-5 text-blue-500" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{file.filename as string}</h1>
          <p className="text-xs text-gray-500">{file.domainCode as string} &middot; {Math.round(Number(file.fileSize) / 1024)} KB &middot; {status}</p>
        </div>
      </div>

      {/* Error message */}
      {file.errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{file.errorMessage as string}</p>
        </div>
      )}

      {/* Profile section */}
      {profile && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Profile — {(profile.rowCount as number)} rows, {((profile.columns as unknown[]) ?? []).length} columns
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Column</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Null%</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Unique</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Concept</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {((profile.columns as Array<Record<string, unknown>>) ?? []).map((col, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{col.rawName as string}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {col.inferredType as string}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{((col.nullRate as number) * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-gray-500">{col.cardinality as number}</td>
                    <td className="px-3 py-2">
                      {col.semanticConcept ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          {col.semanticConcept as string}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                      {((col.sampleValues as string[]) ?? []).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proposals section */}
      {canMap && proposals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Match Proposals</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {proposals.map((p) => (
              <div
                key={p.id as string}
                className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  selectedProposal === p.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
                onClick={() => setSelectedProposal(p.id as string)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.templateName as string}</p>
                  <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
                    <span>Coverage: {((p.scoreCoverage as number) * 100).toFixed(0)}%</span>
                    <span>Types: {((p.scoreTypes as number) * 100).toFixed(0)}%</span>
                    <span>Semantic: {((p.scoreSemantic as number) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {((p.scoreGlobal as number) * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmMut.mutate({ fileId, proposalId: p.id as string });
                    }}
                    disabled={confirmMut.isPending}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirmMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality report */}
      {report && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quality Report</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/10">
              <p className="text-2xl font-bold text-emerald-700">{report.acceptedRows as number}</p>
              <p className="text-[10px] text-emerald-600">Accepted</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/10">
              <p className="text-2xl font-bold text-red-700">{report.rejectedRows as number}</p>
              <p className="text-[10px] text-red-600">Rejected</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
              <p className="text-2xl font-bold text-amber-700">{report.warningRows as number}</p>
              <p className="text-[10px] text-amber-600">Warnings</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-2xl font-bold text-gray-700">{report.duplicateRows as number}</p>
              <p className="text-[10px] text-gray-500">Duplicates</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {canDryRun && (
          <button onClick={() => dryRunMut.mutate(fileId)} disabled={dryRunMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
            {dryRunMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Simulation
          </button>
        )}
        {canCommit && (
          <button onClick={() => commitMut.mutate(fileId)} disabled={commitMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
            Commit Loading
          </button>
        )}
        {canCancel && (
          <button onClick={() => cancelMut.mutate(fileId)} disabled={cancelMut.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">
            <Ban className="h-4 w-4" /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}
