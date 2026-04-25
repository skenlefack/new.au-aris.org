'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useCreateSubDomain,
  useAllDomains,
  useAllValueChainCodes,
} from '@/lib/api/sub-domain-hooks';
import type { SubDomainType } from '@/lib/stores/domain-store';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import { Loader2, ArrowLeft, Check } from 'lucide-react';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN']);

const TYPE_OPTIONS: { value: SubDomainType; label: string; desc: string }[] = [
  { value: 'VALUE_CHAIN', label: 'Chaine de valeur', desc: 'Filiere economique (Dairy, Red Meat...)' },
  { value: 'ORGANIZATIONAL', label: 'Organisationnel', desc: 'Structure institutionnelle (Cliniques, Labos...)' },
  { value: 'PATHOLOGY', label: 'Pathologie', desc: 'Maladie specifique (PPR, FMD, ASF...)' },
  { value: 'OTHER', label: 'Autre', desc: 'Classification libre' },
];

const CODE_REGEX = /^[A-Z][A-Z0-9_]*$/;

export default function NewSubDomainPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <SubDomainForm />;
}

function SubDomainForm() {
  const router = useRouter();
  const addToast = useRealtimeStore((s) => s.addToast);
  const createMutation = useCreateSubDomain();
  const { data: domainsData } = useAllDomains();
  const { data: vcData } = useAllValueChainCodes();

  const domains = domainsData?.data ?? [];
  const valueChainCodes = vcData?.data ?? [];

  const [code, setCode] = useState('');
  const [domainCode, setDomainCode] = useState('');
  const [typeEnum, setTypeEnum] = useState<SubDomainType>('VALUE_CHAIN');
  const [valueChainCode, setValueChainCode] = useState('');
  const [labelFr, setLabelFr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelPt, setLabelPt] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Le code est requis.';
    else if (!CODE_REGEX.test(code)) e.code = 'Format: UPPERCASE_SNAKE_CASE (ex: DAIRY, RED_MEAT).';
    if (!domainCode) e.domainCode = 'Le domaine parent est requis.';
    if (!labelFr.trim()) e.labelFr = 'Le label FR est requis.';
    if (!labelEn.trim()) e.labelEn = 'Le label EN est requis.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createMutation.mutateAsync({
        code: code.trim(),
        domainCode,
        typeEnum,
        valueChainCode: typeEnum === 'VALUE_CHAIN' && valueChainCode ? valueChainCode : null,
        labelFr: labelFr.trim(),
        labelEn: labelEn.trim(),
        labelAr: labelAr.trim() || null,
        labelPt: labelPt.trim() || null,
        displayOrder,
        active,
        description: description.trim() || null,
      });
      addToast({ type: 'success', title: 'Sous-domaine cree', message: `${code} a ete cree avec succes.` });
      router.push('/settings/sub-domains');
    } catch (err: any) {
      if (err?.errors?.length) {
        const fieldErrors: Record<string, string> = {};
        for (const fe of err.errors) fieldErrors[fe.field] = fe.message;
        setErrors(fieldErrors);
      }
      addToast({ type: 'error', title: 'Erreur', message: err?.message || 'Erreur lors de la creation.' });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings/sub-domains"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau sous-domaine</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Creer un nouveau sous-domaine dans le systeme ARIS.</p>
        </div>
      </div>

      {/* Full-width Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {/* Row 1: Code + Domain */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Code <span className="text-red-500">*</span>
            </label>
            <input type="text" name="code" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="DAIRY, RED_MEAT, CLINICS..."
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
                errors.code ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'
              }`} />
            {errors.code && <p className="text-xs text-red-600">{errors.code}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Domaine parent <span className="text-red-500">*</span>
            </label>
            <select name="domainCode" value={domainCode} onChange={(e) => setDomainCode(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
                errors.domainCode ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'
              }`}>
              <option value="">-- Selectionner un domaine --</option>
              {domains.map((d) => <option key={d.code} value={d.code}>{d.name?.en ?? d.code}</option>)}
            </select>
            {errors.domainCode && <p className="text-xs text-red-600">{errors.domainCode}</p>}
          </div>
        </div>

        {/* Row 2: Type (radio grid) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TYPE_OPTIONS.map((opt) => (
              <label key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  typeEnum === opt.value
                    ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
                }`}>
                <input type="radio" name="typeEnum" value={opt.value} checked={typeEnum === opt.value}
                  onChange={() => { setTypeEnum(opt.value); if (opt.value !== 'VALUE_CHAIN') setValueChainCode(''); }}
                  className="mt-0.5 accent-[#1F4E79]" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Row 3: Value Chain + Display Order + Active */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Code chaine de valeur <span className="text-xs text-gray-400">(optionnel)</span>
            </label>
            <select name="valueChainCode" value={valueChainCode} onChange={(e) => setValueChainCode(e.target.value)}
              disabled={typeEnum !== 'VALUE_CHAIN'}
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
          <div className="flex items-end gap-3 pb-1">
            <button type="button" onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">{active ? 'Actif' : 'Inactif'}</span>
          </div>
        </div>

        {/* Row 4: Labels (4 cols) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label FR <span className="text-red-500">*</span></label>
            <input type="text" name="labelFr" value={labelFr} onChange={(e) => setLabelFr(e.target.value)} placeholder="Ex: Produits laitiers"
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
                errors.labelFr ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
            {errors.labelFr && <p className="text-xs text-red-600">{errors.labelFr}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label EN <span className="text-red-500">*</span></label>
            <input type="text" name="labelEn" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Ex: Dairy"
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
                errors.labelEn ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
            {errors.labelEn && <p className="text-xs text-red-600">{errors.labelEn}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label AR <span className="text-xs text-gray-400">(optionnel)</span></label>
            <input type="text" name="labelAr" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label PT <span className="text-xs text-gray-400">(optionnel)</span></label>
            <input type="text" name="labelPt" value={labelPt} onChange={(e) => setLabelPt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
        </div>

        {/* Row 5: Description (full width) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description <span className="text-xs text-gray-400">(optionnel)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description du sous-domaine..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Link href="/settings/sub-domains"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Annuler
          </Link>
          <button type="submit" disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Creer
          </button>
        </div>
      </form>
    </div>
  );
}
