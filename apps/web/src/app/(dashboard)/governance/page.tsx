'use client';

import React from 'react';
import Link from 'next/link';
import {
  Landmark,
  Scale,
  Users,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';

const PLACEHOLDER_KPIS = {
  legalFrameworks: 342,
  frameworksTrend: 3.8,
  pvsEvaluations: 48,
  pvsTrend: 2.1,
  stakeholders: 1_520,
  stakeholdersTrend: 5.6,
  capacityPrograms: 86,
  capacityTrend: 8.3,
};

const PLACEHOLDER_PVS_SCORES = [
  { competency: 'Legislation', score: 3.2 },
  { competency: 'Labs', score: 3.8 },
  { competency: 'Risk Analysis', score: 2.9 },
  { competency: 'Quarantine', score: 3.1 },
  { competency: 'Surveillance', score: 3.5 },
  { competency: 'Disease Control', score: 3.4 },
  { competency: 'Food Safety', score: 2.7 },
  { competency: 'Vet Education', score: 3.0 },
];

const ALERT_FIELDS: AlertField[] = [
  { name: 'country', label: 'Country', type: 'text', placeholder: 'e.g. Kenya', required: true },
  { name: 'frameworkType', label: 'Framework Type', type: 'select', required: true, options: ['Legislation', 'Policy', 'Regulation', 'Standard', 'Guideline'] },
  { name: 'issue', label: 'Issue', type: 'text', placeholder: 'e.g. Outdated veterinary act', required: true },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the governance issue...' },
];

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
      <TrendingUp className="h-3 w-3" />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
      <TrendingDown className="h-3 w-3" />{value}%
    </span>
  );
  return <span className="text-xs text-gray-400">0%</span>;
}

export default function GovernancePage() {
  const kpis = PLACEHOLDER_KPIS;
  const pvsScores = PLACEHOLDER_PVS_SCORES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Governance & Capacities
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Legal frameworks, PVS evaluations, stakeholders, and capacity building
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Legal Frameworks</p>
            <Scale className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.legalFrameworks}
          </p>
          <TrendIndicator value={kpis.frameworksTrend} />
        </div>

        <div className="rounded-card border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-800 dark:bg-indigo-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">PVS Evaluations</p>
            <Landmark className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-700 dark:text-indigo-400">
            {kpis.pvsEvaluations}
          </p>
          <TrendIndicator value={kpis.pvsTrend} />
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Stakeholders</p>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.stakeholders.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.stakeholdersTrend} />
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Capacity Programs</p>
            <GraduationCap className="h-5 w-5 text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.capacityPrograms}
          </p>
          <TrendIndicator value={kpis.capacityTrend} />
        </div>
      </div>

      {/* PVS Scores Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Average PVS Scores by Competency
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental average on WOAH PVS Pathway (scale 1-5)
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pvsScores} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis dataKey="competency" type="category" width={110} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} formatter={(value: number) => [`${value.toFixed(1)} / 5.0`]} />
              <Bar dataKey="score" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href="/governance/legal-frameworks"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Legal Frameworks</p>
              <p className="text-xs text-gray-400">Laws & regulations</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-indigo-600" />
        </Link>

        <Link
          href="/governance/pvs"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">PVS Evaluations</p>
              <p className="text-xs text-gray-400">WOAH PVS Pathway</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-indigo-600" />
        </Link>

        <Link
          href="/governance/stakeholders"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stakeholders</p>
              <p className="text-xs text-gray-400">Partners & actors</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-600" />
        </Link>

        <Link
          href="/governance/capacity"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-green-200 hover:bg-green-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-800 dark:hover:bg-green-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Capacity</p>
              <p className="text-xs text-gray-400">Training programs</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-green-600" />
        </Link>
      </div>

      {/* Campaigns & Alert */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DomainCampaignsSection domain="governance" />
        <QuickAlertCard domain="governance" alertFields={ALERT_FIELDS} title="Report Governance Issue" />
      </div>
    </div>
  );
}
