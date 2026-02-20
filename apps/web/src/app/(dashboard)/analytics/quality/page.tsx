'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Database,
  Layers,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useQualityDrilldown } from '@/lib/api/hooks';
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

const DOMAIN_OPTIONS = [
  { value: '', label: 'All Domains' },
  { value: 'Animal Health', label: 'Animal Health' },
  { value: 'Livestock', label: 'Livestock' },
  { value: 'Fisheries', label: 'Fisheries' },
  { value: 'Trade', label: 'Trade' },
  { value: 'Wildlife', label: 'Wildlife' },
  { value: 'Governance', label: 'Governance' },
];

const GATE_OPTIONS = [
  { value: '', label: 'All Gates' },
  { value: 'Completeness', label: 'Completeness' },
  { value: 'Temporal Consistency', label: 'Temporal Consistency' },
  { value: 'Geographic Consistency', label: 'Geographic Consistency' },
  { value: 'Codes & Vocabularies', label: 'Codes & Vocabularies' },
  { value: 'Units', label: 'Units' },
  { value: 'Deduplication', label: 'Deduplication' },
  { value: 'Auditability', label: 'Auditability' },
  { value: 'Confidence Score', label: 'Confidence Score' },
];

const TENANT_OPTIONS = [
  { value: '', label: 'All Tenants' },
  { value: 'au', label: 'AU-IBAR' },
  { value: 'igad', label: 'IGAD' },
  { value: 'ecowas', label: 'ECOWAS' },
  { value: 'sadc', label: 'SADC' },
  { value: 'eac', label: 'EAC' },
];

export default function QualityDrilldownPage() {
  const [domain, setDomain] = useState('');
  const [gate, setGate] = useState('');
  const [tenant, setTenant] = useState('');

  const { data, isLoading } = useQualityDrilldown({
    domain: domain || undefined,
    gate: gate || undefined,
    tenant: tenant || undefined,
  });

  const rows = data?.data ?? [];

  // Compute summary stats
  const summaryStats = useMemo(() => {
    if (!rows.length) return null;

    const totalRecords = rows.reduce((acc, r) => acc + r.totalRecords, 0);
    const totalPassed = rows.reduce((acc, r) => acc + r.passed, 0);
    const overallPassRate = totalRecords > 0 ? (totalPassed / totalRecords) * 100 : 0;
    const uniqueDomains = new Set(rows.map((r) => r.domain)).size;

    return {
      overallPassRate,
      domainsAnalyzed: uniqueDomains,
      totalRecords,
    };
  }, [rows]);

  // Aggregate chart data: stacked bar per domain
  const chartData = useMemo(() => {
    const domainMap = new Map<string, { domain: string; passed: number; failed: number; warnings: number }>();

    rows.forEach((r) => {
      const existing = domainMap.get(r.domain);
      if (existing) {
        existing.passed += r.passed;
        existing.failed += r.failed;
        existing.warnings += r.warnings;
      } else {
        domainMap.set(r.domain, {
          domain: r.domain,
          passed: r.passed,
          failed: r.failed,
          warnings: r.warnings,
        });
      }
    });

    return Array.from(domainMap.values());
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Metrics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Drill-down into data quality gate results by domain
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
        >
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
        >
          {GATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
        >
          {TENANT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : summaryStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Overall Pass Rate */}
          <div
            className={cn(
              'rounded-card border p-card shadow-sm',
              summaryStats.overallPassRate >= 95
                ? 'border-green-200 bg-green-50'
                : summaryStats.overallPassRate >= 90
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50',
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Overall Pass Rate
              </span>
              <ShieldCheck
                className={cn(
                  'h-5 w-5',
                  summaryStats.overallPassRate >= 95
                    ? 'text-green-600'
                    : summaryStats.overallPassRate >= 90
                      ? 'text-amber-600'
                      : 'text-red-600',
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-kpi text-gray-900">
                {summaryStats.overallPassRate.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          {/* Domains Analyzed */}
          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Domains Analyzed
              </span>
              <Layers className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {summaryStats.domainsAnalyzed}
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {rows.length} gate results
            </div>
          </div>

          {/* Total Records */}
          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                Total Records Evaluated
              </span>
              <Database className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {summaryStats.totalRecords.toLocaleString()}
            </div>
          </div>
        </div>
      ) : null}

      {/* Stacked Bar Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Pass / Fail / Warning by Domain
        </h3>
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#1B5E20]" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center">
            <p className="text-sm text-gray-400">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="domain"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }} />
              <Bar dataKey="passed" name="Passed" stackId="a" fill="#1B5E20" radius={[0, 0, 0, 0]} />
              <Bar dataKey="warnings" name="Warnings" stackId="a" fill="#F59E0B" />
              <Bar dataKey="failed" name="Failed" stackId="a" fill="#C62828" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detail Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Quality Gate Results ({rows.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Gate</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Passed</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-right">Warnings</th>
                  <th className="px-4 py-3 text-right">Pass Rate</th>
                  <th className="px-4 py-3 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={`${row.domain}-${row.gate}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.domain}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.gate}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.totalRecords.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {row.passed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {row.failed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600">
                      {row.warnings.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.passRate >= 95
                            ? 'bg-green-100 text-green-700'
                            : row.passRate >= 90
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700',
                        )}
                      >
                        {row.passRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-medium',
                          row.trend > 0
                            ? 'text-green-700'
                            : row.trend < 0
                              ? 'text-red-700'
                              : 'text-gray-500',
                        )}
                      >
                        {row.trend > 0 && <TrendingUp className="h-3 w-3" />}
                        {row.trend < 0 && <TrendingDown className="h-3 w-3" />}
                        {row.trend > 0 ? '+' : ''}
                        {row.trend.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No quality gate data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
