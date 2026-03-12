'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileCheck,
  ShoppingCart,
  ArrowRightLeft,
  ShieldCheck,
  Store,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const TradeBalanceChart = dynamic(() => import('./TradeBalanceChart'), { ssr: false });
import {
  useTradeKpis,
  useTradeBalance,
  type TradeKpis,
  type TradeBalancePoint,
} from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const TRADE_ALERT_FIELDS: AlertField[] = [
  { name: 'commodity', label: 'Commodity', type: 'text', placeholder: 'e.g. Livestock', required: true },
  { name: 'direction', label: 'Direction', type: 'select', required: true, options: ['Export', 'Import', 'Transit'] },
  { name: 'issue', label: 'Issue', type: 'select', required: true, options: ['SPS Non-Compliance', 'Border Delay', 'Documentation', 'Quota Exceeded', 'Price Anomaly', 'Other'] },
  { name: 'country', label: 'Country', type: 'text', placeholder: 'e.g. Kenya', required: true },
];

const PLACEHOLDER_KPIS: TradeKpis['data'] = {
  totalExports: 4_820_000_000,
  exportsTrend: 8.3,
  totalImports: 5_130_000_000,
  importsTrend: 4.1,
  spsComplianceRate: 91.6,
  complianceTrend: 2.4,
  activeCertificates: 1_247,
  marketsTracked: 342,
};

const PLACEHOLDER_BALANCE: TradeBalancePoint[] = [
  { period: 'Q1 2025', exports: 720_000_000, imports: 810_000_000, balance: -90_000_000 },
  { period: 'Q2 2025', exports: 780_000_000, imports: 850_000_000, balance: -70_000_000 },
  { period: 'Q3 2025', exports: 830_000_000, imports: 870_000_000, balance: -40_000_000 },
  { period: 'Q4 2025', exports: 860_000_000, imports: 890_000_000, balance: -30_000_000 },
  { period: 'Q1 2026', exports: 810_000_000, imports: 860_000_000, balance: -50_000_000 },
  { period: 'Q2 2026', exports: 820_000_000, imports: 850_000_000, balance: -30_000_000 },
];

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function TradePage() {
  const {
    data: kpiData,
    isLoading: kpiLoading,
    isError: kpiError,
    error: kpiErr,
    refetch: refetchKpis,
  } = useTradeKpis();

  const {
    data: balanceData,
    isLoading: balanceLoading,
  } = useTradeBalance();

  const { sections } = useDomainConfig('trade-sps');
  const kpis = { ...PLACEHOLDER_KPIS, ...kpiData?.data };
  const balancePoints = balanceData?.data?.length ? balanceData.data : PLACEHOLDER_BALANCE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trade & SPS</h1>
          <p className="mt-1 text-sm text-gray-500">
            Intra-African trade flows, SPS certification, and market intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/trade/flows"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Trade Flows
          </Link>
          <Link
            href="/trade/sps"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ShieldCheck className="h-4 w-4" />
            SPS Certificates
          </Link>
          <Link
            href="/trade/markets"
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-aris-primary-700"
          >
            <Store className="h-4 w-4" />
            Market Prices
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {sections.kpis && (kpiError ? (
        <QueryError
          message={kpiErr instanceof Error ? kpiErr.message : 'Failed to load KPIs'}
          onRetry={() => refetchKpis()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpiLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-card border border-gray-200 bg-white p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-24" />
                <Skeleton className="mt-2 h-4 w-16" />
              </div>
            ))
          ) : (
            <>
              <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-400">Total Exports</p>
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                </div>
                <p className="mt-2 text-xl font-bold text-gray-900">
                  {formatUsd(kpis.totalExports)}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {kpis.exportsTrend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      kpis.exportsTrend >= 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {kpis.exportsTrend >= 0 ? '+' : ''}
                    {kpis.exportsTrend}%
                  </span>
                  <span className="text-xs text-gray-400">vs last period</span>
                </div>
              </div>

              <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-400">Total Imports</p>
                  <ShoppingCart className="h-4 w-4 text-orange-500" />
                </div>
                <p className="mt-2 text-xl font-bold text-gray-900">
                  {formatUsd(kpis.totalImports)}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {kpis.importsTrend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      kpis.importsTrend >= 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {kpis.importsTrend >= 0 ? '+' : ''}
                    {kpis.importsTrend}%
                  </span>
                  <span className="text-xs text-gray-400">vs last period</span>
                </div>
              </div>

              <div className="rounded-card border border-green-200 bg-green-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-green-600">SPS Compliance Rate</p>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="mt-2 text-xl font-bold text-green-700">
                  {kpis.spsComplianceRate}%
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {kpis.complianceTrend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      kpis.complianceTrend >= 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {kpis.complianceTrend >= 0 ? '+' : ''}
                    {kpis.complianceTrend}%
                  </span>
                </div>
              </div>

              <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-400">Active Certificates</p>
                  <FileCheck className="h-4 w-4 text-blue-500" />
                </div>
                <p className="mt-2 text-xl font-bold text-gray-900">
                  {kpis.activeCertificates.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {kpis.marketsTracked} markets tracked
                </p>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Trade Balance Chart */}
      {sections.chart && <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Trade Balance — Animal Resources (Quarterly)
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental exports vs imports and trade balance trend
        </p>
        {balanceLoading ? (
          <Skeleton className="mt-4 h-72 w-full" />
        ) : (
          <div className="mt-4 h-72">
            <TradeBalanceChart data={balancePoints} />
          </div>
        )}
      </div>}

      {/* Quick Links */}
      {sections.quickLinks && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/trade/flows"
          className="group rounded-card border border-gray-200 bg-white p-5 transition hover:border-aris-primary-300 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <ArrowRightLeft className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-aris-primary-600">
                Trade Flows
              </p>
              <p className="text-xs text-gray-400">
                Export/import records, HS codes, directions
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/trade/sps"
          className="group rounded-card border border-gray-200 bg-white p-5 transition hover:border-aris-primary-300 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-aris-primary-600">
                SPS Certificates
              </p>
              <p className="text-xs text-gray-400">
                Inspections, certifications, compliance
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/trade/markets"
          className="group rounded-card border border-gray-200 bg-white p-5 transition hover:border-aris-primary-300 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Store className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-aris-primary-600">
                Market Prices
              </p>
              <p className="text-xs text-gray-400">
                Price intelligence, commodities, trends
              </p>
            </div>
          </div>
        </Link>
      </div>}

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="trade_sps" />}
          {sections.alertForm && <QuickAlertCard domain="trade_sps" alertFields={TRADE_ALERT_FIELDS} title="Report Trade Issue" />}
        </div>
      )}
    </div>
  );
}
