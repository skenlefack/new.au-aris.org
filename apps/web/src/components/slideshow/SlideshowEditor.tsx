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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
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
  const { t } = useTranslations();
  const { locale } = useLocaleStore();
  const isFr = locale === 'fr';

  const { data: existing, isLoading } = useSlideshow(slideshowId);
  const { data: dashboardsRaw } = useDashboards({ limit: 100 });
  const { data: biRaw } = useBiDashboards();

  // Raw arrays
  const builderList: any[] = (dashboardsRaw as any)?.data ?? [];
  const biList: BiDashboard[] = (biRaw as any)?.data ?? [];

  // Domain filter state
  const [domainFilter, setDomainFilter] = useState('all');

  const createMutation = useCreateSlideshow();
  const updateMutation = useUpdateSlideshow();
  const updateSlidesMutation = useUpdateSlides();
  const regenerateTokenMutation = useRegenerateToken();

  // ─── Form state ──────────────────────────────────────────────────

  const [titleFr, setTitleFr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [transition, setTransition] = useState('FADE');
  const [intervalMs, setIntervalMs] = useState(15000);
  const [autoPlay, setAutoPlay] = useState(true);
  const [loop, setLoop] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [showControls, setShowControls] = useState(false);
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
      setTitleFr(existing.titleFr || '');
      setTitleEn(existing.titleEn || '');
      setDescription(existing.description || '');
      setTransition(existing.transition || 'FADE');
      setIntervalMs(existing.intervalMs || 15000);
      setAutoPlay(existing.autoPlay ?? true);
      setLoop(existing.loop ?? true);
      setShowProgress(existing.showProgress ?? true);
      setShowControls(existing.showControls ?? false);
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
      titleFr,
      titleEn,
      description,
      transition,
      intervalMs,
      autoPlay,
      loop,
      showProgress,
      showControls,
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

    if (dashboardId.startsWith('bi:')) {
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
            disabled={isSaving || !titleFr || !titleEn}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Metadata */}
          <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-base">
                {isFr ? 'Informations' : 'Information'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">{isFr ? 'Titre (FR)' : 'Title (FR)'}</label>
                <input
                  value={titleFr}
                  onChange={(e) => setTitleFr(e.target.value)}
                  placeholder="Mon diaporama"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{isFr ? 'Titre (EN)' : 'Title (EN)'}</label>
                <input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="My slideshow"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-[60px]"
                />
              </div>
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
                  {isFr ? 'Durée par slide' : 'Duration per slide'}
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

          {/* Public link */}
          {slideshowId && publicToken && (
            <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
              <div className="p-4 border-b dark:border-gray-700">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {isFr ? 'Lien public' : 'Public Link'}
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    value={publicUrl}
                    readOnly
                    className="flex-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                  <button
                    onClick={copyLink}
                    title="Copy"
                    className="inline-flex items-center justify-center rounded-md h-9 w-9 border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 flex-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {isFr ? 'Ouvrir' : 'Open'}
                  </a>
                  <button
                    onClick={handleRegenerateToken}
                    disabled={regenerateTokenMutation.isPending}
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 flex-1"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {isFr ? 'Regenerer' : 'Regenerate'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? 'Ce lien permet de visualiser le diaporama sans connexion au système.'
                    : 'This link allows viewing the slideshow without login.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Slides */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">
                  {isFr ? 'Tableaux de bord' : 'Dashboards'} ({slides.length})
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {/* Domain filter */}
                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="all">{isFr ? 'Tous les domaines' : 'All domains'}</option>
                    <option value="animal-health">{isFr ? 'Santé animale' : 'Animal Health'}</option>
                    <option value="livestock">{isFr ? 'Élevage' : 'Livestock'}</option>
                    <option value="fisheries">{isFr ? 'Pêche' : 'Fisheries'}</option>
                    <option value="trade">{isFr ? 'Commerce' : 'Trade'}</option>
                    <option value="governance">{isFr ? 'Gouvernance' : 'Governance'}</option>
                    <option value="paid">PAID</option>
                    <option value="bi">{isFr ? 'Outils BI' : 'BI Tools'}</option>
                  </select>
                  {/* Dashboard selector */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addSlide(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="w-[320px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="" disabled>
                      {isFr ? '+ Ajouter un tableau de bord' : '+ Add a dashboard'}
                    </option>
                    {/* Dashboard Builder dashboards */}
                    {builderList
                      .filter((d: any) => {
                        const did = d.id || d.Id;
                        if (slides.some((s) => s.dashboardId === did)) return false;
                        if (domainFilter === 'bi') return false;
                        if (domainFilter === 'all') return true;
                        const dom = (d.domain_code || d.domainCode || d.scope || '').toLowerCase();
                        return dom.includes(domainFilter);
                      })
                      .map((d: any) => {
                        const did = d.id || d.Id;
                        const label = isFr
                          ? (d.title_fr || d.titleFr || d.title_en || d.titleEn || did)
                          : (d.title_en || d.titleEn || d.title_fr || d.titleFr || did);
                        return (
                          <option key={did} value={did}>
                            {label} {d.scope ? `[${d.scope}]` : ''}
                          </option>
                        );
                      })}
                    {/* BI dashboards */}
                    {biList
                      .filter((d) => {
                        if (!d.isActive) return false;
                        if (slides.some((s) => s.dashboardId === `bi:${d.id}`)) return false;
                        if (domainFilter !== 'all' && domainFilter !== 'bi') {
                          return (d.category || '').includes(domainFilter);
                        }
                        return true;
                      })
                      .map((d) => (
                        <option key={`bi:${d.id}`} value={`bi:${d.id}`}>
                          [BI] {isFr ? (d.name?.fr || d.name?.en) : (d.name?.en || d.name?.fr)} ({d.tool})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => router.push('/my-dashboards')}
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {isFr ? 'Créer' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              {slides.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">
                    {isFr
                      ? 'Aucun tableau de bord selectionne'
                      : 'No dashboards selected'}
                  </p>
                  <p className="text-sm mt-2">
                    {isFr
                      ? 'Utilisez le selecteur ci-dessus pour ajouter des tableaux de bord au diaporama.'
                      : 'Use the selector above to add dashboards to the slideshow.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
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
                        <p className="font-medium truncate">
                          {isFr
                            ? slide.dashboardTitleFr ||
                              slide.dashboardTitleEn ||
                              slide.dashboardId
                            : slide.dashboardTitleEn ||
                              slide.dashboardTitleFr ||
                              slide.dashboardId}
                        </p>
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
      </div>
    </div>
  );
}
