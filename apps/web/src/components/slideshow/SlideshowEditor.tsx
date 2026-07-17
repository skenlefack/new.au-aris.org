'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
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
  const { data: dashboardsData } = useDashboards({ limit: 100 });
  const dashboards = (dashboardsData as any)?.data ?? [];

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
    const db = dashboards.find((d: any) => (d.id || d.Id) === dashboardId);
    if (!db) return;
    if (slides.some((s) => s.dashboardId === dashboardId)) return; // no duplicates
    setSlides([
      ...slides,
      {
        dashboardId,
        sortOrder: slides.length,
        dashboardTitleFr: db.titleFr ?? db.title_fr,
        dashboardTitleEn: db.titleEn ?? db.title_en,
      },
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

  if (showPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/slideshows')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
          {slides.length > 0 && (
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Play className="h-4 w-4 mr-2" />
              {isFr ? 'Aperçu' : 'Preview'}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !titleFr || !titleEn}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving
              ? isFr
                ? 'Enregistrement...'
                : 'Saving...'
              : isFr
                ? 'Enregistrer'
                : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isFr ? 'Informations' : 'Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{isFr ? 'Titre (FR)' : 'Title (FR)'}</Label>
                <Input
                  value={titleFr}
                  onChange={(e) => setTitleFr(e.target.value)}
                  placeholder="Mon diaporama"
                />
              </div>
              <div>
                <Label>{isFr ? 'Titre (EN)' : 'Title (EN)'}</Label>
                <Input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="My slideshow"
                />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {slideshowId && (
                <div className="flex items-center justify-between">
                  <Label>{isFr ? 'Actif' : 'Active'}</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transition config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isFr ? 'Transition & Lecture' : 'Transition & Playback'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{isFr ? 'Effet de transition' : 'Transition Effect'}</Label>
                <Select value={transition} onValueChange={setTransition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSITIONS.map((tr) => (
                      <SelectItem key={tr.value} value={tr.value}>
                        {isFr ? tr.labelFr : tr.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {isFr ? 'Durée par slide' : 'Duration per slide'}:{' '}
                  {Math.round(intervalMs / 1000)}s
                </Label>
                <input
                  type="range"
                  min={3000}
                  max={120000}
                  step={1000}
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(parseInt(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>3s</span>
                  <span>120s</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{isFr ? 'Lecture auto' : 'Auto-play'}</Label>
                  <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{isFr ? 'Boucle infinie' : 'Loop'}</Label>
                  <Switch checked={loop} onCheckedChange={setLoop} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{isFr ? 'Barre de progression' : 'Progress bar'}</Label>
                  <Switch checked={showProgress} onCheckedChange={setShowProgress} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{isFr ? 'Contrôles navigation' : 'Navigation controls'}</Label>
                  <Switch checked={showControls} onCheckedChange={setShowControls} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Public link */}
          {slideshowId && publicToken && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {isFr ? 'Lien public' : 'Public Link'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild className="flex-1">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {isFr ? 'Ouvrir' : 'Open'}
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateToken}
                    disabled={regenerateTokenMutation.isPending}
                    className="flex-1"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {isFr ? 'Régénérer' : 'Regenerate'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? 'Ce lien permet de visualiser le diaporama sans connexion.'
                    : 'This link allows viewing the slideshow without login.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Slides */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {isFr ? 'Tableaux de bord' : 'Dashboards'} ({slides.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Select onValueChange={addSlide}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue
                        placeholder={
                          isFr ? '+ Ajouter un tableau de bord' : '+ Add a dashboard'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {dashboards
                        .filter(
                          (d: any) =>
                            !slides.some((s) => s.dashboardId === (d.id || d.Id)),
                        )
                        .map((d: any) => (
                          <SelectItem key={d.id || d.Id} value={d.id || d.Id}>
                            {isFr
                              ? d.titleFr || d.title_fr || d.titleEn || d.title_en
                              : d.titleEn || d.title_en || d.titleFr || d.title_fr}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/my-dashboards')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {isFr ? 'Créer' : 'Create'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {slides.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">
                    {isFr
                      ? 'Aucun tableau de bord sélectionné'
                      : 'No dashboards selected'}
                  </p>
                  <p className="text-sm mt-2">
                    {isFr
                      ? 'Utilisez le sélecteur ci-dessus pour ajouter des tableaux de bord au diaporama.'
                      : 'Use the selector above to add dashboards to the slideshow.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slides.map((slide, idx) => (
                    <div
                      key={slide.dashboardId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Badge variant="outline" className="flex-shrink-0">
                        {idx + 1}
                      </Badge>
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
                            <Label className="text-xs text-muted-foreground">
                              {isFr ? 'Durée:' : 'Duration:'}
                            </Label>
                            <Input
                              type="number"
                              min={3}
                              max={300}
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
                              className="h-7 w-16 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">s</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">
                              Transition:
                            </Label>
                            <Select
                              value={slide.transition || ''}
                              onValueChange={(v) => {
                                const newSlides = [...slides];
                                newSlides[idx] = {
                                  ...newSlides[idx],
                                  transition: v || undefined,
                                };
                                setSlides(newSlides);
                              }}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue
                                  placeholder={isFr ? 'Par défaut' : 'Default'}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__default">
                                  {isFr ? 'Par défaut' : 'Default'}
                                </SelectItem>
                                {TRANSITIONS.map((tr) => (
                                  <SelectItem key={tr.value} value={tr.value}>
                                    {isFr ? tr.labelFr : tr.labelEn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => moveSlide(idx, 'up')}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => moveSlide(idx, 'down')}
                          disabled={idx === slides.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeSlide(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
