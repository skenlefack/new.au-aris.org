'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useAdminSubDomain,
  useUpdateSubDomain,
  useDeleteSubDomain,
  useAllDomains,
  useAllValueChainCodes,
} from '@/lib/api/sub-domain-hooks';
import type { SubDomainType } from '@/lib/stores/domain-store';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import {
  Loader2,
  ArrowLeft,
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  Power,
  PowerOff,
  Info,
} from 'lucide-react';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN']);

const TYPE_BADGES: Record<SubDomainType, { bg: string; text: string; label: string }> = {
  VALUE_CHAIN: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Value Chain' },
  ORGANIZATIONAL: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Organizational' },
  PATHOLOGY: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Pathology' },
  OTHER: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Other' },
};

const TYPE_OPTIONS: { value: SubDomainType; label: string; desc: string }[] = [
  { value: 'VALUE_CHAIN', label: 'Chaine de valeur', desc: 'Filiere economique' },
  { value: 'ORGANIZATIONAL', label: 'Organisationnel', desc: 'Structure institutionnelle' },
  { value: 'PATHOLOGY', label: 'Pathologie', desc: 'Maladie specifique' },
  { value: 'OTHER', label: 'Autre', desc: 'Classification libre' },
];

export default function SubDomainDetailPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <SubDomainDetail />;
}

function SubDomainDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const addToast = useRealtimeStore((s) => s.addToast);

  const { data, isLoading, error } = useAdminSubDomain(id);
  const { data: domainsData } = useAllDomains();
  const { data: vcData } = useAllValueChainCodes();
  const updateMutation = useUpdateSubDomain();
  const deleteMutation = useDeleteSubDomain();

  const domains = domainsData?.data ?? [];
  const valueChainCodes = vcData?.data ?? [];
  const sd = data?.data;

  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [labelFr, setLabelFr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelPt, setLabelPt] = useState('');
  const [typeEnum, setTypeEnum] = useState<SubDomainType>('VALUE_CHAIN');
  const [valueChainCode, setValueChainCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sd) {
      setLabelFr(sd.labelFr);
      setLabelEn(sd.labelEn);
      setLabelAr(sd.labelAr ?? '');
      setLabelPt(sd.labelPt ?? '');
      setTypeEnum(sd.typeEnum);
      setValueChainCode(sd.valueChainCode ?? '');
      setDisplayOrder(sd.displayOrder);
      setDescription(sd.description ?? '');
    }
  }, [sd]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!labelFr.trim()) e.labelFr = 'Le label FR est requis.';
    if (!labelEn.trim()) e.labelEn = 'Le label EN est requis.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await updateMutation.mutateAsync({
        id, labelFr: labelFr.trim(), labelEn: labelEn.trim(),
        labelAr: labelAr.trim() || null, labelPt: labelPt.trim() || null,
        typeEnum, valueChainCode: typeEnum === 'VALUE_CHAIN' && valueChainCode ? valueChainCode : null,
        displayOrder, description: description.trim() || null,
      });
      addToast({ type: 'success', title: 'Mis a jour', message: `${sd?.code} a ete modifie avec succes.` });
      setEditing(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: err?.message || 'Impossible de sauvegarder.' });
    }
  };

  const handleToggleActive = async () => {
    if (!sd) return;
    try {
      await updateMutation.mutateAsync({ id, active: !sd.active });
      addToast({ type: 'success', title: sd.active ? 'Desactive' : 'Active', message: `${sd.code} a ete ${sd.active ? 'desactive' : 'active'}.` });
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de modifier le statut.' });
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ type: 'success', title: 'Supprime', message: 'Sous-domaine supprime.' });
      router.push('/settings/sub-domains');
    } catch (err: any) {
      if (err?.statusCode === 409) {
        setDeleteError(err.message || 'Ce sous-domaine est utilise par des entites existantes.');
      } else {
        addToast({ type: 'error', title: 'Erreur', message: 'Impossible de supprimer.' });
        setShowDeleteModal(false);
      }
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  if (error || !sd) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Sous-domaine non trouve.</p>
        <Link href="/settings/sub-domains" className="mt-4 inline-block text-sm text-[#1F4E79] hover:underline">Retour a la liste</Link>
      </div>
    );
  }

  const badge = TYPE_BADGES[sd.typeEnum] ?? TYPE_BADGES.OTHER;
  const parentDomain = domains.find((d) => d.code === sd.domainCode);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/sub-domains"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sd.code}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                sd.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>{sd.active ? 'Actif' : 'Inactif'}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{sd.labelFr} &mdash; {parentDomain?.name?.en ?? sd.domainCode}</p>
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <Pencil className="h-3.5 w-3.5" /> Editer
            </button>
            <button type="button" onClick={handleToggleActive} disabled={updateMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sd.active ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400'
              }`}>
              {sd.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              {sd.active ? 'Desactiver' : 'Activer'}
            </button>
            <button type="button" onClick={() => { setShowDeleteModal(true); setDeleteError(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400">
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {editing ? (
          <div className="space-y-6 p-6">
            {/* Info banner */}
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              <Info className="h-4 w-4 shrink-0" />
              Le code (<strong>{sd.code}</strong>) et le domaine parent ne peuvent pas etre modifies.
            </div>

            {/* Type + Value Chain + Order (3 cols) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                <select value={typeEnum} onChange={(e) => { setTypeEnum(e.target.value as SubDomainType); if (e.target.value !== 'VALUE_CHAIN') setValueChainCode(''); }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code chaine de valeur</label>
                <select value={valueChainCode} onChange={(e) => setValueChainCode(e.target.value)} disabled={typeEnum !== 'VALUE_CHAIN'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  <option value="">-- Aucun --</option>
                  {valueChainCodes.map((vc) => <option key={vc.code} value={vc.code}>{vc.labelFr || vc.labelEn} ({vc.code})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ordre d'affichage</label>
                <input type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
            </div>

            {/* Labels (4 cols) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label FR *</label>
                <input type="text" value={labelFr} onChange={(e) => setLabelFr(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${errors.labelFr ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
                {errors.labelFr && <p className="text-xs text-red-600">{errors.labelFr}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label EN *</label>
                <input type="text" value={labelEn} onChange={(e) => setLabelEn(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${errors.labelEn ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
                {errors.labelEn && <p className="text-xs text-red-600">{errors.labelEn}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label AR</label>
                <input type="text" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label PT</label>
                <input type="text" value={labelPt} onChange={(e) => setLabelPt(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Annuler
              </button>
              <button type="button" onClick={handleSave} disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Sauvegarder
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <DetailRow label="Code" value={sd.code} mono />
            <DetailRow label="Domaine parent" value={parentDomain?.name?.en ?? sd.domainCode} />
            <DetailRow label="Type">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
            </DetailRow>
            {sd.valueChainCode && (
              <DetailRow label="Chaine de valeur">
                <span className="inline-flex rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C9A227]">{sd.valueChainCode}</span>
              </DetailRow>
            )}
            <DetailRow label="Label FR" value={sd.labelFr} />
            <DetailRow label="Label EN" value={sd.labelEn} />
            {sd.labelAr && <DetailRow label="Label AR" value={sd.labelAr} dir="rtl" />}
            {sd.labelPt && <DetailRow label="Label PT" value={sd.labelPt} />}
            <DetailRow label="Ordre d'affichage" value={String(sd.displayOrder)} />
            <DetailRow label="Statut">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                sd.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>{sd.active ? 'Actif' : 'Inactif'}</span>
            </DetailRow>
            {sd.description && <DetailRow label="Description" value={sd.description} />}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Supprimer le sous-domaine</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Voulez-vous vraiment supprimer <strong>{sd.code}</strong> ({sd.labelFr}) ?
                </p>
                {deleteError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{deleteError}</div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Annuler
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, dir, children }: {
  label: string; value?: string; mono?: boolean; dir?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-3">
      <span className="w-40 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1">
        {children ?? (
          <span className={`text-sm text-gray-900 dark:text-white ${mono ? 'rounded bg-gray-100 px-2 py-0.5 font-mono dark:bg-gray-700' : ''}`} dir={dir}>{value}</span>
        )}
      </div>
    </div>
  );
}
