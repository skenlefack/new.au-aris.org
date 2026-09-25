'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronDown, ChevronRight, Plus, Pencil, Ban,
  KeyRound, Copy, GripVertical, Loader2, Search, Layers, Network,
} from 'lucide-react';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import {
  useSettingsDomains,
  useAccessLevels,
  useCreateAccessLevel,
  useUpdateAccessLevel,
  useDeactivateAccessLevel,
  useReorderAccessLevels,
  useCopyAccessLevels,
} from '@/lib/api/settings-hooks';
import { useDomainStore } from '@/lib/stores/domain-store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';

// ── Types ──

interface AccessLevel {
  id: string;
  nodeCode: string;
  code: string;
  labels: Record<string, string>;
  description?: Record<string, string> | null;
  sortOrder: number;
  isActive: boolean;
}

interface DomainInfo {
  id: string;
  code: string;
  name: Record<string, string>;
  icon?: string;
  color?: string;
  isActive: boolean;
}

interface SubDomainInfo {
  id: string;
  code: string;
  domainCode: string;
  labelFr: string;
  labelEn: string;
  labelAr?: string | null;
  labelPt?: string | null;
  active: boolean;
  displayOrder: number;
}

// ── Helpers ──

function nodeLabel(nodeCode: string, domains: DomainInfo[], subDomains: SubDomainInfo[], locale: string): string {
  const dotIdx = nodeCode.indexOf('.');
  if (dotIdx === -1) {
    const d = domains.find((dd) => dd.code === nodeCode);
    return d ? ((d.name as Record<string, string>)[locale] ?? d.name['en'] ?? nodeCode) : nodeCode;
  }
  const domCode = nodeCode.substring(0, dotIdx);
  const subCode = nodeCode.substring(dotIdx + 1);
  const sd = subDomains.find((s) => s.domainCode === domCode && s.code === subCode);
  if (!sd) return nodeCode;
  const key = `label${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof SubDomainInfo;
  return (sd[key] as string) ?? sd.labelEn ?? nodeCode;
}

function levelLabel(lvl: AccessLevel, locale: string): string {
  return lvl.labels[locale] ?? lvl.labels['en'] ?? lvl.code;
}

const EMPTY_FORM = { code: '', labels: { en: '', fr: '', ar: '', pt: '', es: '', sw: '' }, description: { en: '', fr: '', ar: '', pt: '', es: '', sw: '' }, sortOrder: 0 };

// ── Main Page ──

export default function AccessLevelsPage() {
  const { locale } = useLocaleStore();
  const { isSuperAdmin } = useSettingsAccess();
  const addToast = useRealtimeStore((s) => s.addToast);

  const { data: domainsRes, isLoading: loadingDomains } = useSettingsDomains();
  const { data: levelsRes, isLoading: loadingLevels } = useAccessLevels();
  const subDomainsMetadata = useDomainStore((s) => s.subDomainsMetadata);

  const domains: DomainInfo[] = domainsRes?.data ?? [];
  const allLevels: AccessLevel[] = levelsRes?.data ?? [];
  const subDomains: SubDomainInfo[] = subDomainsMetadata ?? [];

  // State
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copySource, setCopySource] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  // Mutations
  const createMut = useCreateAccessLevel();
  const updateMut = useUpdateAccessLevel();
  const deactivateMut = useDeactivateAccessLevel();
  const reorderMut = useReorderAccessLevels();
  const copyMut = useCopyAccessLevels();

  // Build tree nodes
  const treeNodes = useMemo(() => {
    const nodes: { nodeCode: string; label: string; type: 'domain' | 'subdomain'; domainCode: string; count: number }[] = [];
    for (const d of domains.filter((dd) => dd.isActive)) {
      const domainNodeCode = d.code;
      const domainCount = allLevels.filter((l) => l.nodeCode === domainNodeCode).length;
      nodes.push({ nodeCode: domainNodeCode, label: (d.name[locale] ?? d.name['en'] ?? d.code), type: 'domain', domainCode: d.code, count: domainCount });
      if (expandedDomains.has(d.code)) {
        const domSubs = subDomains.filter((s) => s.domainCode === d.code && s.active);
        for (const sd of domSubs.sort((a, b) => a.displayOrder - b.displayOrder)) {
          const subNodeCode = `${d.code}.${sd.code}`;
          const subCount = allLevels.filter((l) => l.nodeCode === subNodeCode).length;
          const key = `label${locale.charAt(0).toUpperCase()}${locale.slice(1)}` as keyof SubDomainInfo;
          nodes.push({ nodeCode: subNodeCode, label: (sd[key] as string) ?? sd.labelEn ?? sd.code, type: 'subdomain', domainCode: d.code, count: subCount });
        }
      }
    }
    return nodes;
  }, [domains, subDomains, expandedDomains, allLevels, locale]);

  // Levels for selected node
  const nodeLevels = useMemo(() => {
    if (!selectedNode) return [];
    return allLevels
      .filter((l) => l.nodeCode === selectedNode)
      .filter((l) => !searchQuery || levelLabel(l, locale).toLowerCase().includes(searchQuery.toLowerCase()) || l.code.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allLevels, selectedNode, searchQuery, locale]);

  const toggleDomain = (code: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  // CRUD handlers
  const handleCreate = async () => {
    if (!selectedNode || !form.code.trim()) return;
    try {
      await createMut.mutateAsync({ nodeCode: selectedNode, code: form.code.toUpperCase().replace(/\s+/g, '_'), labels: form.labels, description: form.description?.en ? form.description : null, sortOrder: form.sortOrder });
      setShowAddForm(false);
      setForm(EMPTY_FORM);
      addToast?.({ type: 'success', message: 'Access level created' });
    } catch (err: any) {
      addToast?.({ type: 'error', message: err?.message ?? 'Failed to create' });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateMut.mutateAsync({ id: editingId, labels: form.labels, description: form.description?.en ? form.description : null, sortOrder: form.sortOrder });
      setEditingId(null);
      setForm(EMPTY_FORM);
      addToast?.({ type: 'success', message: 'Access level updated' });
    } catch (err: any) {
      addToast?.({ type: 'error', message: err?.message ?? 'Failed to update' });
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingId) return;
    try {
      await deactivateMut.mutateAsync(deactivatingId);
      setDeactivatingId(null);
      addToast?.({ type: 'success', message: 'Access level deactivated' });
    } catch (err: any) {
      addToast?.({ type: 'error', message: err?.message ?? 'Failed to deactivate' });
    }
  };

  const handleMoveUp = async (level: AccessLevel, index: number) => {
    if (index === 0) return;
    const reordered = [...nodeLevels];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    await reorderMut.mutateAsync({ nodeCode: level.nodeCode, orderedIds: reordered.map((l) => l.id) });
  };

  const handleMoveDown = async (level: AccessLevel, index: number) => {
    if (index >= nodeLevels.length - 1) return;
    const reordered = [...nodeLevels];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    await reorderMut.mutateAsync({ nodeCode: level.nodeCode, orderedIds: reordered.map((l) => l.id) });
  };

  const handleCopy = async () => {
    if (!copySource || !selectedNode) return;
    try {
      const result = await copyMut.mutateAsync({ fromNodeCode: copySource, toNodeCode: selectedNode });
      setShowCopyDialog(false);
      setCopySource('');
      addToast?.({ type: 'success', message: `Copied ${(result as any)?.meta?.copied ?? 0} levels` });
    } catch (err: any) {
      addToast?.({ type: 'error', message: err?.message ?? 'Failed to copy' });
    }
  };

  const startEdit = (level: AccessLevel) => {
    setEditingId(level.id);
    setShowAddForm(false);
    setForm({
      code: level.code,
      labels: { en: level.labels.en ?? '', fr: level.labels.fr ?? '', ar: level.labels.ar ?? '', pt: level.labels.pt ?? '', es: (level.labels as Record<string, string>).es ?? '', sw: (level.labels as Record<string, string>).sw ?? '' },
      description: { en: level.description?.en ?? '', fr: level.description?.fr ?? '', ar: level.description?.ar ?? '', pt: level.description?.pt ?? '', es: (level.description as Record<string, string> | null)?.es ?? '', sw: (level.description as Record<string, string> | null)?.sw ?? '' },
      sortOrder: level.sortOrder,
    });
  };

  const isLoading = loadingDomains || loadingLevels;

  // Get available nodes for copy source (exclude current node)
  const copySourceNodes = treeNodes.filter((n) => n.nodeCode !== selectedNode && allLevels.some((l) => l.nodeCode === n.nodeCode && l.isActive));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/settings" className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Domain Access Levels</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {allLevels.length} level{allLevels.length !== 1 ? 's' : ''} across {new Set(allLevels.map((l) => l.nodeCode)).size} node{new Set(allLevels.map((l) => l.nodeCode)).size !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Tree */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Domains & Sub-domains</h2>
              <div className="space-y-0.5">
                {treeNodes.map((node) => (
                  <button
                    key={node.nodeCode}
                    onClick={() => {
                      if (node.type === 'domain') toggleDomain(node.domainCode);
                      setSelectedNode(node.nodeCode);
                      setShowAddForm(false);
                      setEditingId(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedNode === node.nodeCode
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    } ${node.type === 'subdomain' ? 'ml-5' : ''}`}
                  >
                    {node.type === 'domain' ? (
                      expandedDomains.has(node.domainCode) ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                    )}
                    {node.type === 'domain' ? <Layers className="h-3.5 w-3.5 shrink-0 opacity-60" /> : <Network className="h-3 w-3 shrink-0 opacity-40" />}
                    <span className="truncate">{node.label}</span>
                    {node.count > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        {node.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Level list */}
          <div className="lg:col-span-8">
            {!selectedNode ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-20 dark:border-gray-600">
                <KeyRound className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a domain or sub-domain to manage its access levels</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                {/* Node header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {nodeLabel(selectedNode, domains, subDomains, locale)}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{selectedNode}</p>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      {copySourceNodes.length > 0 && (
                        <button onClick={() => setShowCopyDialog(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
                          <Copy className="h-3.5 w-3.5" /> Copy from...
                        </button>
                      )}
                      <button
                        onClick={() => { setShowAddForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Level
                      </button>
                    </div>
                  )}
                </div>

                {/* Search */}
                {nodeLevels.length > 3 && (
                  <div className="border-b border-gray-100 px-5 py-2 dark:border-gray-800">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search levels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border-0 bg-gray-50 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:ring-1 focus:ring-amber-500 dark:bg-gray-800 dark:text-gray-200"
                      />
                    </div>
                  </div>
                )}

                {/* Add form */}
                {showAddForm && (
                  <div className="border-b border-amber-100 bg-amber-50/30 px-5 py-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                    <LevelForm
                      form={form}
                      setForm={setForm}
                      onSubmit={handleCreate}
                      onCancel={() => setShowAddForm(false)}
                      isLoading={createMut.isPending}
                      isNew
                    />
                  </div>
                )}

                {/* Level list */}
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {nodeLevels.length === 0 && !showAddForm ? (
                    <div className="flex flex-col items-center py-12">
                      <KeyRound className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No access levels defined for this node</p>
                      {isSuperAdmin && (
                        <button onClick={() => { setShowAddForm(true); setForm(EMPTY_FORM); }} className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                          + Add the first level
                        </button>
                      )}
                    </div>
                  ) : (
                    nodeLevels.map((level, idx) =>
                      editingId === level.id ? (
                        <div key={level.id} className="bg-blue-50/30 px-5 py-4 dark:bg-blue-900/10">
                          <LevelForm
                            form={form}
                            setForm={setForm}
                            onSubmit={handleUpdate}
                            onCancel={() => { setEditingId(null); setForm(EMPTY_FORM); }}
                            isLoading={updateMut.isPending}
                            isNew={false}
                          />
                        </div>
                      ) : (
                        <div key={level.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                          <GripVertical className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">{levelLabel(level, locale)}</span>
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 dark:bg-gray-700 dark:text-gray-400">{level.code}</span>
                              {!level.isActive && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">Inactive</span>
                              )}
                            </div>
                            {level.description?.[locale] && (
                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{level.description[locale]}</p>
                            )}
                          </div>
                          {isSuperAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleMoveUp(level, idx)} disabled={idx === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700">
                                <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                              </button>
                              <button onClick={() => handleMoveDown(level, idx)} disabled={idx === nodeLevels.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => startEdit(level)} className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {level.isActive && (
                                <button onClick={() => setDeactivatingId(level.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                                  <Ban className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      <ConfirmDialog
        open={!!deactivatingId}
        title="Deactivate Access Level"
        message="This level will no longer appear in forms, but existing assignments will remain. This action cannot be undone."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateMut.isPending}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivatingId(null)}
      />

      {/* Copy dialog */}
      {showCopyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Copy levels from another node</h3>
            <select
              value={copySource}
              onChange={(e) => setCopySource(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Select source node...</option>
              {copySourceNodes.map((n) => (
                <option key={n.nodeCode} value={n.nodeCode}>{n.label} ({n.count})</option>
              ))}
            </select>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Levels that already exist on the target node (same code) will be skipped. Copies are independent.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCopyDialog(false); setCopySource(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleCopy} disabled={!copySource || copyMut.isPending} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {copyMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Level Form Component ──

function LevelForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  isLoading,
  isNew,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isNew: boolean;
}) {
  const hasRequiredLabels = !!(form.labels.en && form.labels.fr);

  return (
    <div className="space-y-4">
      {isNew && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Code (immutable)</label>
          <input
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
            placeholder="FIELD_LEVEL"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
      )}

      <MultilingualInput
        label="Label"
        value={form.labels}
        onChange={(labels) => setForm((prev) => ({ ...prev, labels: { ...prev.labels, ...labels } }))}
        required
        placeholder="Access level name..."
      />

      <MultilingualTextarea
        label="Description"
        value={form.description ?? {}}
        onChange={(description) => setForm((prev) => ({ ...prev, description: { ...prev.description, ...description } }))}
        placeholder="Short description (optional)..."
        rows={2}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isLoading || !hasRequiredLabels || (isNew && !form.code)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          {isNew ? 'Create' : 'Save'}
        </button>
      </div>
    </div>
  );
}
