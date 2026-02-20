'use client';

import { useState, useRef } from 'react';
import {
  Database,
  Search,
  Upload,
  Download,
  Globe,
  Bug,
  FlaskConical,
  Ruler,
} from 'lucide-react';
import { useMasterDataItems, useUpdateMasterDataItem } from '@/lib/api/hooks';
import type { MasterDataItem } from '@/lib/api/hooks';

const DATA_TYPES = [
  { key: 'countries', label: 'Countries', icon: <Globe className="w-4 h-4" /> },
  { key: 'species', label: 'Species', icon: <Bug className="w-4 h-4" /> },
  { key: 'diseases', label: 'Diseases', icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'units', label: 'Units', icon: <Ruler className="w-4 h-4" /> },
];

export default function MasterDataPage() {
  const [activeType, setActiveType] = useState('countries');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useMasterDataItems(activeType, {
    page,
    limit: 25,
    search: search || undefined,
  });
  const updateMutation = useUpdateMasterDataItem();

  const items = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25 };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = ['id', 'code', 'name', 'isActive', 'updatedAt'];
    const rows = items.map((item) =>
      [item.id, item.code, item.name, String(item.isActive), item.updatedAt].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-data-${activeType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map((h) => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? '';
        });

        if (row['id']) {
          updateMutation.mutate({
            type: activeType,
            id: row['id'],
            name: row['name'],
            code: row['code'],
          } as never);
        }
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleActive = (item: MasterDataItem) => {
    updateMutation.mutate({
      type: activeType,
      id: item.id,
      isActive: !item.isActive,
    } as never);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">
          Master Data Administration
        </h1>
        <p className="text-sm text-admin-muted mt-1">
          Manage referential data — countries, species, diseases, units
        </p>
      </div>

      {/* Type Tabs */}
      <div className="flex items-center gap-2">
        {DATA_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => {
              setActiveType(type.key);
              setPage(1);
              setSearch('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeType === type.key
                ? 'bg-primary-900/50 text-primary-400 border border-primary-800/50'
                : 'text-admin-muted hover:text-admin-text hover:bg-admin-hover'
            }`}
          >
            {type.icon}
            {type.label}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input w-full pl-10"
            placeholder={`Search ${activeType}...`}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCsv}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="admin-btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="admin-btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="admin-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Code
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Name
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-admin-muted px-4 py-3">
                Last Updated
              </th>
              <th className="text-right text-xs font-medium text-admin-muted px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border/50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-admin-surface rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-admin-border/50 hover:bg-admin-hover transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-admin-text">
                    {item.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-text">
                    {item.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.isActive
                          ? 'bg-status-healthy/10 text-status-healthy'
                          : 'bg-status-down/10 text-status-down'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-muted">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`text-xs px-3 py-1 rounded ${
                        item.isActive
                          ? 'admin-btn-secondary'
                          : 'admin-btn-primary'
                      }`}
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-admin-muted"
                >
                  <Database className="w-8 h-8 mx-auto mb-2 text-admin-border" />
                  No {activeType} found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
            <span className="text-xs text-admin-muted">
              Page {meta.page} of {Math.ceil(meta.total / meta.limit)} ({meta.total} items)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="admin-btn-secondary text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(meta.total / meta.limit)}
                className="admin-btn-secondary text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
