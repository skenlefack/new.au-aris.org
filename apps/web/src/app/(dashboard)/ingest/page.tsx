'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  Clock, AlertTriangle, Eye, Trash2,
} from 'lucide-react';
import { useIngestFiles, useUploadIngestFile, useCancelIngest } from '@/lib/api/ingest-hooks';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  QUARANTINE: { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Quarantine' },
  PROFILING: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Profiling...' },
  MATCHED: { icon: <Eye className="h-3.5 w-3.5" />, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Ready for mapping' },
  MAPPED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Mapped' },
  DRY_RUN: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Dry-run...' },
  COMMITTED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Loaded' },
  FAILED: { icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
  CANCELLED: { icon: <Trash2 className="h-3.5 w-3.5" />, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Cancelled' },
};

export default function IngestPage() {
  const [page, setPage] = useState(1);
  const { data: filesRes, isLoading } = useIngestFiles({ page, limit: 20 });
  const uploadMut = useUploadIngestFile();
  const cancelMut = useCancelIngest();
  const [dragOver, setDragOver] = useState(false);

  const files: Array<Record<string, unknown>> = (filesRes as Record<string, unknown>)?.data as Array<Record<string, unknown>> ?? [];
  const meta = (filesRes as Record<string, unknown>)?.meta as Record<string, number> | undefined;

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      await uploadMut.mutateAsync(file);
    }
  }, [uploadMut]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Data Import</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload files (CSV, Excel, JSON) to import data into ARIS campaigns
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/10'
            : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900'
        }`}
      >
        <Upload className="mb-3 h-10 w-10 text-gray-400" />
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Drag & drop files here, or click to browse
        </p>
        <p className="mb-4 text-xs text-gray-500">CSV, Excel (.xlsx), JSON — max 100 MB</p>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          {uploadMut.isPending ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</span>
          ) : (
            'Choose File'
          )}
          <input
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,.json,.tsv"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <FileSpreadsheet className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-500">No files imported yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500">File</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500">Domain</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500">Size</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {files.map((f) => {
                const status = STATUS_CONFIG[f.status as string] ?? STATUS_CONFIG['QUARANTINE'];
                const sizeKb = Math.round(Number(f.fileSize) / 1024);
                const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
                return (
                  <tr key={f.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/ingest/${f.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-white">
                        {f.filename as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{f.domainCode as string}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{sizeLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.color} ${status.bg}`}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(f.createdAt as string).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/ingest/${f.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {meta && meta.total > 20 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <span className="text-xs text-gray-500">{meta.total} files</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-xs disabled:opacity-40">Prev</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= meta.total} className="rounded-md border px-3 py-1 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
