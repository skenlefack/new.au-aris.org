'use client';

import { useState, useCallback } from 'react';
import {
  Download,
  FileSpreadsheet,
  Calendar,
  CheckCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

// ── Auth helper for blob download ──

const BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/api/v1';

function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.state?.accessToken ?? null;
  } catch { return null; }
}

// ── Inline Hooks ──

function useTenants() {
  return useQuery<{ data: Array<{ id: string; name: string; code: string; level: string }> }>({
    queryKey: ['tenants'],
    queryFn: () => apiClient.get('/tenants?limit=200'),
  });
}

function useBulkExport() {
  return useMutation<Blob, Error, { service: string; entity: string; tenantId?: string; dateFrom?: string; dateTo?: string }>({
    mutationFn: async (params) => {
      const token = getToken();
      const query = new URLSearchParams();
      if (params.service) query.set('service', params.service);
      if (params.entity) query.set('entity', params.entity);
      if (params.tenantId) query.set('tenantId', params.tenantId);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      const qs = query.toString();
      const res = await fetch(
        `${BASE_URL}/admin/bulk-export${qs ? `?${qs}` : ''}`,
        {
          method: 'GET',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            Accept: 'text/csv',
          },
        },
      );
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      return res.blob();
    },
  });
}

// ── Service / Entity mappings ──

const SERVICE_OPTIONS = [
  'animal-health',
  'livestock-prod',
  'fisheries',
  'wildlife',
  'apiculture',
  'trade-sps',
  'governance',
  'climate-env',
  'master-data',
] as const;

const ENTITY_MAP: Record<string, string[]> = {
  'animal-health': ['healthEvent', 'labResult', 'surveillanceActivity', 'vaccinationCampaign'],
  'livestock-prod': ['livestockCensus', 'productionRecord', 'slaughterRecord'],
  fisheries: ['fishCapture', 'fishingVessel', 'aquacultureFarm'],
  wildlife: ['wildlifeInventory', 'protectedArea', 'citesPermit', 'wildlifeCrime'],
  'trade-sps': ['tradeFlow', 'spsCertificate', 'marketPrice'],
  apiculture: ['apiary', 'honeyProduction', 'colonyHealth'],
  governance: ['legalFramework', 'institutionalCapacity', 'pVSEvaluation', 'stakeholderRegistry'],
  'climate-env': ['waterStressIndex', 'rangelandCondition', 'environmentalHotspot', 'climateDataPoint'],
  'master-data': ['species', 'disease', 'geoEntity', 'unit'],
};

// ── Main Page ──

export default function BulkExportPage() {
  const [service, setService] = useState('');
  const [entity, setEntity] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: tenantsData } = useTenants();
  const tenants = tenantsData?.data ?? [];

  const exportMutation = useBulkExport();

  const entityOptions = service ? ENTITY_MAP[service] ?? [] : [];

  const handleServiceChange = useCallback((val: string) => {
    setService(val);
    setEntity('');
  }, []);

  const handleExport = useCallback(() => {
    if (!service || !entity) return;
    setShowSuccess(false);

    exportMutation.mutate(
      {
        service,
        entity,
        tenantId: tenantId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const date = new Date().toISOString().slice(0, 10);
          link.href = url;
          link.download = `${service}-${entity}-${date}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setShowSuccess(true);
        },
      },
    );
  }, [service, entity, tenantId, dateFrom, dateTo, exportMutation]);

  const canExport = service && entity;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Export</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Export entity data as CSV files from any service
        </p>
      </div>

      {/* Export Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
            <FileSpreadsheet className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Export Configuration
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Service
            </label>
            <select
              value={service}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
            >
              <option value="">Select service...</option>
              {SERVICE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Entity Type
            </label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
              disabled={!service}
            >
              <option value="">Select entity...</option>
              {entityOptions.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tenant (optional)
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
            >
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) - {t.level}
                </option>
              ))}
            </select>
          </div>

          {/* Spacer for grid alignment */}
          <div />

          {/* Date From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              From Date (optional)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              To Date (optional)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-aris-primary-500 focus:border-transparent w-full"
            />
          </div>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={!canExport || exportMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-aris-primary-600 text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Export completed successfully
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Your CSV file has been downloaded: {service}-{entity}-
                {new Date().toISOString().slice(0, 10)}.csv
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {exportMutation.isError && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Export failed</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {exportMutation.error?.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
