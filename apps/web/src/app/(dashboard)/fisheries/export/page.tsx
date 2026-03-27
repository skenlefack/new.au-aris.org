'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Fish,
  Ship,
  Warehouse,
  Anchor,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

interface ExportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  entity: string;
  color: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ExportCard({ title, description, icon, entity, color, t }: ExportCardProps) {
  const [format, setFormat] = useState('xlsx');
  const [year, setYear] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const token = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('aris-auth') ?? '{}')?.state?.accessToken
        : null;
      const params: Record<string, string> = { format };
      if (year) params.year = year;
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/fisheries/${entity}/export?${queryStr}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled silently, could add toast later
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">{t('exportFormat')}</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">{t('exportYear')}</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? '...' : t('downloadExport')}
        </button>
      </div>
    </div>
  );
}

export default function ExportPage() {
  const t = useTranslations('fisheries');
  const [fishStatJYear, setFishStatJYear] = useState('2025');
  const [fishStatJDownloading, setFishStatJDownloading] = useState(false);

  const handleFishStatJExport = async () => {
    setFishStatJDownloading(true);
    try {
      const token = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('aris-auth') ?? '{}')?.state?.accessToken
        : null;
      const queryStr = new URLSearchParams({ year: fishStatJYear }).toString();
      const res = await fetch(`${API_BASE}/fisheries/export/fishstatj?${queryStr}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('FishStatJ export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fishstatj_${fishStatJYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled silently
    } finally {
      setFishStatJDownloading(false);
    }
  };

  const entities = [
    {
      title: t('captures'),
      description: 'Marine & inland capture records',
      icon: <Fish className="h-5 w-5" />,
      entity: 'captures',
      color: 'bg-teal-100 text-teal-700',
    },
    {
      title: t('vesselRegistry'),
      description: 'Registered fishing vessels and license data',
      icon: <Ship className="h-5 w-5" />,
      entity: 'vessels',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      title: t('aquaFarms'),
      description: 'Aquaculture farm records and production data',
      icon: <Warehouse className="h-5 w-5" />,
      entity: 'aquaculture-farms',
      color: 'bg-green-100 text-green-700',
    },
    {
      title: t('aquaProduction'),
      description: 'Aquaculture production volumes',
      icon: <Anchor className="h-5 w-5" />,
      entity: 'production',
      color: 'bg-orange-100 text-orange-700',
    },
    {
      title: t('efforts'),
      description: 'Fishing effort records',
      icon: <Activity className="h-5 w-5" />,
      entity: 'efforts',
      color: 'bg-purple-100 text-purple-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/fisheries"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('export')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('exportDesc')}
          </p>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {entities.map((e) => (
          <ExportCard
            key={e.entity}
            title={e.title}
            description={e.description}
            icon={e.icon}
            entity={e.entity}
            color={e.color}
            t={t}
          />
        ))}
      </div>

      {/* FishStatJ special export */}
      <div className="rounded-card border-2 border-dashed border-teal-200 bg-teal-50/50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">{t('fishStatJ')}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('fishStatJDesc')}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">{t('exportYear')}</label>
            <select
              value={fishStatJYear}
              onChange={(e) => setFishStatJYear(e.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
          <button
            onClick={handleFishStatJExport}
            disabled={fishStatJDownloading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {fishStatJDownloading ? '...' : t('downloadExport')}
          </button>
        </div>
      </div>
    </div>
  );
}
