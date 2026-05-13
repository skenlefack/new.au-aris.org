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
  Edit3,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
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

const LEVEL_TYPES = ['national', 'regional', 'continental', 'admin1', 'admin2', 'admin3', 'admin4', 'admin5'];

const LEVEL_COLORS: Record<string, string> = {
  continental: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  regional: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  national: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  admin2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  admin3: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  admin4: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  admin5: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const LEVEL_LABELS: Record<string, { en: string; fr: string }> = {
  continental: { en: 'Continental', fr: 'Continental' },
  regional: { en: 'Regional (REC)', fr: 'Régional (CER)' },
  national: { en: 'National', fr: 'National' },
  admin1: { en: 'Admin 1 (Province)', fr: 'Admin 1 (Province)' },
  admin2: { en: 'Admin 2 (District)', fr: 'Admin 2 (District)' },
  admin3: { en: 'Admin 3 (Commune)', fr: 'Admin 3 (Commune)' },
  admin4: { en: 'Admin 4 (Village)', fr: 'Admin 4 (Village)' },
  admin5: { en: 'Admin 5 (Locality)', fr: 'Admin 5 (Localité)' },
};

function levelLabel(lt: string, locale: string): string {
  return LEVEL_LABELS[lt]?.[locale === 'fr' ? 'fr' : 'en'] ?? lt;
}

const userLabel = (u: ManagedUser) =>
  u.firstName && u.lastName ? `${u.firstName} ${u.lastName} (${u.email})` : u.email;
const userFilter = (u: ManagedUser) =>
  `${u.firstName} ${u.lastName} ${u.email} ${u.role}`;
function userDisplayName(u?: { displayName?: string; email?: string }) {
  if (!u) return '—';
  return u.displayName?.trim() || u.email || '—';
}

export default function ValidationChainsPage() {
  const t = useTranslations('settings');
  const locale = useLocaleStore((s) => s.locale);
  const isFr = locale === 'fr';
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: chainsData, isLoading } = useValidationChains({ page, limit });
  const deleteMut = useDeleteValidationChain();

  const chains = chainsData?.data ?? [];
  const total = chainsData?.meta?.total ?? 0;

  // Client-side search + filter on current page
  const displayed = chains.filter((c: any) => {
    if (filterLevel && c.levelType !== filterLevel) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        (c.user?.displayName ?? '').toLowerCase().includes(q) ||
        (c.user?.email ?? '').toLowerCase().includes(q) ||
        (c.validator?.displayName ?? '').toLowerCase().includes(q) ||
        (c.validator?.email ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    await deleteMut.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('validationChainsTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('validationChainsDesc')}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? (isFr ? 'Fermer' : 'Close') : t('newChain')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateChainForm onClose={() => setShowCreate(false)} locale={locale} />
      )}

      {/* Search + Level filter */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchByUserOrValidator')}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterLevel('')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !filterLevel ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200',
            )}
          >
            {t('all')} ({total})
          </button>
          {LEVEL_TYPES.map((lt) => (
            <button
              key={lt}
              onClick={() => setFilterLevel(lt === filterLevel ? '' : lt)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filterLevel === lt ? LEVEL_COLORS[lt] : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200',
              )}
            >
              {levelLabel(lt, locale)}
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
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <Link2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">{t('noValidationChains')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('noValidationChainsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_40px_1fr_120px_60px_80px] gap-4 px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <span>{t('userSubmitter')}</span>
            <span />
            <span>{t('validator')}</span>
            <span>{isFr ? 'Niveau' : 'Level'}</span>
            <span>{isFr ? 'Priorité' : 'Priority'}</span>
            <span>{isFr ? 'Actions' : 'Actions'}</span>
          </div>

          {displayed.map((chain: any) => (
            editingId === chain.id ? (
              <EditChainRow
                key={chain.id}
                chain={chain}
                locale={locale}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <div
                key={chain.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_40px_1fr_120px_60px_80px] gap-3 md:gap-4 items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3"
              >
                {/* User */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                    <Users className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userDisplayName(chain.user)}</p>
                    <p className="text-[10px] text-gray-500 truncate">{chain.user?.email}</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex justify-center">
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>

                {/* Validator */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userDisplayName(chain.validator)}</p>
                    <p className="text-[10px] text-gray-500 truncate">{chain.validator?.email}</p>
                    {chain.backupValidator && (
                      <p className="text-[10px] text-amber-600 truncate">
                        Backup: {userDisplayName(chain.backupValidator)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Level */}
                <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium text-center w-fit', LEVEL_COLORS[chain.levelType] ?? 'bg-gray-100 text-gray-600')}>
                  {levelLabel(chain.levelType, locale)}
                </span>

                {/* Priority */}
                <span className="text-xs text-gray-500 text-center">P{chain.priority}</span>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => setEditingId(chain.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                    title={isFr ? 'Modifier' : 'Edit'}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirmId === chain.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(chain.id)}
                        disabled={deleteMut.isPending}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={isFr ? 'Confirmer' : 'Confirm'}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                        title={isFr ? 'Annuler' : 'Cancel'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(chain.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      title={isFr ? 'Supprimer' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          ))}

          <Pagination
            page={page}
            total={search || filterLevel ? displayed.length : total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Edit Chain Row ── */

function EditChainRow({
  chain,
  locale,
  onCancel,
  onSaved,
}: {
  chain: any;
  locale: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isFr = locale === 'fr';
  const updateMut = useUpdateValidationChain();
  const { data: usersRes, isLoading: usersLoading } = useSettingsUsers({ limit: 200 });
  const users = usersRes?.data ?? [];

  const [validatorUser, setValidatorUser] = useState<ManagedUser | null>(
    users.find((u) => u.id === chain.validatorId) ?? null,
  );
  const [backupUser, setBackupUser] = useState<ManagedUser | null>(
    users.find((u) => u.id === chain.backupValidatorId) ?? null,
  );
  const [editLevel, setEditLevel] = useState(chain.levelType);
  const [editPriority, setEditPriority] = useState(chain.priority);

  // Update validator selection when users load
  React.useEffect(() => {
    if (users.length > 0 && !validatorUser) {
      setValidatorUser(users.find((u) => u.id === chain.validatorId) ?? null);
    }
    if (users.length > 0 && !backupUser && chain.backupValidatorId) {
      setBackupUser(users.find((u) => u.id === chain.backupValidatorId) ?? null);
    }
  }, [users, chain.validatorId, chain.backupValidatorId]);

  const handleSave = async () => {
    await updateMut.mutateAsync({
      id: chain.id,
      validatorId: validatorUser?.id ?? chain.validatorId,
      backupValidatorId: backupUser?.id ?? null,
      levelType: editLevel,
      priority: editPriority,
    });
    onSaved();
  };

  return (
    <div className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-600">
          {isFr ? 'Modification' : 'Editing'}: {userDisplayName(chain.user)}
        </span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase">{isFr ? 'Validateur' : 'Validator'}</label>
          <SearchCombobox<ManagedUser>
            value={validatorUser}
            onChange={setValidatorUser}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder={isFr ? 'Rechercher...' : 'Search...'}
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase">{isFr ? 'Validateur backup' : 'Backup validator'}</label>
          <SearchCombobox<ManagedUser>
            value={backupUser}
            onChange={setBackupUser}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder={isFr ? 'Optionnel...' : 'Optional...'}
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase">{isFr ? 'Niveau' : 'Level'}</label>
          <select
            value={editLevel}
            onChange={(e) => setEditLevel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm"
          >
            {LEVEL_TYPES.map((lt) => (
              <option key={lt} value={lt}>{levelLabel(lt, locale)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase">{isFr ? 'Priorité' : 'Priority'}</label>
          <input
            type="number"
            min={1}
            max={10}
            value={editPriority}
            onChange={(e) => setEditPriority(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
          {isFr ? 'Annuler' : 'Cancel'}
        </button>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {updateMut.isPending ? '...' : (isFr ? 'Enregistrer' : 'Save')}
        </button>
      </div>
    </div>
  );
}

/* ── Create Chain Form ── */

function CreateChainForm({ onClose, locale }: { onClose: () => void; locale: string }) {
  const t = useTranslations('settings');
  const isFr = locale === 'fr';
  const createMut = useCreateValidationChain();
  const { data: usersRes, isLoading: usersLoading } = useSettingsUsers({ limit: 200 });
  const users = usersRes?.data ?? [];
  const [error, setError] = useState('');

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
    setError('');
    if (!form.user || !form.validator) {
      setError(isFr ? 'Sélectionnez un utilisateur et un validateur' : 'Select a user and a validator');
      return;
    }
    if (form.user.id === form.validator.id) {
      setError(isFr ? 'L\'utilisateur et le validateur doivent être différents' : 'User and validator must be different');
      return;
    }
    try {
      await createMut.mutateAsync({
        userId: form.user.id,
        validatorId: form.validator.id,
        backupValidatorId: form.backupValidator?.id ?? undefined,
        priority: form.priority,
        levelType: form.levelType,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || err?.toString() || 'Error';
      if (msg.includes('Unique') || msg.includes('unique') || msg.includes('409')) {
        setError(isFr ? 'Cette chaîne existe déjà (même utilisateur + niveau)' : 'This chain already exists (same user + level)');
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('newValidationChain')}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('userSubmitter')} <span className="text-red-500">*</span>
          </label>
          <SearchCombobox<ManagedUser>
            value={form.user}
            onChange={(u) => setForm((s) => ({ ...s, user: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder={t('searchUser')}
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('validator')} <span className="text-red-500">*</span>
          </label>
          <SearchCombobox<ManagedUser>
            value={form.validator}
            onChange={(u) => setForm((s) => ({ ...s, validator: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder={t('searchValidator')}
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('backupValidator')}</label>
          <SearchCombobox<ManagedUser>
            value={form.backupValidator}
            onChange={(u) => setForm((s) => ({ ...s, backupValidator: u }))}
            items={users}
            labelKey={userLabel}
            filterKey={userFilter}
            placeholder={t('searchBackup')}
            loading={usersLoading}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('levelType')}</label>
          <select
            value={form.levelType}
            onChange={(e) => setForm((s) => ({ ...s, levelType: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm"
          >
            {LEVEL_TYPES.map((lt) => (
              <option key={lt} value={lt}>{levelLabel(lt, locale)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('priorityLabel')}</label>
          <input
            type="number"
            min={1}
            max={10}
            value={form.priority}
            onChange={(e) => setForm((s) => ({ ...s, priority: Number(e.target.value) }))}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
          {t('cancel')}
        </button>
        <button
          onClick={handleCreate}
          disabled={!form.user || !form.validator || createMut.isPending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMut.isPending ? '...' : (isFr ? 'Créer la chaîne' : 'Create chain')}
        </button>
      </div>
    </div>
  );
}
