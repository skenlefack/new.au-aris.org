'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Upload, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { getFieldTypeDefinition, MASTER_DATA_TYPES } from '../utils/field-types';
import type { FormField, FormSection, MultilingualText, FieldCondition, FieldConditionRule } from '../utils/form-schema';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { generateCodeFromLabel } from '../utils/code-generator';
import { useTranslateToAll } from '@/lib/api/translation-hooks';

type Tab = 'general' | 'validation' | 'data-source' | 'conditions' | 'appearance';

const TAB_KEYS: { key: Tab; tKey: string }[] = [
  { key: 'general', tKey: 'fbTabGeneral' },
  { key: 'validation', tKey: 'fbTabValidation' },
  { key: 'data-source', tKey: 'fbTabData' },
  { key: 'conditions', tKey: 'fbTabConditions' },
  { key: 'appearance', tKey: 'fbTabLayout' },
];

// ---- Multilingual inline input with Auto-Translate ----
const LANGS = ['en', 'fr', 'pt', 'ar', 'es', 'sw'] as const;

function MLInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: MultilingualText;
  onChange: (v: MultilingualText) => void;
  placeholder?: string;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const userLang = (locale?.slice(0, 2) || 'en') as typeof LANGS[number];
  const defaultLang = LANGS.includes(userLang as any) ? userLang : 'en';
  const [lang, setLang] = useState<'en' | 'fr' | 'pt' | 'ar'>(defaultLang as any);
  const translateMut = useTranslateToAll();
  const translatingRef = React.useRef(false);

  const sourceLang = LANGS.find((l) => value[l]?.trim()) || lang;
  const sourceText = value[sourceLang]?.trim();
  const otherLangs = LANGS.filter((l) => l !== sourceLang);
  const emptyLangs = otherLangs.filter((l) => !value[l]?.trim());
  const canTranslate = !!sourceText && otherLangs.length > 0;

  const handleAutoTranslate = async (forceAll = false) => {
    const targets = forceAll ? [...otherLangs] : [...emptyLangs];
    if (!sourceText || targets.length === 0 || translatingRef.current) return;
    translatingRef.current = true;
    try {
      const results = await translateMut.mutateAsync({
        source: sourceLang,
        text: sourceText,
        targets,
      });
      onChange({ ...value, ...results });
    } catch {
      // Silently fail
    } finally {
      translatingRef.current = false;
    }
  };

  // Auto-translate on blur (empty langs only)
  const handleBlur = () => {
    if (sourceText && emptyLangs.length > 0) handleAutoTranslate(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
        {translateMut.isPending && (
          <span className="flex items-center gap-1 text-[10px] text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Traduction...
          </span>
        )}
        {canTranslate && !translateMut.isPending && (
          <button
            type="button"
            onClick={() => handleAutoTranslate(emptyLangs.length === 0)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
            title={emptyLangs.length > 0 ? 'Translate empty languages' : 'Re-translate all languages'}
          >
            <Wand2 className="h-3 w-3" />
            {emptyLangs.length > 0 ? 'Traduire' : 'Re-traduire'}
          </button>
        )}
      </div>
      <div className="flex gap-0.5 mb-1">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase relative',
              lang === l
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {l}
            <span className={cn(
              'absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full',
              value[l]?.trim() ? 'bg-green-400' : 'bg-red-300',
            )} />
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value[lang] ?? ''}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        onBlur={handleBlur}
        placeholder={placeholder}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
}

// ---- Buffered text input (local state, commits on blur/Enter) ----
function BufferedInput({ value, onCommit, placeholder, className }: {
  value: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const ref = React.useRef<HTMLInputElement>(null);

  // Sync from parent only when the parent value truly changes (e.g. reorder/delete)
  React.useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit(local); ref.current?.blur(); } }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ---- Matrix Config Editor ----
function MatrixConfigEditor({
  rows,
  columns,
  cellType,
  showTotals,
  onChange,
  locale,
}: {
  rows: Array<{ label: MultilingualText; key: string }>;
  columns: Array<{ label: MultilingualText; key: string }>;
  cellType: string;
  showTotals: boolean;
  onChange: (props: Record<string, unknown>) => void;
  locale: string;
}) {
  const isFr = locale === 'fr';

  const addItem = (type: 'rows' | 'columns') => {
    const list = type === 'rows' ? rows : columns;
    const prefix = type === 'rows' ? 'row' : 'col';
    const idx = list.length + 1;
    const newItem = { key: `${prefix}_${idx}`, label: { en: '', fr: '' } };
    onChange({ [type]: [...list, newItem] });
  };

  const removeItem = (type: 'rows' | 'columns', idx: number) => {
    const list = type === 'rows' ? [...rows] : [...columns];
    list.splice(idx, 1);
    onChange({ [type]: list });
  };

  const updateItem = (type: 'rows' | 'columns', idx: number, label: string) => {
    const list = type === 'rows' ? [...rows] : [...columns];
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || list[idx].key;
    list[idx] = { ...list[idx], key, label: { ...list[idx].label, [locale]: label, en: list[idx].label.en || label } };
    onChange({ [type]: list });
  };

  const moveItem = (type: 'rows' | 'columns', idx: number, dir: -1 | 1) => {
    const list = type === 'rows' ? [...rows] : [...columns];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    onChange({ [type]: list });
  };

  const renderList = (type: 'rows' | 'columns', items: Array<{ label: MultilingualText; key: string }>) => (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={item.key} className="flex items-center gap-1">
          <div className="flex flex-col">
            <button type="button" onClick={() => moveItem(type, idx, -1)} disabled={idx === 0}
              className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none">▲</button>
            <button type="button" onClick={() => moveItem(type, idx, 1)} disabled={idx === items.length - 1}
              className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none">▼</button>
          </div>
          <BufferedInput
            value={item.label[locale] || item.label.en || ''}
            onCommit={(val) => updateItem(type, idx, val)}
            placeholder={`${type === 'rows' ? (isFr ? 'Ligne' : 'Row') : (isFr ? 'Colonne' : 'Column')} ${idx + 1}`}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button type="button" onClick={() => removeItem(type, idx)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addItem(type)}
        className="flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:hover:border-blue-500 w-full justify-center"
      >
        <Plus className="h-3 w-3" />
        {type === 'rows' ? (isFr ? 'Ajouter une ligne' : 'Add row') : (isFr ? 'Ajouter une colonne' : 'Add column')}
      </button>
    </div>
  );

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
          {isFr ? 'Lignes' : 'Rows'}
        </label>
        {renderList('rows', rows)}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
          {isFr ? 'Colonnes' : 'Columns'}
        </label>
        {renderList('columns', columns)}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          {isFr ? 'Type de cellule' : 'Cell type'}
        </label>
        <select
          value={cellType}
          onChange={(e) => onChange({ cellType: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="number">{isFr ? 'Nombre' : 'Number'}</option>
          <option value="text">{isFr ? 'Texte' : 'Text'}</option>
        </select>
      </div>

      <ToggleRow
        label={isFr ? 'Afficher les totaux' : 'Show totals'}
        checked={showTotals}
        onChange={(v) => onChange({ showTotals: v })}
      />

      {rows.length > 0 && columns.length > 0 && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2 text-[10px] text-blue-600 dark:text-blue-400">
          {isFr
            ? `Aperçu : ${rows.length} ligne(s) × ${columns.length} colonne(s) = ${rows.length * columns.length} cellules`
            : `Preview: ${rows.length} row(s) × ${columns.length} column(s) = ${rows.length * columns.length} cells`}
        </div>
      )}
    </div>
  );
}

// ---- Field Properties ----
function FieldProperties({ field }: { field: FormField }) {
  const { updateField, getSchema } = useFormBuilderStore();
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>('general');

  const update = (data: Partial<FormField>) => updateField(field.id, data);
  const schema = getSchema();
  const allFields = schema.sections.flatMap((s) => s.fields).filter((f) => f.id !== field.id);
  const typeDef = getFieldTypeDefinition(field.type);

  const showDataSource = ['select', 'multi-select', 'radio', 'checkbox', 'master-data-select', 'form-data-select', 'cascade-select'].includes(field.type);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {typeDef?.icon && <typeDef.icon className="h-4 w-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {typeDef?.label || field.type}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {TAB_KEYS.filter((tk) => tk.key !== 'data-source' || showDataSource).map((tk) => (
          <button
            key={tk.key}
            onClick={() => setTab(tk.key)}
            className={cn(
              'flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors',
              tab === tk.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {t(tk.tKey)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'general' && (
          <>
            <MLInput
              label={t('fbLabelProp')}
              value={field.label}
              onChange={(label) => {
                const code = field.code || generateCodeFromLabel(label);
                update({ label, ...(field.code ? {} : { code }) });
              }}
              placeholder="Field label..."
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbCodeProp')}</label>
              <input
                type="text"
                value={field.code}
                onChange={(e) => update({ code: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="field_code"
              />
            </div>
            <MLInput
              label={t('fbHelpTextProp')}
              value={field.helpText || {}}
              onChange={(helpText) => update({ helpText })}
              placeholder="Help text..."
            />
            <MLInput
              label={t('fbPlaceholderProp')}
              value={field.placeholder || {}}
              onChange={(placeholder) => update({ placeholder })}
              placeholder="Placeholder..."
            />
            <div className="space-y-2 pt-2">
              <ToggleRow label={t('fbRequiredProp')} checked={field.required} onChange={(required) => update({ required })} />
              <ToggleRow label={t('fbReadOnlyProp')} checked={field.readOnly} onChange={(readOnly) => update({ readOnly })} />
              <ToggleRow label={t('fbHiddenProp')} checked={field.hidden} onChange={(hidden) => update({ hidden })} />
            </div>
            {field.type === 'admin-location' && (
              <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {locale === 'fr' ? 'Niveaux administratifs' : 'Admin Levels'}
                </label>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {locale === 'fr' ? 'Niveau max (Admin)' : 'Max admin level'}
                  </label>
                  <select
                    value={(field.properties.maxAdminLevel as number) ?? 2}
                    onChange={(e) => {
                      const max = Number(e.target.value);
                      const newLevels = Array.from({ length: max + 1 }, (_, i) => i);
                      update({ properties: { ...field.properties, maxAdminLevel: max, levels: newLevels, requiredLevels: [0] } });
                    }}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value={1}>{locale === 'fr' ? 'Pays + Admin1' : 'Country + Admin1'}</option>
                    <option value={2}>{locale === 'fr' ? 'Pays + Admin1 + Admin2' : 'Country + Admin1 + Admin2'}</option>
                    <option value={3}>{locale === 'fr' ? 'Jusqu\'à Admin3' : 'Up to Admin3'}</option>
                    <option value={4}>{locale === 'fr' ? 'Jusqu\'à Admin4' : 'Up to Admin4'}</option>
                    <option value={5}>{locale === 'fr' ? 'Jusqu\'à Admin5' : 'Up to Admin5'}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {locale === 'fr' ? 'Niveaux obligatoires' : 'Required levels'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {((field.properties.levels as number[]) || [0, 1, 2]).map((lvl) => {
                      const checked = ((field.properties.requiredLevels as number[]) || [0]).includes(lvl);
                      const lvlLabel = lvl === 0 ? (locale === 'fr' ? 'Pays' : 'Country') : `Admin${lvl}`;
                      return (
                        <label key={lvl} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const cur = (field.properties.requiredLevels as number[]) || [0];
                              const next = checked ? cur.filter((l) => l !== lvl) : [...cur, lvl];
                              update({ properties: { ...field.properties, requiredLevels: next } });
                            }}
                            className="rounded border-gray-300"
                          />
                          {lvlLabel}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <ToggleRow
                  label={t('showDomainZones')}
                  checked={!!field.properties.showZones}
                  onChange={(showZones) => update({ properties: { ...field.properties, showZones } })}
                />
                {field.properties.showZones && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">{t('showDomainZonesHint')}</p>
                )}
              </div>
            )}
            {field.type === 'matrix' && (
              <MatrixConfigEditor
                rows={(field.properties.rows as Array<{ label: MultilingualText; key: string }>) || []}
                columns={(field.properties.columns as Array<{ label: MultilingualText; key: string }>) || []}
                cellType={(field.properties.cellType as string) || 'number'}
                showTotals={!!field.properties.showTotals}
                onChange={(props) => update({ properties: { ...field.properties, ...props } })}
                locale={locale}
              />
            )}
          </>
        )}

        {tab === 'validation' && (
          <>
            {['text', 'textarea', 'email', 'url', 'phone'].includes(field.type) && (
              <>
                <NumberInput
                  label={t('fbMinLength')}
                  value={field.validation.minLength}
                  onChange={(minLength) => update({ validation: { ...field.validation, minLength } })}
                />
                <NumberInput
                  label={t('fbMaxLength')}
                  value={field.validation.maxLength}
                  onChange={(maxLength) => update({ validation: { ...field.validation, maxLength } })}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbPatternRegex')}</label>
                  <input
                    type="text"
                    value={field.validation.pattern || ''}
                    onChange={(e) => update({ validation: { ...field.validation, pattern: e.target.value || undefined } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="^[A-Z].*"
                  />
                </div>
              </>
            )}
            {field.type === 'number' && (
              <>
                <NumberInput label={t('fbMin')} value={field.validation.min} onChange={(min) => update({ validation: { ...field.validation, min } })} />
                <NumberInput label={t('fbMax')} value={field.validation.max} onChange={(max) => update({ validation: { ...field.validation, max } })} />
                <NumberInput label={t('fbStep')} value={field.validation.step} onChange={(step) => update({ validation: { ...field.validation, step } })} />
                <NumberInput label={t('fbDecimals')} value={field.validation.decimals} onChange={(decimals) => update({ validation: { ...field.validation, decimals } })} />
              </>
            )}
            {['date', 'datetime', 'date-range'].includes(field.type) && (
              <>
                <ToggleRow
                  label={t('fbDefaultToToday')}
                  checked={!!field.properties.defaultToToday}
                  onChange={(defaultToToday) => update({ properties: { ...field.properties, defaultToToday } })}
                />
                <ToggleRow label={t('fbDisableFuture')} checked={!!field.validation.disableFuture} onChange={(disableFuture) => update({ validation: { ...field.validation, disableFuture } })} />
                <ToggleRow label={t('fbDisablePast')} checked={!!field.validation.disablePast} onChange={(disablePast) => update({ validation: { ...field.validation, disablePast } })} />
              </>
            )}
            {['file-upload', 'image'].includes(field.type) && (
              <>
                <NumberInput label={t('fbMaxFiles')} value={field.validation.maxFiles} onChange={(maxFiles) => update({ validation: { ...field.validation, maxFiles } })} />
                <NumberInput label={t('fbMaxSizeBytes')} value={field.validation.maxSize} onChange={(maxSize) => update({ validation: { ...field.validation, maxSize } })} />
              </>
            )}
            <MLInput
              label={t('fbCustomErrorMessage')}
              value={field.validation.customMessage || {}}
              onChange={(customMessage) => update({ validation: { ...field.validation, customMessage } })}
              placeholder="Error message..."
            />
          </>
        )}

        {tab === 'data-source' && showDataSource && (
          <>
            {field.type === 'master-data-select' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbMasterDataType')}</label>
                  <select
                    value={(field.properties.masterDataType as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, masterDataType: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">{t('fbSelectType')}</option>
                    {MASTER_DATA_TYPES.map((mdt) => (
                      <option key={mdt.value} value={mdt.value}>{mdt.label}</option>
                    ))}
                  </select>
                </div>
                <ToggleRow
                  label={t('fbMultipleSelection')}
                  checked={!!field.properties.multiple}
                  onChange={(multiple) => update({ properties: { ...field.properties, multiple } })}
                />
                <ToggleRow
                  label={t('fbSearchable')}
                  checked={field.properties.searchable !== false}
                  onChange={(searchable) => update({ properties: { ...field.properties, searchable } })}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbCascadeSource')}</label>
                  <select
                    value={(field.properties.cascadeSource as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, cascadeSource: e.target.value || undefined } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">{t('fbNoneIndependent')}</option>
                    {allFields.map((f) => (
                      <option key={f.id} value={f.code || f.id}>{f.label.en || f.code || f.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbCascadeParam')}</label>
                  <input
                    type="text"
                    value={(field.properties.cascadeParam as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, cascadeParam: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="e.g. groupId"
                  />
                </div>
              </>
            )}

            {['select', 'multi-select', 'radio', 'checkbox'].includes(field.type) && (
              <StaticOptionsEditor
                options={(field.properties.options as Array<{ label: MultilingualText; value: string }>) || []}
                onChange={(options) => update({ properties: { ...field.properties, options } })}
              />
            )}
          </>
        )}

        {tab === 'conditions' && (
          <ConditionsEditor
            conditions={field.conditions}
            allFields={allFields}
            onChange={(conditions) => update({ conditions })}
          />
        )}

        {tab === 'appearance' && (
          <>
            <NumberInput
              label={t('fbColumn')}
              value={field.column}
              onChange={(column) => update({ column: column || 1 })}
            />
            <NumberInput
              label={t('fbColumnSpan')}
              value={field.columnSpan}
              onChange={(columnSpan) => update({ columnSpan: columnSpan || 1 })}
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbCssClass')}</label>
              <input
                type="text"
                value={(field.properties.cssClass as string) || ''}
                onChange={(e) => update({ properties: { ...field.properties, cssClass: e.target.value } })}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="e.g. highlight-field"
              />
            </div>
            {field.type === 'textarea' && (
              <NumberInput
                label={t('fbRows')}
                value={field.properties.rows as number}
                onChange={(rows) => update({ properties: { ...field.properties, rows: rows || 4 } })}
              />
            )}
            {field.type === 'number' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbUnit')}</label>
                <input
                  type="text"
                  value={(field.properties.unit as string) || ''}
                  onChange={(e) => update({ properties: { ...field.properties, unit: e.target.value } })}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="e.g. kg, heads, doses"
                />
              </div>
            )}
            {field.type === 'calculated' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbFormula')}</label>
                <input
                  type="text"
                  value={(field.properties.formula as string) || ''}
                  onChange={(e) => update({ properties: { ...field.properties, formula: e.target.value } })}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="e.g. {deaths} / {cases} * 100"
                />
                <p className="text-[10px] text-gray-400">Use {'{field_code}'} to reference other fields</p>
              </div>
            )}
            {field.type === 'auto-id' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbPrefix')}</label>
                  <input
                    type="text"
                    value={(field.properties.prefix as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, prefix: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="e.g. OBR-"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbFormat')}</label>
                  <input
                    type="text"
                    value={(field.properties.format as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, format: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="{YYYY}-{SEQ:5}"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Section Properties ----
function SectionProperties({ section }: { section: FormSection }) {
  const { updateSection, getSchema } = useFormBuilderStore();
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);
  const isFr = locale === 'fr';
  const update = (data: Partial<FormSection>) => updateSection(section.id, data);
  const allFields = getSchema().sections.flatMap((s) => s.fields);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('fbSectionSettings')}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MLInput
          label={t('fbSectionName')}
          value={section.name}
          onChange={(name) => update({ name })}
          placeholder="Section name..."
        />
        <MLInput
          label={t('fbDescription')}
          value={section.description || {}}
          onChange={(description) => update({ description })}
          placeholder="Section description..."
        />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbColumns')}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => update({ columns: n })}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium',
                  section.columns === n
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbColor')}</label>
          <input
            type="color"
            value={section.color || '#3B82F6'}
            onChange={(e) => update({ color: e.target.value })}
            className="h-8 w-full rounded-md border border-gray-200 dark:border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <ToggleRow label={t('fbCollapsible')} checked={section.isCollapsible} onChange={(isCollapsible) => update({ isCollapsible })} />
          <ToggleRow label={t('fbDefaultCollapsed')} checked={section.isCollapsed} onChange={(isCollapsed) => update({ isCollapsed })} />
          <ToggleRow
            label={t('fbRepeatable')}
            checked={section.isRepeatable}
            onChange={(isRepeatable) => update({ isRepeatable })}
          />
        </div>
        {section.isRepeatable && (
          <>
            <NumberInput
              label={t('fbMinRepeats')}
              value={section.repeatMin}
              onChange={(repeatMin) => update({ repeatMin })}
            />
            <NumberInput
              label={t('fbMaxRepeats')}
              value={section.repeatMax}
              onChange={(repeatMax) => update({ repeatMax })}
            />
          </>
        )}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
            {isFr ? 'Conditions d\'affichage' : 'Display Conditions'}
          </label>
          <ConditionsEditor
            conditions={section.conditions || []}
            allFields={allFields}
            onChange={(conditions) => update({ conditions })}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Static Options Editor ----
function StaticOptionsEditor({
  options,
  onChange,
}: {
  options: Array<{ label: MultilingualText; value: string }>;
  onChange: (options: Array<{ label: MultilingualText; value: string }>) => void;
}) {
  const t = useTranslations('collecte');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const addOption = () => {
    onChange([...options, { label: { en: '' }, value: `option_${options.length + 1}` }]);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, data: Partial<{ label: MultilingualText; value: string }>) => {
    onChange(options.map((opt, i) => (i === index ? { ...opt, ...data } : opt)));
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      let imported: Array<{ label: MultilingualText; value: string }> = [];
      const name = file.name.toLowerCase();
      if (name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : parsed.options || parsed.data || [];
          imported = arr.map((item: unknown, i: number) => {
            if (typeof item === 'string') return { label: { en: item }, value: item.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt_${i}` };
            if (typeof item === 'object' && item !== null) {
              const obj = item as Record<string, unknown>;
              const lbl = (obj.label as string) || (obj.name as string) || (obj.text as string) || '';
              const val = (obj.value as string) || (obj.code as string) || (obj.id as string) || lbl.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt_${i}`;
              if (typeof obj.label === 'object' && obj.label !== null) return { label: obj.label as MultilingualText, value: val };
              return { label: { en: lbl }, value: val };
            }
            return { label: { en: String(item) }, value: `opt_${i}` };
          });
        } catch { /* invalid JSON — ignore */ }
      } else {
        // CSV/TXT: each line = "label,value" or just "label"
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // Skip header if it looks like one
        const start = /^(label|name|option)/i.test(lines[0] || '') ? 1 : 0;
        imported = lines.slice(start).map((line, i) => {
          const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
          const parts = line.split(sep).map((p) => p.trim().replace(/^["']|["']$/g, ''));
          const lbl = parts[0] || '';
          const val = parts[1] || lbl.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt_${i}`;
          return { label: { en: lbl }, value: val };
        });
      }
      if (imported.length > 0) onChange([...options, ...imported]);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fbOptions')}</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
          title={t('fbImportOptions')}
        >
          <Upload className="h-3 w-3" />
          {t('fbImportFile')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.json"
          className="hidden"
          onChange={handleFileImport}
        />
      </div>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt.label.en || ''}
            onChange={(e) => updateOption(i, { label: { ...opt.label, en: e.target.value } })}
            placeholder={t('fbLabelPlaceholder')}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={opt.value}
            onChange={(e) => updateOption(i, { value: e.target.value })}
            placeholder={t('fbValuePlaceholder')}
            className="w-24 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={() => removeOption(i)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500"
      >
        {t('fbAddOption')}
      </button>
    </div>
  );
}

// ---- Conditions Editor ----
const CONDITION_TYPES: { value: FieldCondition['type']; tKey: string }[] = [
  { value: 'visibility', tKey: 'fbCondShowHide' },
  { value: 'required', tKey: 'fbCondRequired' },
  { value: 'readOnly', tKey: 'fbCondReadOnly' },
  { value: 'value', tKey: 'fbCondSetValue' },
];

const CONDITION_ACTIONS: Record<FieldCondition['type'], { value: FieldCondition['action']; tKey: string }[]> = {
  visibility: [{ value: 'show', tKey: 'fbCondShow' }, { value: 'hide', tKey: 'fbCondHide' }],
  required: [{ value: 'setRequired', tKey: 'fbCondMakeRequired' }],
  readOnly: [{ value: 'enable', tKey: 'fbCondEnable' }, { value: 'disable', tKey: 'fbCondDisable' }],
  value: [{ value: 'setValue', tKey: 'fbCondSetValue' }],
};

const OPERATORS: { value: FieldConditionRule['operator']; label?: string; tKey?: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '\u2260' },
  { value: 'contains', tKey: 'fbOpContains' },
  { value: 'notContains', tKey: 'fbOpNotContains' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'greaterOrEqual', label: '\u2265' },
  { value: 'lessOrEqual', label: '\u2264' },
  { value: 'isEmpty', tKey: 'fbOpIsEmpty' },
  { value: 'isNotEmpty', tKey: 'fbOpIsNotEmpty' },
  { value: 'isTrue', tKey: 'fbOpIsTrue' },
  { value: 'isFalse', tKey: 'fbOpIsFalse' },
  { value: 'in', tKey: 'fbOpInList' },
  { value: 'startsWith', tKey: 'fbOpStartsWith' },
  { value: 'endsWith', tKey: 'fbOpEndsWith' },
];

function ConditionsEditor({
  conditions,
  allFields,
  onChange,
}: {
  conditions: FieldCondition[];
  allFields: FormField[];
  onChange: (conditions: FieldCondition[]) => void;
}) {
  const t = useTranslations('collecte');
  const addCondition = () => {
    const newCondition: FieldCondition = {
      id: crypto.randomUUID(),
      type: 'visibility',
      action: 'show',
      logic: 'all',
      rules: [{
        field: allFields[0]?.code || '',
        operator: 'equals',
        value: '',
      }],
    };
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, data: Partial<FieldCondition>) => {
    onChange(conditions.map((c, i) => i === index ? { ...c, ...data } : c));
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const addRule = (condIndex: number) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: [...cond.rules, { field: allFields[0]?.code || '', operator: 'equals', value: '' }],
    });
  };

  const updateRule = (condIndex: number, ruleIndex: number, data: Partial<FieldConditionRule>) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: cond.rules.map((r, i) => i === ruleIndex ? { ...r, ...data } : r),
    });
  };

  const removeRule = (condIndex: number, ruleIndex: number) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: cond.rules.filter((_, i) => i !== ruleIndex),
    });
  };

  const noValueOperators = ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'];

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          {t('fbNoConditions')}
        </p>
      )}
      {conditions.map((cond, ci) => {
        const availableActions = CONDITION_ACTIONS[cond.type] || [];
        return (
          <div key={cond.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">{t('fbConditionN', { n: String(ci + 1) })}</span>
              <button onClick={() => removeCondition(ci)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={cond.type}
                onChange={(e) => {
                  const type = e.target.value as FieldCondition['type'];
                  const actions = CONDITION_ACTIONS[type] || [];
                  updateCondition(ci, { type, action: actions[0]?.value || 'show' });
                }}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {CONDITION_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{t(ct.tKey)}</option>
                ))}
              </select>
              <select
                value={cond.action}
                onChange={(e) => updateCondition(ci, { action: e.target.value as FieldCondition['action'] })}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {availableActions.map((a) => (
                  <option key={a.value} value={a.value}>{t(a.tKey)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{t('fbWhen')}</span>
              <select
                value={cond.logic}
                onChange={(e) => updateCondition(ci, { logic: e.target.value as 'all' | 'any' })}
                className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">{t('fbAllRulesMatch')}</option>
                <option value="any">{t('fbAnyRuleMatches')}</option>
              </select>
            </div>

            {cond.rules.map((rule, ri) => (
              <div key={ri} className="flex items-center gap-1">
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(ci, ri, { field: e.target.value })}
                  className="flex-1 min-w-0 rounded border border-gray-200 px-1.5 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{t('fbFieldPlaceholder')}</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.code}>{f.label.en || f.label.fr || f.code}</option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(ci, ri, { operator: e.target.value as FieldConditionRule['operator'] })}
                  className="w-16 rounded border border-gray-200 px-1 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.tKey ? t(op.tKey) : op.label}</option>
                  ))}
                </select>
                {!noValueOperators.includes(rule.operator) && (() => {
                  const refField = allFields.find((f) => f.code === rule.field);
                  const selectOptions = (refField && ['select', 'radio', 'multi-select', 'checkbox'].includes(refField.type))
                    ? (refField.properties.options as Array<{ label: MultilingualText; value: string }>) || []
                    : [];
                  const isToggle = refField?.type === 'toggle';
                  if (selectOptions.length > 0) {
                    return (
                      <select
                        value={String(rule.value ?? '')}
                        onChange={(e) => updateRule(ci, ri, { value: e.target.value })}
                        className="w-20 rounded border border-gray-200 px-1 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">{t('fbValuePlaceholder')}</option>
                        {selectOptions.map((opt, oi) => (
                          <option key={oi} value={opt.value}>{opt.label.en || opt.label.fr || opt.value}</option>
                        ))}
                      </select>
                    );
                  }
                  if (isToggle) {
                    return (
                      <select
                        value={String(rule.value ?? '')}
                        onChange={(e) => updateRule(ci, ri, { value: e.target.value })}
                        className="w-16 rounded border border-gray-200 px-1 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="true">{refField.properties.labelOn ? ((refField.properties.labelOn as MultilingualText).en || 'Yes') : 'Yes'}</option>
                        <option value="false">{refField.properties.labelOff ? ((refField.properties.labelOff as MultilingualText).en || 'No') : 'No'}</option>
                      </select>
                    );
                  }
                  return (
                    <input
                      type="text"
                      value={String(rule.value ?? '')}
                      onChange={(e) => updateRule(ci, ri, { value: e.target.value })}
                      placeholder={t('fbValuePlaceholder')}
                      className="w-16 rounded border border-gray-200 px-1.5 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  );
                })()}
                {cond.rules.length > 1 && (
                  <button onClick={() => removeRule(ci, ri)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => addRule(ci)}
              className="text-[11px] text-blue-500 hover:text-blue-600"
            >
              {t('fbAddRule')}
            </button>
          </div>
        );
      })}
      <button
        onClick={addCondition}
        className="w-full rounded-md border border-dashed border-gray-300 py-2 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-1"
      >
        <Plus className="h-3 w-3" />
        {t('fbAddCondition')}
      </button>
    </div>
  );
}

// ---- Small helpers ----
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
}

// ---- Main Properties Panel ----
export function PropertiesPanel() {
  const { selectedFieldId, selectedSectionId, getSchema, clearSelection } = useFormBuilderStore();
  const t = useTranslations('collecte');
  const schema = getSchema();

  let selectedField: FormField | null = null;
  let selectedSection: FormSection | null = null;

  if (selectedFieldId) {
    for (const section of schema.sections) {
      const field = section.fields.find((f) => f.id === selectedFieldId);
      if (field) {
        selectedField = field;
        break;
      }
    }
  }

  if (selectedSectionId) {
    selectedSection = schema.sections.find((s) => s.id === selectedSectionId) || null;
  }

  if (!selectedField && !selectedSection) {
    return (
      <div className="flex h-full w-[320px] flex-shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-gray-50/50 px-6 text-center dark:border-gray-700 dark:bg-gray-900/50">
        <div className="text-gray-300 dark:text-gray-600">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          {t('fbSelectFieldOrSection')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[320px] flex-shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Close button */}
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 z-10 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {selectedField ? (
        <FieldProperties field={selectedField} />
      ) : selectedSection ? (
        <SectionProperties section={selectedSection} />
      ) : null}
    </div>
  );
}
