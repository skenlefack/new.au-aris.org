'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  Clock, Eye, Trash2, RotateCw, Search,
  ChevronLeft, ChevronRight, Filter, Ban,
} from 'lucide-react';
import { useIngestFiles, useUploadIngestFile, useCancelIngest } from '@/lib/api/ingest-hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  QUARANTINE: { icon: <Clock className="h-3 w-3" />, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', label: 'En attente' },
  PROFILING: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Profilage...' },
  MATCHED: { icon: <Eye className="h-3 w-3" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', label: 'Mapping requis' },
  MAPPED: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Mappe' },
  DRY_RUN: { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', label: 'Simulation...' },
  COMMITTED: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Charge' },
  FAILED: { icon: <XCircle className="h-3 w-3" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Echoue' },
  CANCELLED: { icon: <Trash2 className="h-3 w-3" />, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', label: 'Annule' },
};

const STATUS_FILTERS = ['QUARANTINE', 'PROFILING', 'MATCHED', 'MAPPED', 'DRY_RUN', 'COMMITTED', 'FAILED', 'CANCELLED'];

export default function IngestPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: filesRes, isLoading, refetch } = useIngestFiles({ page, limit: 20, status: statusFilter || undefined });
  const uploadMut = useUploadIngestFile();
  const cancelMut = useCancelIngest();
  const [dragOver, setDragOver] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const files: Array<Record<string, unknown>> = (filesRes as Record<string, unknown>)?.data as Array<Record<string, unknown>> ?? [];
  const meta = (filesRes as Record<string, unknown>)?.meta as Record<string, number> | undefined;
  const totalPages = meta ? Math.ceil(meta.total / (meta.limit || 20)) : 1;

  const filtered = searchTerm
    ? files.filter((f) => (f.filename as string).toLowerCase().includes(searchTerm.toLowerCase()))
    : files;

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const result = await uploadMut.mutateAsync(file) as Record<string, Record<string, string>>;
      const id = result?.data?.id;
      if (id) router.push(`/ingest/${id}`);
    }
  }, [uploadMut, router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleCancel = async () => {
    if (!cancellingId) return;
    await cancelMut.mutateAsync(cancellingId);
    setCancellingId(null);
    refetch();
  };

  return (
    <div className="flex h-full flex-col px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Import de donnees</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Deposez des fichiers (CSV, Excel, JSON) pour importer des donnees dans les campagnes ARIS</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"><RotateCw className="h-4 w-4" /></button>
          <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2">
            {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadMut.isPending ? 'Upload...' : 'Importer un fichier'}
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.json,.tsv" multiple onChange={(e) => handleUpload(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Drop zone */}
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        className={`mb-3 flex items-center justify-center rounded-lg border-2 border-dashed py-3 transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
        <p className="text-xs text-gray-400">Glissez-deposez des fichiers ici &middot; CSV, Excel (.xlsx), JSON &middot; max 100 Mo</p>
      </div>

      {/* Filters */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher par nom..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <option value="">Tous les statuts</option>
            {STATUS_FILTERS.map((s) => (<option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>))}
          </select>
        </div>
        <span className="ml-auto text-xs text-gray-400">{meta?.total ?? 0} fichier(s)</span>
      </div>

      {/* Table — full width, scrollable */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <FileSpreadsheet className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500">{files.length === 0 ? 'Aucun fichier importe' : 'Aucun resultat'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/90 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Fichier</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Domaine</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Taille</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Statut</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((f) => {
                  const st = STATUS_CONFIG[f.status as string] ?? STATUS_CONFIG['QUARANTINE'];
                  const sizeKb = Math.round(Number(f.fileSize) / 1024);
                  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`;
                  const canCancelRow = !['COMMITTED', 'CANCELLED'].includes(f.status as string);
                  return (
                    <tr key={f.id as string} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/ingest/${f.id}`} className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">{f.filename as string}</Link>
                      </td>
                      <td className="px-4 py-2.5"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-400">{f.domainCode as string}</span></td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{sizeLabel}</td>
                      <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color} ${st.bg}`}>{st.icon} {st.label}</span></td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(f.createdAt as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/ingest/${f.id}`} className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Voir</span>
                          </Link>
                          {canCancelRow && (
                            <button onClick={() => setCancellingId(f.id as string)} className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
                              <span className="flex items-center gap-1"><Ban className="h-3 w-3" /> Annuler</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Page {page}/{totalPages} &middot; {meta?.total ?? 0} fichier(s)</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700"><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${page === p ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'}`}>{p}</button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <ConfirmDialog open={!!cancellingId} title="Annuler l'import" message="Le fichier sera supprime et l'import annule. Les donnees non chargees seront perdues." confirmLabel="Annuler l'import" variant="danger" loading={cancelMut.isPending} onConfirm={handleCancel} onCancel={() => setCancellingId(null)} />
    </div>
  );
}
