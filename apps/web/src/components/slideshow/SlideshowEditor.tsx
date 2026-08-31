'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Save,
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  RefreshCw,
  Link2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  X,
  LayoutDashboard,
  Globe,
  BarChart3,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  useSlideshow,
  useCreateSlideshow,
  useUpdateSlideshow,
  useUpdateSlides,
  useRegenerateToken,
} from '@/lib/api/slideshow-hooks';
import { useDashboards } from '@/lib/api/dashboard-hooks';
import { useBiDashboards, type BiDashboard } from '@/lib/api/bi-hooks';
import { SlideshowPlayer } from './SlideshowPlayer';

// ─── System pages available as slideshow slides ────────────────────
const SYSTEM_PAGES = [
  { id: 'page:/home', labelFr: 'Tableau de bord principal (Accueil)', labelEn: 'Main Dashboard (Home)', group: 'system' },
  { id: 'page:/paid', labelFr: 'Dashboard PAID', labelEn: 'PAID Dashboard', group: 'system' },
  { id: 'page:/analytics', labelFr: 'Analytiques continentales', labelEn: 'Continental Analytics', group: 'system' },
  { id: 'page:/collecte/campaigns', labelFr: 'Campagnes de collecte', labelEn: 'Data Collection Campaigns', group: 'system' },
  { id: 'page:/historical/dashboard', labelFr: 'Donnees historiques', labelEn: 'Historical Data', group: 'system' },
  { id: 'page:/quality', labelFr: 'Qualite des donnees', labelEn: 'Data Quality', group: 'system' },
  { id: 'page:/data-sharing/dashboard', labelFr: 'Partage de donnees', labelEn: 'Data Sharing', group: 'system' },
  // ── Domain dashboards ──
  { id: 'page:/domains/animal-health', labelFr: 'Sante animale', labelEn: 'Animal Health', group: 'domain' },
  { id: 'page:/domains/livestock-prod', labelFr: 'Elevage & Production', labelEn: 'Livestock & Production', group: 'domain' },
  { id: 'page:/domains/fisheries', labelFr: 'Peche & Aquaculture', labelEn: 'Fisheries & Aquaculture', group: 'domain' },
  { id: 'page:/domains/trade-sps', labelFr: 'Commerce & SPS', labelEn: 'Trade & SPS', group: 'domain' },
  { id: 'page:/domains/governance', labelFr: 'Gouvernance & Capacites', labelEn: 'Governance & Capacities', group: 'domain' },
  { id: 'page:/domains/wildlife', labelFr: 'Faune sauvage & Biodiversite', labelEn: 'Wildlife & Biodiversity', group: 'domain' },
  { id: 'page:/domains/apiculture', labelFr: 'Apiculture & Pollinisation', labelEn: 'Apiculture & Pollination', group: 'domain' },
  { id: 'page:/domains/climate-env', labelFr: 'Climat & Environnement', labelEn: 'Climate & Environment', group: 'domain' },
  // ── Sub-domain dashboards — Animal Health ──
  { id: 'page:/domains/animal-health/PPR', labelFr: 'Sante animale > PPR', labelEn: 'Animal Health > PPR', group: 'subdomain' },
  { id: 'page:/domains/animal-health/AQUATIC_HEALTH', labelFr: 'Sante animale > Sante aquatique', labelEn: 'Animal Health > Aquatic Health', group: 'subdomain' },
  { id: 'page:/domains/animal-health/AMR', labelFr: 'Sante animale > Resistance antimicrobienne', labelEn: 'Animal Health > AMR', group: 'subdomain' },
  // ── Sub-domain dashboards — Livestock ──
  { id: 'page:/domains/livestock-prod/DAIRY', labelFr: 'Elevage > Lait', labelEn: 'Livestock > Dairy', group: 'subdomain' },
  { id: 'page:/domains/livestock-prod/RED_MEAT', labelFr: 'Elevage > Viande rouge', labelEn: 'Livestock > Red Meat', group: 'subdomain' },
  { id: 'page:/domains/livestock-prod/POULTRY', labelFr: 'Elevage > Volaille', labelEn: 'Livestock > Poultry', group: 'subdomain' },
  { id: 'page:/domains/livestock-prod/PORK', labelFr: 'Elevage > Porc', labelEn: 'Livestock > Pork', group: 'subdomain' },
  { id: 'page:/domains/livestock-prod/SMALL_RUMINANTS', labelFr: 'Elevage > Petits ruminants', labelEn: 'Livestock > Small Ruminants', group: 'subdomain' },
  // ── Sub-domain dashboards — Governance ──
  { id: 'page:/domains/governance/CLINICS', labelFr: 'Gouvernance > Cliniques', labelEn: 'Governance > Clinics', group: 'subdomain' },
  { id: 'page:/domains/governance/SLAUGHTERHOUSES', labelFr: 'Gouvernance > Abattoirs', labelEn: 'Governance > Slaughterhouses', group: 'subdomain' },
  { id: 'page:/domains/governance/LEGAL_FRAMEWORKS', labelFr: 'Gouvernance > Cadres juridiques', labelEn: 'Governance > Legal Frameworks', group: 'subdomain' },
  { id: 'page:/domains/governance/VACCINATION', labelFr: 'Gouvernance > Vaccination', labelEn: 'Governance > Vaccination', group: 'subdomain' },
  { id: 'page:/domains/governance/SURVEILLANCE', labelFr: 'Gouvernance > Surveillance', labelEn: 'Governance > Surveillance', group: 'subdomain' },
  { id: 'page:/domains/governance/LABORATORIES', labelFr: 'Gouvernance > Laboratoires', labelEn: 'Governance > Laboratories', group: 'subdomain' },
  // ── Sub-domain dashboards — Trade & SPS ──
  { id: 'page:/domains/trade-sps/DAIRY_TRADE', labelFr: 'Commerce > Commerce du lait', labelEn: 'Trade > Dairy Trade', group: 'subdomain' },
  { id: 'page:/domains/trade-sps/RED_MEAT_TRADE', labelFr: 'Commerce > Viande rouge', labelEn: 'Trade > Red Meat Trade', group: 'subdomain' },
  { id: 'page:/domains/trade-sps/POULTRY_TRADE', labelFr: 'Commerce > Volaille', labelEn: 'Trade > Poultry Trade', group: 'subdomain' },
  { id: 'page:/domains/trade-sps/PORK_TRADE', labelFr: 'Commerce > Porc', labelEn: 'Trade > Pork Trade', group: 'subdomain' },
  { id: 'page:/domains/trade-sps/SMALL_RUMINANTS_TRADE', labelFr: 'Commerce > Petits ruminants', labelEn: 'Trade > Small Ruminants Trade', group: 'subdomain' },
  { id: 'page:/domains/trade-sps/FISHERIES_TRADE', labelFr: 'Commerce > Halieutique', labelEn: 'Trade > Fisheries Trade', group: 'subdomain' },
];

const TRANSITIONS = [
  { value: 'FADE', labelFr: 'Fondu', labelEn: 'Fade' },
  { value: 'SLIDE_LEFT', labelFr: 'Glissement gauche', labelEn: 'Slide Left' },
  { value: 'SLIDE_RIGHT', labelFr: 'Glissement droite', labelEn: 'Slide Right' },
  { value: 'ZOOM', labelFr: 'Zoom', labelEn: 'Zoom' },
  { value: 'FLIP', labelFr: 'Rotation', labelEn: 'Flip' },
];

interface SlideshowEditorProps {
  slideshowId?: string; // undefined = create mode
}

export function SlideshowEditor({ slideshowId }: SlideshowEditorProps) {
  const router = useRouter();
  const t = useTranslations('slideshow');
  const { locale } = useLocaleStore();
  const isFr = locale === 'fr';

  const { data: existing, isLoading } = useSlideshow(slideshowId);
  const { data: dashboardsRaw } = useDashboards({ limit: 100 });
  const { data: biRaw } = useBiDashboards();

  // Raw arrays
  const builderList: any[] = (dashboardsRaw as any)?.data ?? [];
  const biList: BiDashboard[] = (biRaw as any)?.data ?? [];

  // Filter state
  const [domainFilter, setDomainFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  const createMutation = useCreateSlideshow();
  const updateMutation = useUpdateSlideshow();
  const updateSlidesMutation = useUpdateSlides();
  const regenerateTokenMutation = useRegenerateToken();

  // ─── Form state ──────────────────────────────────────────────────

  const [title, setTitle] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [transition, setTransition] = useState('FADE');
  const [intervalMs, setIntervalMs] = useState(15000);
  const [autoPlay, setAutoPlay] = useState(true);
  const [loop, setLoop] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [scrollMode, setScrollMode] = useState('CONTINUOUS');
  const [isActive, setIsActive] = useState(true);
  const [slides, setSlides] = useState<
    Array<{
      dashboardId: string;
      sortOrder: number;
      durationMs?: number;
      transition?: string;
      dashboardTitleFr?: string;
      dashboardTitleEn?: string;
    }>
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [publicToken, setPublicToken] = useState('');

  // ─── Populate from existing ──────────────────────────────────────

  useEffect(() => {
    if (existing) {
      setTitle({
        en: existing.titleEn || '', fr: existing.titleFr || '',
        pt: existing.titlePt || '', ar: existing.titleAr || '',
        es: existing.titleEs || '', sw: existing.titleSw || '',
      });
      setDescription({
        en: existing.descriptionEn || existing.description || '',
        fr: existing.descriptionFr || existing.description || '',
        pt: existing.descriptionPt || '', ar: existing.descriptionAr || '',
        es: existing.descriptionEs || '', sw: existing.descriptionSw || '',
      });
      setTransition(existing.transition || 'FADE');
      setIntervalMs(existing.intervalMs || 15000);
      setAutoPlay(existing.autoPlay ?? true);
      setLoop(existing.loop ?? true);
      setShowProgress(existing.showProgress ?? true);
      setShowControls(existing.showControls ?? false);
      setScrollMode(existing.scrollMode ?? 'CONTINUOUS');
      setIsActive(existing.isActive ?? true);
      setPublicToken(existing.publicToken || '');
      setSlides(
        (existing.slides || []).map((s: any) => ({
          dashboardId: s.dashboardId,
          sortOrder: s.sortOrder,
          durationMs: s.durationMs ?? undefined,
          transition: s.transition ?? undefined,
          dashboardTitleFr: s.dashboardTitleFr,
          dashboardTitleEn: s.dashboardTitleEn,
        })),
      );
    }
  }, [existing]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleSave = async () => {
    const payload = {
      titleFr: title.fr, titleEn: title.en,
      titlePt: title.pt || null, titleAr: title.ar || null,
      titleEs: title.es || null, titleSw: title.sw || null,
      description: description.fr || description.en || '',
      transition,
      intervalMs,
      autoPlay,
      loop,
      showProgress,
      showControls,
      scrollMode,
      ...(slideshowId ? { isActive } : {}),
    };

    if (slideshowId) {
      await updateMutation.mutateAsync({ id: slideshowId, ...payload });
      await updateSlidesMutation.mutateAsync({
        id: slideshowId,
        slides: slides.map((s, i) => ({
          dashboardId: s.dashboardId,
          sortOrder: i,
          durationMs: s.durationMs,
          transition: s.transition,
        })),
      });
    } else {
      const created = await createMutation.mutateAsync({
        ...payload,
        slides: slides.map((s, i) => ({
          dashboardId: s.dashboardId,
          sortOrder: i,
          durationMs: s.durationMs,
          transition: s.transition,
        })),
      });
      if (created?.id) {
        router.push(`/slideshows/${created.id}/edit`);
      }
    }
  };

  const addSlide = (dashboardId: string) => {
    if (slides.some((s) => s.dashboardId === dashboardId)) return;

    let titleFr = '';
    let titleEn = '';

    if (dashboardId.startsWith('page:')) {
      const sys = SYSTEM_PAGES.find((p) => p.id === dashboardId);
      titleFr = sys?.labelFr || dashboardId;
      titleEn = sys?.labelEn || dashboardId;
    } else if (dashboardId.startsWith('bi:')) {
      const bi = biList.find((d) => `bi:${d.id}` === dashboardId);
      titleFr = bi?.name?.fr || bi?.name?.en || '';
      titleEn = bi?.name?.en || bi?.name?.fr || '';
    } else {
      const db = builderList.find((d: any) => (d.id || d.Id) === dashboardId);
      if (!db) return;
      titleFr = db.title_fr || db.titleFr || db.title_en || db.titleEn || '';
      titleEn = db.title_en || db.titleEn || db.title_fr || db.titleFr || '';
    }

    setSlides([
      ...slides,
      { dashboardId, sortOrder: slides.length, dashboardTitleFr: titleFr, dashboardTitleEn: titleEn },
    ]);
  };

  const removeSlide = (idx: number) => {
    setSlides(slides.filter((_, i) => i !== idx));
  };

  const moveSlide = (idx: number, direction: 'up' | 'down') => {
    const newSlides = [...slides];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSlides.length) return;
    [newSlides[idx], newSlides[targetIdx]] = [newSlides[targetIdx], newSlides[idx]];
    setSlides(newSlides);
  };

  const handleRegenerateToken = async () => {
    if (!slideshowId) return;
    const result = await regenerateTokenMutation.mutateAsync(slideshowId);
    if (result?.publicToken) setPublicToken(result.publicToken);
  };

  const publicUrl = publicToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/slideshow/${publicToken}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  const isSaving =
    createMutation.isPending || updateMutation.isPending || updateSlidesMutation.isPending;

  if (slideshowId && isLoading) {
    return <div className="p-8 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Preview modal — rendered via portal at document.body to escape all stacking contexts */}
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex flex-col"
          style={{ zIndex: 99999 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90" onClick={() => setShowPreview(false)} />

          {/* Modal header bar */}
          <div className="relative flex items-center justify-between px-6 py-3 bg-gray-900/95 backdrop-blur border-b border-white/10">
            <div className="flex items-center gap-3">
              <Play className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">
                {isFr ? 'Aperçu du diaporama' : 'Slideshow Preview'}
              </span>
              <span className="text-xs text-white/50">
                {slides.length} {isFr ? 'slides' : 'slides'} • {Math.round(intervalMs / 1000)}s
              </span>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:border-white/40"
            >
              <X className="h-4 w-4" />
              {isFr ? 'Fermer l\'aperçu' : 'Close Preview'}
            </button>
          </div>

          {/* Player area */}
          <div className="relative flex-1 overflow-hidden">
            <SlideshowPlayer
              slides={slides.map((s) => ({
                ...s,
                id: s.dashboardId,
              }))}
              transition={transition}
              intervalMs={intervalMs}
              autoPlay={autoPlay}
              loop={loop}
              showProgress={showProgress}
              showControls={true}
              scrollMode={scrollMode}
              onClose={() => setShowPreview(false)}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/slideshows')}
            className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">
            {slideshowId
              ? isFr
                ? 'Modifier le diaporama'
                : 'Edit Slideshow'
              : isFr
                ? 'Nouveau diaporama'
                : 'New Slideshow'}
          </h1>
        </div>
        <div className="flex gap-2">
          {slides.length > 0 && publicToken && (
            <button
              onClick={() => window.open(`/slideshow/${publicToken}`, '_blank')}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isFr ? 'Aperçu' : 'Preview'}
            </button>
          )}
          {slides.length > 0 && !publicToken && (
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Play className="h-4 w-4 mr-2" />
              {isFr ? 'Aperçu' : 'Preview'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !title.fr || !title.en}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving
              ? isFr
                ? 'Enregistrement...'
                : 'Saving...'
              : isFr
                ? 'Enregistrer'
                : 'Save'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           TOP ROW: Config (left) + Dashboard Catalogue (right, same height)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left: Config */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Metadata */}
          <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-base">
                {isFr ? 'Informations' : 'Information'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <MultilingualInput
                label={isFr ? 'Titre' : 'Title'}
                value={title}
                onChange={setTitle}
                required
              />
              <MultilingualTextarea
                label="Description"
                value={description}
                onChange={setDescription}
              />
              {slideshowId && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isFr ? 'Actif' : 'Active'}</label>
                  <button
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive(!isActive)}
                    className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors',
                      isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
                        isActive ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transition config */}
          <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-base">
                {isFr ? 'Transition & Lecture' : 'Transition & Playback'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">{isFr ? 'Effet de transition' : 'Transition Effect'}</label>
                <select
                  value={transition}
                  onChange={(e) => setTransition(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                >
                  {TRANSITIONS.map((tr) => (
                    <option key={tr.value} value={tr.value}>
                      {isFr ? tr.labelFr : tr.labelEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {isFr ? 'Duree par slide' : 'Duration per slide'}
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={3}
                    max={86400}
                    value={Math.round(intervalMs / 1000)}
                    onChange={(e) => setIntervalMs(Math.max(3, parseInt(e.target.value) || 15) * 1000)}
                    className="h-8 w-20 text-sm rounded-md border border-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                  <span className="text-xs text-muted-foreground">secondes</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: '15s', ms: 15000 },
                    { label: '30s', ms: 30000 },
                    { label: '1min', ms: 60000 },
                    { label: '5min', ms: 300000 },
                    { label: '15min', ms: 900000 },
                    { label: '30min', ms: 1800000 },
                    { label: '1h', ms: 3600000 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setIntervalMs(p.ms)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        intervalMs === p.ms
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isFr ? 'Lecture auto' : 'Auto-play'}</label>
                  <button
                    role="switch"
                    aria-checked={autoPlay}
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors',
                      autoPlay ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
                        autoPlay ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isFr ? 'Boucle infinie' : 'Loop'}</label>
                  <button
                    role="switch"
                    aria-checked={loop}
                    onClick={() => setLoop(!loop)}
                    className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors',
                      loop ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
                        loop ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isFr ? 'Barre de progression' : 'Progress bar'}</label>
                  <button
                    role="switch"
                    aria-checked={showProgress}
                    onClick={() => setShowProgress(!showProgress)}
                    className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors',
                      showProgress ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
                        showProgress ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {isFr ? 'Defilement vertical (dashboards longs)' : 'Vertical scroll (long dashboards)'}
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                    {isFr
                      ? 'Comment defiler le contenu qui depasse l\'ecran'
                      : 'How to scroll content that exceeds the screen'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScrollMode('CONTINUOUS')}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left',
                        scrollMode === 'CONTINUOUS'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
                      )}
                    >
                      <div className="font-semibold">{isFr ? 'Continu' : 'Continuous'}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">
                        {isFr ? 'Defilement pixel par pixel' : 'Pixel-by-pixel scroll'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScrollMode('SECTION')}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left',
                        scrollMode === 'SECTION'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
                      )}
                    >
                      <div className="font-semibold">{isFr ? 'Par section' : 'By section'}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">
                        {isFr ? 'Section par section, sans couper les widgets' : 'Section by section, no cut widgets'}
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isFr ? 'Controles navigation' : 'Navigation controls'}</label>
                  <button
                    role="switch"
                    aria-checked={showControls}
                    onClick={() => setShowControls(!showControls)}
                    className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors',
                      showControls ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
                        showControls ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right: Dashboard Catalogue — stretches to match left column height */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700 flex flex-col flex-1">
            <div className="p-4 border-b dark:border-gray-700 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">
                  {isFr ? 'Catalogue de tableaux de bord' : 'Dashboard Catalogue'}
                </h3>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={isFr ? 'Rechercher...' : 'Search...'}
                    className="w-[220px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                  <button
                    onClick={() => router.push('/my-dashboards')}
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {isFr ? 'Creer' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* System Pages */}
              {(() => {
                const systemItems = SYSTEM_PAGES.filter(p => p.group === 'system')
                  .filter(p => !slides.some(s => s.dashboardId === p.id))
                  .filter(p => !searchFilter || (isFr ? p.labelFr : p.labelEn).toLowerCase().includes(searchFilter.toLowerCase()));
                return systemItems.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <LayoutDashboard className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                        {isFr ? 'Pages systeme' : 'System Pages'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {systemItems.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addSlide(p.id)}
                          className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-left hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{isFr ? p.labelFr : p.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Domain Pages */}
              {(() => {
                const domainItems = SYSTEM_PAGES.filter(p => p.group === 'domain')
                  .filter(p => !slides.some(s => s.dashboardId === p.id))
                  .filter(p => !searchFilter || (isFr ? p.labelFr : p.labelEn).toLowerCase().includes(searchFilter.toLowerCase()));
                return domainItems.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                        {isFr ? 'Domaines' : 'Domains'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {domainItems.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addSlide(p.id)}
                          className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-left hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{isFr ? p.labelFr : p.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Sub-domain Pages */}
              {(() => {
                const subdomainItems = SYSTEM_PAGES.filter(p => p.group === 'subdomain')
                  .filter(p => !slides.some(s => s.dashboardId === p.id))
                  .filter(p => !searchFilter || (isFr ? p.labelFr : p.labelEn).toLowerCase().includes(searchFilter.toLowerCase()));
                return subdomainItems.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                        {isFr ? 'Sous-domaines' : 'Sub-domains'} ({subdomainItems.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {subdomainItems.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addSlide(p.id)}
                          className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-left hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{isFr ? p.labelFr : p.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Dashboard Builder */}
              {(() => {
                const builderItems = builderList.filter((d: any) => {
                  const did = d.id || d.Id;
                  if (slides.some(s => s.dashboardId === did)) return false;
                  if (searchFilter) {
                    const q = searchFilter.toLowerCase();
                    return ((d.title_fr || '') + ' ' + (d.title_en || '')).toLowerCase().includes(q);
                  }
                  return true;
                });
                return builderItems.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-violet-600" />
                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                        Dashboard Builder ({builderItems.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {builderItems.map((d: any) => {
                        const did = d.id || d.Id;
                        const label = isFr
                          ? (d.title_fr || d.titleFr || d.title_en || d.titleEn || did)
                          : (d.title_en || d.titleEn || d.title_fr || d.titleFr || did);
                        return (
                          <button
                            key={did}
                            onClick={() => addSlide(did)}
                            className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-left hover:bg-violet-50 hover:border-violet-300 dark:hover:bg-violet-900/20 dark:hover:border-violet-700 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* BI Tools */}
              {(() => {
                const biItems = biList
                  .filter(d => !slides.some(s => s.dashboardId === `bi:${d.id}`))
                  .filter(d => !searchFilter || ((d.name?.fr || '') + ' ' + (d.name?.en || '')).toLowerCase().includes(searchFilter.toLowerCase()));
                return biItems.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                        {isFr ? 'Outils BI' : 'BI Tools'} ({biItems.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {biItems.map(d => (
                        <button
                          key={d.id}
                          onClick={() => addSlide(`bi:${d.id}`)}
                          className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-left hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-900/20 dark:hover:border-orange-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{isFr ? (d.name?.fr || d.name?.en) : (d.name?.en || d.name?.fr)}</span>
                          <span className="ml-auto text-[10px] text-gray-400 uppercase flex-shrink-0">{d.tool}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           PUBLIC LINK — full width, between catalogue and slides
         ═══════════════════════════════════════════════════════════════ */}
      {slideshowId && publicToken && (
        <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
          <div className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{isFr ? 'Lien public' : 'Public Link'}</span>
            </div>
            <div className="flex flex-1 gap-2 min-w-0">
              <input
                value={publicUrl}
                readOnly
                className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
              <button
                onClick={copyLink}
                title="Copy"
                className="inline-flex items-center justify-center rounded-md h-8 w-8 border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {isFr ? 'Ouvrir' : 'Open'}
              </a>
              <button
                onClick={handleRegenerateToken}
                disabled={regenerateTokenMutation.isPending}
                className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {isFr ? 'Regenerer' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           BOTTOM: Selected Slides — full width
         ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            {isFr ? 'Slides selectionnes' : 'Selected Slides'} ({slides.length})
          </h3>
        </div>
        <div className="p-4">
          {slides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-base">
                {isFr
                  ? 'Aucun tableau de bord selectionne'
                  : 'No dashboards selected'}
              </p>
              <p className="text-sm mt-1">
                {isFr
                  ? 'Utilisez le catalogue ci-dessus pour ajouter des tableaux de bord au diaporama.'
                  : 'Use the catalogue above to add dashboards to the slideshow.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {slides.map((slide, idx) => (
                <div
                  key={slide.dashboardId}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border border-gray-300 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-sm">
                        {isFr
                          ? slide.dashboardTitleFr ||
                            slide.dashboardTitleEn ||
                            slide.dashboardId
                          : slide.dashboardTitleEn ||
                            slide.dashboardTitleFr ||
                            slide.dashboardId}
                      </p>
                      {slide.dashboardId.startsWith('page:') && (() => {
                        const sp = SYSTEM_PAGES.find(p => p.id === slide.dashboardId);
                        const grp = sp?.group;
                        return grp === 'subdomain' ? (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">
                            {isFr ? 'Sous-domaine' : 'Sub-domain'}
                          </span>
                        ) : grp === 'domain' ? (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">
                            {isFr ? 'Domaine' : 'Domain'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                            Page
                          </span>
                        );
                      })()}
                      {slide.dashboardId.startsWith('bi:') && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex-shrink-0">BI</span>
                      )}
                      {!slide.dashboardId.startsWith('page:') && !slide.dashboardId.startsWith('bi:') && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex-shrink-0">Builder</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-muted-foreground">
                          {isFr ? 'Duree:' : 'Duration:'}
                        </label>
                        <input
                          type="number"
                          min={3}
                          max={86400}
                          value={
                            slide.durationMs
                              ? Math.round(slide.durationMs / 1000)
                              : ''
                          }
                          placeholder={`${Math.round(intervalMs / 1000)}s`}
                          onChange={(e) => {
                            const val = e.target.value
                              ? parseInt(e.target.value) * 1000
                              : undefined;
                            const newSlides = [...slides];
                            newSlides[idx] = { ...newSlides[idx], durationMs: val };
                            setSlides(newSlides);
                          }}
                          className="h-7 w-16 text-xs rounded-md border border-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        />
                        <span className="text-xs text-muted-foreground">s</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-muted-foreground">
                          Transition:
                        </label>
                        <select
                          value={slide.transition || ''}
                          onChange={(e) => {
                            const newSlides = [...slides];
                            const v = e.target.value;
                            newSlides[idx] = {
                              ...newSlides[idx],
                              transition: v === '__default' ? undefined : v || undefined,
                            };
                            setSlides(newSlides);
                          }}
                          className="h-7 w-32 text-xs rounded-md border border-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        >
                          <option value="">
                            {isFr ? 'Par defaut' : 'Default'}
                          </option>
                          {TRANSITIONS.map((tr) => (
                            <option key={tr.value} value={tr.value}>
                              {isFr ? tr.labelFr : tr.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                      onClick={() => moveSlide(idx, 'up')}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                      onClick={() => moveSlide(idx, 'down')}
                      disabled={idx === slides.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600"
                      onClick={() => removeSlide(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
