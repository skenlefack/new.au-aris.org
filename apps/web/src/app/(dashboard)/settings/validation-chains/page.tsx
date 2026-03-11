'use client';

import React, { useState } from 'react';
import {
  Link2,
  Plus,
  Trash2,
  Search,
  Users,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useValidationChains,
  useCreateValidationChain,
  useUpdateValidationChain,
  useDeleteValidationChain,
} from '@/lib/api/workflow-hooks';
import { SearchCombobox } from '@/components/ui/SearchCombobox';
import { useSettingsUsers, type ManagedUser } from '@/lib/api/settings-hooks';

const LEVEL_TYPES = ['admin5', 'admin4', 'admin3', 'admin2', 'admin1', 'national', 'regional', 'continental'];

const LEVEL_COLORS: Record<string, string> = {
  admin5: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  admin4: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  admin3: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  admin2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  admin1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  national: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  regional: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  continental: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function ValidationChainsPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Fetch all records — backend caps at 100/page, so fetch 2 pages to cover ~116 chains
  const { data: chainsP1, isLoading: p1Loading } = useValidationChains({ page: 1, limit: 100 });
  const { data: chainsP2, isLoading: p2Loading } = useValidationChains({ page: 2, limit: 100 });
  const isLoading = p1Loading || p2Loading;
  const deleteMut = useDeleteValidationChain();

  const chains = [...(chainsP1?.data ?? []), ...(chainsP2?.data ?? [])];
  const searched = search
    ? chains.filter((c: any) => {
        const q = search.toLowerCase();
        const userName = (c.user?.displayName ?? c.user?.email ?? '').toLowerCase();
        const userEmail = (c.user?.email ?? '').toLowerCase();
        const validatorName = (c.validator?.displayName ?? c.validator?.email ?? '').toLowerCase();
        const validatorEmail = (c.validator?.email ?? '').toLowerCase();
        return userName.includes(q) || userEmail.includes(q)
          || validatorName.includes(q) || validatorEmail.includes(q);
      })
    : chains;
  const allFiltered = filterLevel
    ? searched.filter((c: any) => c.levelType === filterLevel)
    : searched;
  const totalFiltered = allFiltered.length;
  const filtered = allFiltered.slice((page - 1) * limit, page * limit);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this validation chain?')) return;
    await deleteMut.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Validation Chains</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Define who validates whom at each level of the hierarchy
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Chain
        </button>
      </div>

      {showCreate && (
        <CreateChainForm onClose={() => setShowCreate(false)} />
      )}

      {/* Search + Filter bar */}
      <div className="space-y-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by user or validator..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setFilterLevel(''); setPage(1); }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !filterLevel
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
            )}
          >
            All
          </button>
          {LEVEL_TYPES.map((lt) => (
            <button
              key={lt}
              onClick={() => { setFilterLevel(lt === filterLevel ? '' : lt); setPage(1); }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filterLevel === lt
                  ? LEVEL_COLORS[lt]
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {lt}
            </button>
          ))}
        </div>
      </div>

      {/* Chain list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <Link2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            No validation chains found
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create chains to define the validator hierarchy.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chain: any) => (
            <div
              key={chain.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3"
            >
              {/* User */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Users className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {chain.user?.displayName ?? chain.user?.email ?? chain.userId?.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{chain.user?.email}</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>

              {/* Validator */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {chain.validator?.displayName ?? chain.validator?.email ?? chain.validatorId?.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{chain.validator?.email}</p>
                </div>
              </div>

              {/* Level & Priority */}
              <div className="flex items-center gap-2">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  LEVEL_COLORS[chain.levelType] ?? 'bg-gray-100 text-gray-600',
                )}>
                  {chain.levelType}
                </span>
                <span className="text-xs text-gray-500">P{chain.priority}</span>
              </div>

              {/* Backup */}
              {chain.backupValidator && (
                <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500">
                  <span className="text-gray-400">Backup:</span>
                  {chain.backupValidator.displayName ?? chain.backupValidator.email}
                </div>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(chain.id)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Pagination
            page={page}
            total={totalFiltered}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Create Chain Form ── */

const userLabel = (u: ManagedUser) =>
  u.firstName && u.lastName ? `${u.firstName} ${u.lastName} (${u.email})` : u.email;

const userFilter = (u: ManagedUser) =>
  `${u.firstName} ${u.lastName} ${u.email} ${u.role}`;

function CreateChainForm({ onClose }: { onClose: () => void }) {
  const createMut = useCreateValidationChain();
  const { data: usersRes, isLoading: usersLoading } = useSettingsUsers({ limit: 100 });
  const users = usersRes?.data ?? [];

  const [form, setForm] = useState<{
    user: ManagedUser | null;
    validator: ManagedUser | null;
    backupValidator: ManagedUser | null;
    priority: number;
    levelType: string;
  }>({
    user: null,
    validator: null,
    backupValidator: null,
    priority: 1,
    levelType: 'national',
  });

  const handleCreate = async () => {
    if (!form.user || !form.validator) return;
    await createMut.mutateAsync({
      userId: form.user.id,
      validatorId: form.validator.id,
      backupValidatorId: form.backupValidator?.id ?? undefined,
      priority: form.priority,
      levelType: form.levelType,
    });
    onClose();
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Validation Chain</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-600">User (submitter)</label>
          <SearchCombobox<ManagedUser>
            value={form.user}
            onChange={(u) => setForm((s) => ({ ...s, user: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder="Search user..."
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Validator</label>
          <SearchCombobox<ManagedUser>
            value={form.validator}
            onChange={(u) => setForm((s) => ({ ...s, validator: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder="Search validator..."
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Backup Validator (optional)</label>
          <SearchCombobox<ManagedUser>
            value={form.backupValidator}
            onChange={(u) => setForm((s) => ({ ...s, backupValidator: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder="Search backup..."
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Level Type</label>
          <select
            value={form.levelType}
            onChange={(e) => setForm((s) => ({ ...s, levelType: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          >
            {LEVEL_TYPES.map((lt) => (
              <option key={lt} value={lt}>{lt}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Priority (1-3)</label>
          <input
            type="number"
            min={1}
            max={3}
            value={form.priority}
            onChange={(e) => setForm((s) => ({ ...s, priority: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!form.user || !form.validator || createMut.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMut.isPending ? 'Creating...' : 'Create Chain'}
        </button>
      </div>
    </div>
  );
}
