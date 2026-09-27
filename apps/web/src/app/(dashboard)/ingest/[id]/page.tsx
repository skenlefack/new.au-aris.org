'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  Columns, Target, Play, Upload as UploadIcon, AlertTriangle, Ban,
  RotateCw, Download,
} from 'lucide-react';
import {
  useIngestFile, useIngestProfile, useIngestProposals, useIngestQualityReport,
  useConfirmMapping, useResolveCampaign, useStartDryRun, useCommitIngest, useCancelIngest,
} from '@/lib/api/ingest-hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function IngestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const { data: fileRes, refetch } = useIngestFile(fileId);
  const { data: profileRes } = useIngestProfile(fileId);
  const { data: proposalsRes } = useIngestProposals(fileId);
  const { data: reportRes } = useIngestQualityReport(fileId);

  const confirmMut = useConfirmMapping();
  const dryRunMut = useStartDryRun();
  const commitMut = useCommitIngest();
  const cancelMut = useCancelIngest();

  const file = (fileRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const profile = (profileRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const proposals = ((proposalsRes as Record<string, unknown>)?.data ?? []) as Array<Record<string, unknown>>;
  const report = (reportRes as Record<string, unknown>)?.data as Record<string, unknown> | undefined;

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [profilePage, setProfilePage] = useState(0);
  const PROFILE_PAGE_SIZE = 50;

  if (!file) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  const status = file.status as string;
  const canMap = status === 'MATCHED' && proposals.length > 0;
  const canDryRun = status === 'MAPPED';
  const canCommit = status === 'DRY_RUN' && report;
  const canCancel = !['COMMITTED', 'CANCELLED'].includes(status);
  const sizeKb = Math.round(Number(file.fileSize) / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`;

  const columns = (profile?.columns as Array<Record<string, unknown>>) ?? [];
  const pagedColumns = columns.slice(profilePage * PROFILE_PAGE_SIZE, (profilePage + 1) * PROFILE_PAGE_SIZE);
  const profileTotalPages = Math.ceil(columns.length / PROFILE_PAGE_SIZE);

  const handleCancel = async () => {
    await cancelMut.mutateAsync(fileId);
    setShowCancelDialog(false);
    router.push('/ingest');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header with actions */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3 dark:border-gray-700 dark:bg-gray-900/95 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/ingest" className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </Link>
            <FileSpreadsheet className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{file.filename as string}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-700">{file.domainCode as string}</span>
                <span>&middot;</span>
                <span>{sizeLabel}</span>
                <span>&middot;</span>
                <span>{new Date(file.createdAt as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetch()} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            {canDryRun && (
              <button onClick={() => dryRunMut.mutate(fileId)} disabled={dryRunMut.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {dryRunMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Simulation
              </button>
            )}
            {canCommit && (
              <button onClick={() => commitMut.mutate(fileId)} disabled={commitMut.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {commitMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadIcon className="h-3.5 w-3.5" />} Charger
              </button>
            )}
            {canCancel && (
              <button onClick={() => setShowCancelDialog(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                <Ban className="h-3.5 w-3.5" /> Annuler
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content — full width, scrollable */}
      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 space-y-5">

        {/* Error */}
        {file.errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{file.errorMessage as string}</p>
          </div>
        )}

        {/* Status banner */}
        {status === 'QUARANTINE' && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Fichier en cours de traitement... Le profilage et le matching sont en cours.</p>
          </div>
        )}

        {/* Quality report */}
        {report && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Rapport qualite</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/10">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{report.acceptedRows as number}</p>
                <p className="text-[10px] text-emerald-600">Acceptees</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-900/10">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{report.rejectedRows as number}</p>
                <p className="text-[10px] text-red-600">Rejetees</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-900/10">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{report.warningRows as number}</p>
                <p className="text-[10px] text-amber-600">Avertissements</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{report.duplicateRows as number}</p>
                <p className="text-[10px] text-gray-500">Doublons</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile */}
        {profile && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Columns className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Profil — {profile.rowCount as number} lignes, {columns.length} colonnes
                </h2>
              </div>
              {profileTotalPages > 1 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <button onClick={() => setProfilePage((p) => Math.max(0, p - 1))} disabled={profilePage === 0} className="px-1.5 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30">&lt;</button>
                  <span>{profilePage + 1}/{profileTotalPages}</span>
                  <button onClick={() => setProfilePage((p) => Math.min(profileTotalPages - 1, p + 1))} disabled={profilePage >= profileTotalPages - 1} className="px-1.5 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30">&gt;</button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">#</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Colonne</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Null %</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Valeurs uniques</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Concept</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Echantillon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {pagedColumns.map((col, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2 text-gray-400">{profilePage * PROFILE_PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{col.rawName as string}</td>
                      <td className="px-4 py-2">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{col.inferredType as string}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{((col.nullRate as number) * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 text-gray-500">{col.cardinality as number}</td>
                      <td className="px-4 py-2">
                        {col.semanticConcept ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{col.semanticConcept as string}</span>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 max-w-[250px] truncate">{((col.sampleValues as string[]) ?? []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Proposals */}
        {proposals.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Formulaires candidats ({proposals.length})</h2>
                </div>
                {!canMap && status !== 'MATCHED' && (
                  <span className="text-[10px] text-gray-400">Mapping deja confirme</span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500">#</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500">Formulaire</th>
                    <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500">Score</th>
                    <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500">Couverture</th>
                    <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500">Types</th>
                    <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500">Semantique</th>
                    {canMap && <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-500">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {proposals.map((p) => {
                    const score = ((p.scoreGlobal as number) * 100);
                    const scoreColor = score >= 85 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <tr key={p.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{p.rank as number}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{p.templateName as string}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-sm font-bold ${scoreColor}`}>{score.toFixed(0)}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{((p.scoreCoverage as number) * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{((p.scoreTypes as number) * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{((p.scoreSemantic as number) * 100).toFixed(0)}%</td>
                        {canMap && (
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => confirmMut.mutate({ fileId, proposalId: p.id as string })}
                              disabled={confirmMut.isPending}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {confirmMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accepter'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={showCancelDialog} title="Annuler l'import" message="Le fichier sera supprime et l'import annule." confirmLabel="Annuler l'import" variant="danger" loading={cancelMut.isPending} onConfirm={handleCancel} onCancel={() => setShowCancelDialog(false)} />
    </div>
  );
}
