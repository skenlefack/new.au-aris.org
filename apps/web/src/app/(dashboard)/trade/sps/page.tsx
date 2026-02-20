'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpsCertificates, type SpsCertificate } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const INSPECTION_BADGE: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  CONDITIONAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-blue-100 text-blue-700',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-green-100 text-green-700',
  REVOKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
};

const PLACEHOLDER_CERTIFICATES: SpsCertificate[] = [
  {
    id: 'sps-1', certificateNumber: 'SPS-KE-2026-00142',
    exporterCountry: 'Kenya', importerCountry: 'Uganda',
    commodity: 'Live Cattle', quantity: 2500, unit: 'heads',
    inspectionResult: 'PASS', status: 'ISSUED',
    inspectionDate: '2026-02-10', certifiedBy: 'Dr. Wanjiku Kamau',
    certifiedAt: '2026-02-10T14:30:00Z', validUntil: '2026-05-10',
    createdAt: '2026-02-08T10:00:00Z', updatedAt: '2026-02-10T14:30:00Z',
  },
  {
    id: 'sps-2', certificateNumber: 'SPS-ET-2026-00089',
    exporterCountry: 'Ethiopia', importerCountry: 'Djibouti',
    commodity: 'Chilled Beef', quantity: 1200, unit: 'tonnes',
    inspectionResult: 'PASS', status: 'ISSUED',
    inspectionDate: '2026-02-05', certifiedBy: 'Dr. Tadesse Lemma',
    certifiedAt: '2026-02-05T11:00:00Z', validUntil: '2026-04-05',
    createdAt: '2026-02-03T08:00:00Z', updatedAt: '2026-02-05T11:00:00Z',
  },
  {
    id: 'sps-3', certificateNumber: 'SPS-ZA-2026-00315',
    exporterCountry: 'South Africa', importerCountry: 'Nigeria',
    commodity: 'Poultry Meat (Frozen)', quantity: 5000, unit: 'tonnes',
    inspectionResult: 'CONDITIONAL', status: 'ISSUED',
    inspectionDate: '2026-02-12', certifiedBy: 'Dr. Pieter van Niekerk',
    certifiedAt: '2026-02-13T09:00:00Z', validUntil: '2026-03-12',
    createdAt: '2026-02-10T06:00:00Z', updatedAt: '2026-02-13T09:00:00Z',
  },
  {
    id: 'sps-4', certificateNumber: 'SPS-NG-2026-00201',
    exporterCountry: 'Nigeria', importerCountry: 'Ghana',
    commodity: 'Processed Hides', quantity: 800, unit: 'tonnes',
    inspectionResult: 'FAIL', status: 'DRAFT',
    inspectionDate: '2026-02-15', certifiedBy: 'Dr. Adaeze Okoro',
    certifiedAt: null, validUntil: null,
    createdAt: '2026-02-14T12:00:00Z', updatedAt: '2026-02-15T16:00:00Z',
  },
  {
    id: 'sps-5', certificateNumber: 'SPS-MA-2025-00478',
    exporterCountry: 'Morocco', importerCountry: 'Mauritania',
    commodity: 'Dairy Products', quantity: 3000, unit: 'tonnes',
    inspectionResult: 'PASS', status: 'EXPIRED',
    inspectionDate: '2025-11-20', certifiedBy: 'Dr. Youssef Bennani',
    certifiedAt: '2025-11-20T10:00:00Z', validUntil: '2026-02-20',
    createdAt: '2025-11-18T09:00:00Z', updatedAt: '2025-11-20T10:00:00Z',
  },
  {
    id: 'sps-6', certificateNumber: 'SPS-TZ-2026-00067',
    exporterCountry: 'Tanzania', importerCountry: 'Kenya',
    commodity: 'Live Goats', quantity: 4000, unit: 'heads',
    inspectionResult: 'PENDING', status: 'DRAFT',
    inspectionDate: '2026-02-18', certifiedBy: 'Dr. Baraka Mushi',
    certifiedAt: null, validUntil: null,
    createdAt: '2026-02-17T11:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
];

export default function SpsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inspectionFilter, setInspectionFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useSpsCertificates({
    page,
    limit,
    status: statusFilter || undefined,
    inspectionResult: inspectionFilter || undefined,
    search: search || undefined,
  });

  const certificates = data?.data ?? PLACEHOLDER_CERTIFICATES;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_CERTIFICATES.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  // Summary stats
  const totalCerts = meta.total;
  const passCount = certificates.filter((c) => c.inspectionResult === 'PASS').length;
  const passRate = certificates.length > 0 ? ((passCount / certificates.length) * 100).toFixed(1) : '0';
  const pendingCount = certificates.filter((c) => c.inspectionResult === 'PENDING').length;
  const issuedThisMonth = certificates.filter((c) => {
    if (!c.certifiedAt) return false;
    const d = new Date(c.certifiedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/trade"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SPS Certificates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sanitary and phytosanitary inspections and certifications
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">Total Certificates</p>
          <p className="text-xl font-bold text-gray-900">{totalCerts}</p>
        </div>
        <div className="rounded-card border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">Pass Rate</p>
          <p className="text-xl font-bold text-green-700">{passRate}%</p>
        </div>
        <div className="rounded-card border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-600">Pending Inspections</p>
          <p className="text-xl font-bold text-blue-700">{pendingCount}</p>
        </div>
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-4">
          <p className="text-xs text-aris-primary-600">Issued This Month</p>
          <p className="text-xl font-bold text-aris-primary-700">{issuedThisMonth}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search certificates..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <select
            value={inspectionFilter}
            onChange={(e) => {
              setInspectionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Results</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="CONDITIONAL">Conditional</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load certificates'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Certificate #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Exporter</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Importer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Commodity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Inspection</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Inspection Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Certified By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Valid Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                      {c.certificateNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{c.exporterCountry}</td>
                    <td className="px-4 py-3 text-gray-900">{c.importerCountry}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.commodity}
                      <p className="text-xs text-gray-400">
                        {c.quantity.toLocaleString()} {c.unit}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          INSPECTION_BADGE[c.inspectionResult],
                        )}
                      >
                        {c.inspectionResult}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_BADGE[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(c.inspectionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.certifiedBy}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.validUntil
                        ? new Date(c.validUntil).toLocaleDateString()
                        : <span className="text-gray-300">--</span>}
                    </td>
                  </tr>
                ))}
                {certificates.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      No SPS certificates found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {certificates.length} of {meta.total} certificates
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
