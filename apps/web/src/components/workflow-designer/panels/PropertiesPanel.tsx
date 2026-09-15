'use client';

import React, { useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  X,
  Trash2,
  Copy,
  ArrowRightLeft,
  Pencil,
  ShieldCheck,
  Users,
  Timer,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import type { StepData, EdgeData, EdgeKind } from '../types';
import { asStep, asEdge, mlDisplay } from '../types';
import { ROLES, ROLE_I18N_KEYS, LEVEL_CONFIG, EDGE_STYLES, NODE_CATALOG } from '../constants';

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDuplicate,
  onClose,
}: {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, data: Partial<StepData>) => void;
  onUpdateEdge: (id: string, data: Partial<EdgeData>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workflow');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true, permissions: true, timing: false, roles: false,
  });

  const toggleSection = (key: string) => setExpandedSections((s) => ({ ...s, [key]: !s[key] }));

  if (!selectedNode && !selectedEdge) return null;

  // ── Edge Properties ──
  if (selectedEdge) {
    const d = asEdge(selectedEdge.data);
    return (
      <div className="w-[420px] rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('designer.connection')}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.edgeType')}</label>
            <select
              value={d.edgeType ?? 'SEQUENTIAL'}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { edgeType: e.target.value as EdgeKind })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(EDGE_STYLES).map(([key, val]) => (
                <option key={key} value={key}>{t(`designer.${val.i18nKey}`)}</option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-0.5 w-8 rounded" style={{ backgroundColor: EDGE_STYLES[d.edgeType ?? 'SEQUENTIAL'].color }} />
              <span className="text-[9px] text-gray-400">
                {d.edgeType === 'PARALLEL' && t('designer.parallelDesc')}
                {d.edgeType === 'CHOICE_SINGLE' && t('designer.choiceSingleDesc')}
                {d.edgeType === 'CHOICE_MULTI' && t('designer.choiceMultiDesc')}
                {(d.edgeType === 'SEQUENTIAL' || !d.edgeType) && t('designer.seqDesc')}
              </span>
            </div>
          </div>
          <MultilingualInput
            label={t('designer.labelEn').replace(' (EN)', '')}
            value={d.label ?? {}}
            onChange={(val) => onUpdateEdge(selectedEdge.id, { label: val })}
          />
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.condition')}</label>
            <textarea
              value={d.condition ?? ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { condition: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder='e.g. status === "confirmed"'
            />
            <p className="mt-1 text-[9px] text-gray-400">{t('designer.conditionHint')}</p>
          </div>
          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t('designer.deleteConnection')}
          </button>
        </div>
      </div>
    );
  }

  // ── Node Properties ──
  if (selectedNode) {
    const d = asStep(selectedNode.data);
    const isStart = d.nodeType === 'start';
    const isEnd = d.nodeType === 'end';
    const isStep = d.nodeType === 'step';
    const isDecision = d.nodeType === 'decision';
    const isForkJoin = d.nodeType === 'fork' || d.nodeType === 'join';
    const isNotification = d.nodeType === 'notification';
    const showFullProps = isStep || isDecision;

    const nodeLabel = t(`designer.${NODE_CATALOG.find((n) => n.type === d.nodeType)?.i18nKey ?? d.nodeType}`);
    const nodeIcon = NODE_CATALOG.find((n) => n.type === d.nodeType)?.icon;

    // Section header component
    const SectionHeader = ({ id, title, icon }: { id: string; title: string; icon: React.ReactNode }) => (
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
      >
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        {expandedSections[id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    );

    return (
      <div className="w-[420px] rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            {nodeIcon}
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{nodeLabel}</h3>
          </div>
          <div className="flex items-center gap-1">
            {!isStart && (
              <button
                onClick={() => onDuplicate(selectedNode.id)}
                className="rounded-md p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title={t('designer.duplicate')}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
          {/* ── General Section ── */}
          <SectionHeader id="general" title={t('designer.general')} icon={<Info className="h-3 w-3" />} />
          {expandedSections.general && (
            <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.key')}</label>
                <input
                  value={d.stepKey}
                  onChange={(e) => onUpdateNode(selectedNode.id, { stepKey: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  readOnly={isStart}
                />
              </div>
              <MultilingualInput
                label={t('designer.nameEn').replace(' (EN)', '')}
                value={d.name ?? {}}
                onChange={(val) => onUpdateNode(selectedNode.id, { name: val })}
              />
              {(showFullProps || isNotification || isForkJoin) && (
                <MultilingualInput
                  label={t('designer.descriptionEn').replace(' (EN)', '')}
                  value={d.description ?? {}}
                  onChange={(val) => onUpdateNode(selectedNode.id, { description: val })}
                  placeholder={t('designer.descPlaceholder')}
                />
              )}
              {showFullProps && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.levelType')}</label>
                  <select
                    value={d.levelType}
                    onChange={(e) => onUpdateNode(selectedNode.id, { levelType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(LEVEL_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{t(`designer.${val.i18nKey}`)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Permissions Section ── */}
          {showFullProps && (
            <>
              <SectionHeader id="permissions" title={t('designer.permissions')} icon={<ShieldCheck className="h-3 w-3" />} />
              {expandedSections.permissions && (
                <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.canEdit}
                        onChange={(e) => onUpdateNode(selectedNode.id, { canEdit: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Pencil className="h-3 w-3 text-blue-500" /> {t('designer.canEdit')}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.canValidate}
                        onChange={(e) => onUpdateNode(selectedNode.id, { canValidate: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <ShieldCheck className="h-3 w-3 text-green-500" /> {t('designer.canValidate')}
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.mergeStrategy')}</label>
                    <div className="mt-1.5 flex gap-2">
                      {(['ALL', 'ANY'] as const).map((val) => (
                        <button
                          key={val}
                          onClick={() => onUpdateNode(selectedNode.id, { mergeStrategy: val })}
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                            d.mergeStrategy === val
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600',
                          )}
                        >
                          <div className="font-bold">{val}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            {val === 'ALL' ? t('designer.waitAllBranches') : t('designer.firstBranchUnlocks')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Timing Section ── */}
          {(showFullProps || isNotification) && (
            <>
              <SectionHeader id="timing" title={t('designer.timingSla')} icon={<Timer className="h-3 w-3" />} />
              {expandedSections.timing && (
                <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.slaHours')}</label>
                      <input
                        type="number"
                        min={0}
                        value={d.slaHours ?? ''}
                        onChange={(e) => onUpdateNode(selectedNode.id, { slaHours: e.target.value ? Number(e.target.value) : null })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                        placeholder="48"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.autoTransmitHours')}</label>
                      <input
                        type="number"
                        min={0}
                        value={d.transmitDelayHours ?? ''}
                        onChange={(e) => onUpdateNode(selectedNode.id, { transmitDelayHours: e.target.value ? Number(e.target.value) : null })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                        placeholder="72"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 flex items-center gap-1">
                    <Info className="h-3 w-3" /> {t('designer.slaHint')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Roles Section ── */}
          {showFullProps && (
            <>
              <SectionHeader id="roles" title={`${t('designer.allowedRoles')} (${d.allowedRoles?.length || 0})`} icon={<Users className="h-3 w-3" />} />
              {expandedSections.roles && (
                <div className="space-y-1 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] text-gray-400 mb-2">{t('designer.rolesEmpty')}</p>
                  <div className="grid grid-cols-1 gap-0.5 max-h-[200px] overflow-y-auto">
                    {ROLES.map((role) => {
                      const checked = d.allowedRoles?.includes(role);
                      return (
                        <label
                          key={role}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] cursor-pointer transition',
                            checked ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const roles = d.allowedRoles ?? [];
                              const next = e.target.checked
                                ? [...roles, role]
                                : roles.filter((r) => r !== role);
                              onUpdateNode(selectedNode.id, { allowedRoles: next });
                            }}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-3 w-3"
                          />
                          {t(`designer.${ROLE_I18N_KEYS[role] ?? role}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Join merge strategy */}
          {d.nodeType === 'join' && (
            <div className="pb-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('designer.mergeStrategy')}</label>
              <div className="mt-1.5 flex gap-2">
                {(['ALL', 'ANY'] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => onUpdateNode(selectedNode.id, { mergeStrategy: val })}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                      d.mergeStrategy === val
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600',
                    )}
                  >
                    {val === 'ALL' ? t('designer.waitAll') : t('designer.firstWins')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Delete */}
        {!isStart && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={() => onDeleteNode(selectedNode.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t('designer.deleteNode', { type: nodeLabel })}
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
