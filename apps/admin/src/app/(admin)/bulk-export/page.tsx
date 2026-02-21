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
import { useBulkExport, useTenants } from '@/lib/api/hooks';

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

  const { data: tenantsData } = useTenants({ limit: 200 });
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
        <h1 className="text-2xl font-bold text-admin-heading">Bulk Export</h1>
        <p className="text-sm text-admin-muted mt-1">
          Export entity data as CSV files from any service
        </p>
      </div>

      {/* Export Form */}
      <div className="admin-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary-900/30">
            <FileSpreadsheet className="w-5 h-5 text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-admin-heading">
            Export Configuration
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-admin-muted mb-1">
              Service
            </label>
            <select
              value={service}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="admin-input w-full"
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
            <label className="block text-xs font-medium text-admin-muted mb-1">
              Entity Type
            </label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="admin-input w-full"
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
            <label className="block text-xs font-medium text-admin-muted mb-1">
              Tenant (optional)
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="admin-input w-full"
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
            <label className="block text-xs font-medium text-admin-muted mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              From Date (optional)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="admin-input w-full"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-admin-muted mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              To Date (optional)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="admin-input w-full"
            />
          </div>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={!canExport || exportMutation.isPending}
            className="admin-btn-primary flex items-center gap-2 disabled:opacity-50"
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
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-status-healthy" />
            <div>
              <p className="text-sm font-medium text-admin-text">
                Export completed successfully
              </p>
              <p className="text-xs text-admin-muted mt-0.5">
                Your CSV file has been downloaded: {service}-{entity}-
                {new Date().toISOString().slice(0, 10)}.csv
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {exportMutation.isError && (
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-status-down" />
            <div>
              <p className="text-sm font-medium text-status-down">Export failed</p>
              <p className="text-xs text-admin-muted mt-0.5">
                {exportMutation.error?.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
