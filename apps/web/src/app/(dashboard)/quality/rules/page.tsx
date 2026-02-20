'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useQualityRules,
  useCreateQualityRule,
  useUpdateQualityRule,
  useDeleteQualityRule,
  type QualityRule,
  type CreateQualityRuleRequest,
} from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { TableSkeleton } from '@/components/ui/Skeleton';

const GATES = [
  'Completeness',
  'Temporal Consistency',
  'Geographic Consistency',
  'Codes & Vocabularies',
  'Units',
  'Deduplication',
  'Auditability',
  'Confidence Score',
];

const DOMAINS = [
  'Animal Health',
  'Livestock',
  'Fisheries',
  'Wildlife',
  'Apiculture',
  'Trade',
  'Governance',
  'Climate',
];

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'CONTINENTAL_ADMIN',
  'REC_ADMIN',
  'NATIONAL_ADMIN',
  'DATA_STEWARD',
];

export default function QualityRulesPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const [page, setPage] = useState(1);
  const [gateFilter, setGateFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQualityRules({
    page,
    limit: 20,
    gate: gateFilter || undefined,
    domain: domainFilter || undefined,
  });

  const updateRule = useUpdateQualityRule();
  const deleteRule = useDeleteQualityRule();

  const rules = data?.data ?? [];
  const meta = data?.meta;

  function handleToggleActive(rule: QualityRule) {
    updateRule.mutate({ id: rule.id, active: !rule.active });
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this rule? This action cannot be undone.')) {
      deleteRule.mutate(id);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/quality"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Quality Rules
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage custom data quality gate rules
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
            >
              <Plus className="h-4 w-4" />
              New Rule
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={gateFilter}
            onChange={(e) => {
              setGateFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All gates</option>
            {GATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Gate</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Active</th>
                {isAdmin && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{rule.name}</p>
                    <p className="text-xs text-gray-500">{rule.description}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{rule.gate}</td>
                  <td className="px-4 py-3 text-gray-600">{rule.domain}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        rule.severity === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {rule.severity.charAt(0).toUpperCase() +
                        rule.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className="text-gray-400 hover:text-gray-600"
                        title={rule.active ? 'Deactivate' : 'Activate'}
                      >
                        {rule.active ? (
                          <ToggleRight className="h-5 w-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          rule.active ? 'text-green-600' : 'text-gray-400',
                        )}
                      >
                        {rule.active ? 'Yes' : 'No'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No quality rules found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * meta.limit >= meta.total}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateRuleModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateRuleModal({ onClose }: { onClose: () => void }) {
  const createRule = useCreateQualityRule();
  const [form, setForm] = useState<CreateQualityRuleRequest>({
    name: '',
    description: '',
    gate: '',
    domain: '',
    expression: '',
    severity: 'error',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Rule name is required';
    if (!form.gate) newErrors.gate = 'Select a quality gate';
    if (!form.domain) newErrors.domain = 'Select a domain';
    if (!form.expression.trim())
      newErrors.expression = 'Expression is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createRule.mutateAsync(form);
      onClose();
    } catch {
      // handled by React Query
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-card border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Quality Rule
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rule Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Quality Gate *
              </label>
              <select
                value={form.gate}
                onChange={(e) => setForm({ ...form, gate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              >
                <option value="">Select gate...</option>
                {GATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.gate && (
                <p className="mt-1 text-xs text-red-600">{errors.gate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Domain *
              </label>
              <select
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              >
                <option value="">Select domain...</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {errors.domain && (
                <p className="mt-1 text-xs text-red-600">{errors.domain}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Expression *
            </label>
            <textarea
              value={form.expression}
              onChange={(e) =>
                setForm({ ...form, expression: e.target.value })
              }
              rows={3}
              placeholder='e.g. field("species_code") IN referential("species")'
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
            />
            {errors.expression && (
              <p className="mt-1 text-xs text-red-600">{errors.expression}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Severity
            </label>
            <div className="mt-1 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="severity"
                  value="error"
                  checked={form.severity === 'error'}
                  onChange={() => setForm({ ...form, severity: 'error' })}
                  className="text-aris-primary-600"
                />
                Error
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="severity"
                  value="warning"
                  checked={form.severity === 'warning'}
                  onChange={() => setForm({ ...form, severity: 'warning' })}
                  className="text-aris-primary-600"
                />
                Warning
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRule.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {createRule.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
