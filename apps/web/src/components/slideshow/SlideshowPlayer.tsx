'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  ChevronLeft, ChevronRight, Pause, Play, Maximize, Minimize,
  Sun, Moon, Share2, Globe, Palette, Presentation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionList } from '@/components/dashboard-builder/SectionList';
import { useDashboard, useDashboardRender } from '@/lib/api/dashboard-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

// ════════════════════════���═════════════════════════��════════════════════
//  Theme Colors
// ═══════════════════════════════════════════════════════════════════════

const THEME_COLORS = [
  { code: 'navy', label: 'Navy', bg: 'from-[#0a1628] via-[#0d1f3c] to-[#0a1628]', accent: '#1F4E79', accentLight: '#1F4E79' },
  { code: 'gold', label: 'Gold', bg: 'from-[#1a1400] via-[#2d2200] to-[#1a1400]', accent: '#C9A227', accentLight: '#B8860B' },
  { code: 'emerald', label: 'Emerald', bg: 'from-[#021a12] via-[#03291c] to-[#021a12]', accent: '#059669', accentLight: '#047857' },
  { code: 'crimson', label: 'Crimson', bg: 'from-[#1a0507] via-[#2d0a0e] to-[#1a0507]', accent: '#DC2626', accentLight: '#B91C1C' },
  { code: 'violet', label: 'Violet', bg: 'from-[#0f0720] via-[#1a0d35] to-[#0f0720]', accent: '#7C3AED', accentLight: '#6D28D9' },
  { code: 'ocean', label: 'Ocean', bg: 'from-[#021a2b] via-[#032d47] to-[#021a2b]', accent: '#0891B2', accentLight: '#0E7490' },
  { code: 'sunset', label: 'Sunset', bg: 'from-[#1a0d02] via-[#2d1604] to-[#1a0d02]', accent: '#EA580C', accentLight: '#C2410C' },
  { code: 'slate', label: 'Slate', bg: 'from-[#0f1114] via-[#1a1e24] to-[#0f1114]', accent: '#64748B', accentLight: '#475569' },
  { code: 'rose', label: 'Rose', bg: 'from-[#1a0510] via-[#2d0a1c] to-[#1a0510]', accent: '#E11D48', accentLight: '#BE123C' },
  { code: 'teal', label: 'Teal', bg: 'from-[#021a1a] via-[#032d2d] to-[#021a1a]', accent: '#0D9488', accentLight: '#0F766E' },
];

const LANGUAGES = [
  { code: 'fr', label: 'FR', full: 'Francais' },
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'pt', label: 'PT', full: 'Portugues' },
  { code: 'ar', label: 'AR', full: 'العربية' },
];

// ═══════════════════════════════════════════════════════════════════════
//  Slide Renderer
// ═══════════════════════════════════════════════════════════════════════

function SlideRenderer({ dashboardId }: { dashboardId: string }) {
  const { data: dashboardData, isLoading: loadingDash } = useDashboard(dashboardId);
  const { data: renderData, isLoading: loadingRender } = useDashboardRender(dashboardId);

  const dashboard = dashboardData?.data;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;

  if (loadingDash || loadingRender) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="relative w-10 h-10 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-pulse" />
            <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-white/40 animate-spin" />
          </div>
          <p className="text-xs text-white/40 font-light tracking-wide">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <p className="text-sm">Dashboard introuvable</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 overflow-auto h-full">
      <SectionList
        sections={dashboard.sections ?? []}
        widgetData={widgetData}
        editable={false}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Smart Ticker
// ═══════════════════════════════════════════════════════════════════════

function SmartTicker({ dashboardId, accentColor }: { dashboardId: string; accentColor: string }) {
  const { data: renderData } = useDashboardRender(dashboardId);
  const { data: dashboardData } = useDashboard(dashboardId);
  const locale = useLocaleStore((s) => s.locale);

  const messages = useMemo(() => {
    const msgs: string[] = [];
    const dashboard = dashboardData?.data;
    const renderedWidgets = (renderData?.data as any)?.renderedWidgets;

    if (!renderedWidgets && !dashboard) return ['ARIS - Animal Resources Information System - African Union Inter-African Bureau for Animal Resources'];

    const title = locale === 'en' ? ((dashboard as any)?.titleEn || dashboard?.title) : ((dashboard as any)?.titleFr || dashboard?.title);
    if (title) msgs.push(title);

    if (Array.isArray(renderedWidgets)) {
      for (const w of renderedWidgets) {
        if (!w.data) continue;
        const d = w.data as any;
        const widgetTitle = locale === 'en' ? (w.title?.en || w.title?.fr) : (w.title?.fr || w.title?.en) || '';

        if (d.value !== undefined && d.value !== null) {
          const val = typeof d.value === 'number' ? d.value.toLocaleString() : d.value;
          const label = (locale === 'en' ? d.labels?.en : d.labels?.fr) || d.label || widgetTitle;
          if (label) msgs.push(`${label}: ${val}`);
        }

        if (Array.isArray(d.data) && d.data.length > 0 && d.data.length <= 5) {
          const summary = d.data.slice(0, 3).map((r: any) =>
            `${r.name || r.key}: ${typeof r.value === 'number' ? r.value.toLocaleString() : r.value}`
          ).join(' \u2014 ');
          if (summary && widgetTitle) msgs.push(`${widgetTitle} \u2022 ${summary}`);
        }
      }
    }

    if (dashboard?.sections) {
      for (const section of dashboard.sections) {
        for (const widget of (section.widgets || [])) {
          const cfg = widget.config as any;
          if (cfg?.value !== undefined && cfg?.labels) {
            const label = (locale === 'en' ? cfg.labels?.en : cfg.labels?.fr) || widget.title;
            msgs.push(`${label}: ${typeof cfg.value === 'number' ? cfg.value.toLocaleString() : cfg.value}`);
          }
        }
      }
    }

    if (msgs.length === 0) msgs.push('AU-IBAR ARIS - Systeme continental d\'information sur les ressources animales');
    return msgs;
  }, [renderData, dashboardData, locale]);

  const tickerText = messages.join('        \u2726        ');
  const doubledText = `${tickerText}        \u2726        ${tickerText}`;

  return (
    <div className="relative overflow-hidden whitespace-nowrap">
      <div
        className="inline-block animate-ticker"
        style={{ animationDuration: `${Math.max(25, messages.length * 10)}s` }}
      >
        <span className="text-[11px] font-light tracking-wide text-white/50">
          {doubledText}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Transitions
// ═══════════════════════════════════════════════════════════════════════

const TRANSITION_CLASSES: Record<string, string> = {
  FADE: 'animate-fadeIn',
  SLIDE_LEFT: 'animate-slideInRight',
  SLIDE_RIGHT: 'animate-slideInLeft',
  ZOOM: 'animate-zoomIn',
  FLIP: 'animate-flipIn',
};

// ═══════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════

interface Slide {
  id: string;
  dashboardId: string;
  sortOrder: number;
  durationMs?: number | null;
  transition?: string | null;
  dashboard?: any;
  dashboardTitleFr?: string;
  dashboardTitleEn?: string;
}

interface SlideshowPlayerProps {
  slides: Slide[];
  title?: string;
  titleFr?: string;
  titleEn?: string;
  transition?: string;
  intervalMs?: number;
  autoPlay?: boolean;
  loop?: boolean;
  showProgress?: boolean;
  showControls?: boolean;
  isPublic?: boolean;
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════
//  Main Player
// ═══════════════════════════════════════════════════════════════════════

export function SlideshowPlayer({
  slides,
  title = 'ARIS Slideshow',
  titleFr,
  titleEn,
  transition = 'FADE',
  intervalMs = 15000,
  autoPlay = true,
  loop = true,
  showProgress = true,
  isPublic = false,
  onClose,
}: SlideshowPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [themeColor, setThemeColor] = useState(THEME_COLORS[0]);
  const [progress, setProgress] = useState(0);
  const [animClass, setAnimClass] = useState('animate-fadeIn');
  const [copied, setCopied] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const currentSlide = slides[currentIndex];
  const currentDuration = currentSlide?.durationMs ?? intervalMs;
  const currentTransition = currentSlide?.transition ?? transition;
  const currentDashboardTitle = locale === 'en'
    ? (currentSlide?.dashboardTitleEn || currentSlide?.dashboardTitleFr || '')
    : (currentSlide?.dashboardTitleFr || currentSlide?.dashboardTitleEn || '');

  const displayTitle = locale === 'en' ? (titleEn || titleFr || title) : (titleFr || titleEn || title);

  // Auto fullscreen on load
  useEffect(() => {
    if (isPublic && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPublic]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= slides.length - 1) { if (loop) return 0; setIsPlaying(false); return prev; }
      return prev + 1;
    });
    setProgress(0);
    setAnimClass(TRANSITION_CLASSES[currentTransition] ?? 'animate-fadeIn');
  }, [slides.length, loop, currentTransition]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return loop ? slides.length - 1 : 0;
      return prev - 1;
    });
    setProgress(0);
    setAnimClass(TRANSITION_CLASSES[currentTransition] ?? 'animate-fadeIn');
  }, [slides.length, loop, currentTransition]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;
    timerRef.current = setTimeout(goNext, currentDuration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, currentDuration, goNext, slides.length]);

  // Progress
  useEffect(() => {
    if (!isPlaying || !showProgress || slides.length <= 1) { setProgress(0); return; }
    const step = 50;
    const increment = (step / currentDuration) * 100;
    setProgress(0);
    progressRef.current = setInterval(() => setProgress((p) => Math.min(p + increment, 100)), step);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [isPlaying, currentIndex, currentDuration, showProgress, slides.length]);

  useEffect(() => {
    setAnimClass(TRANSITION_CLASSES[currentTransition] ?? 'animate-fadeIn');
  }, [currentIndex, currentTransition]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showLangMenu || showColorMenu) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': e.preventDefault(); goNext(); break;
        case 'ArrowLeft': e.preventDefault(); goPrev(); break;
        case 'p': setIsPlaying((p) => !p); break;
        case 'f': toggleFullscreen(); break;
        case 'd': setIsDark((d) => !d); break;
        case 'Escape': if (onClose) onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, toggleFullscreen, onClose, showLangMenu, showColorMenu]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = () => { setShowLangMenu(false); setShowColorMenu(false); };
    if (showLangMenu || showColorMenu) {
      setTimeout(() => document.addEventListener('click', h), 0);
      return () => document.removeEventListener('click', h);
    }
  }, [showLangMenu, showColorMenu]);

  if (!slides.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]">
        <div className="text-center text-white/50">
          <Presentation className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-light">Aucun tableau de bord selectionne</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-700',
        isDark ? `bg-gradient-to-br ${themeColor.bg}` : 'bg-gradient-to-br from-gray-50 via-white to-gray-100',
      )}
    >
      {/* ── Global Styles ── */}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(3%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-3%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes flipIn { from { transform: perspective(800px) rotateY(-10deg); opacity: 0; } to { transform: perspective(800px) rotateY(0); opacity: 1; } }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes glow { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.5; } }
        .animate-fadeIn { animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideInRight { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideInLeft { animation: slideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-zoomIn { animation: zoomIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-flipIn { animation: flipIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-ticker { animation: ticker linear infinite; }
      `}</style>

      {/* ── Ambient Glow ── */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/3 -left-1/4 w-1/2 h-1/2 rounded-full blur-[150px] opacity-20" style={{ backgroundColor: themeColor.accent, animation: 'glow 10s ease-in-out infinite' }} />
          <div className="absolute -bottom-1/3 -right-1/4 w-1/2 h-1/2 rounded-full blur-[150px] opacity-10" style={{ backgroundColor: themeColor.accent, animation: 'glow 12s ease-in-out infinite 4s' }} />
        </div>
      )}

      {/* ═════════════════════════════��═════════════════════════════════
          HEADER — Always visible, fixed
      ═══════════════════════════════════════════════════════════════ */}
      <header className={cn(
        'relative z-30 flex items-center justify-between px-5 py-2.5 shrink-0',
        isDark
          ? 'bg-black/40 backdrop-blur-2xl border-b border-white/[0.06]'
          : 'bg-white/70 backdrop-blur-2xl border-b border-gray-200/60 shadow-sm',
      )}>
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <Image
            src="/aris-logo.png"
            alt="ARIS"
            width={32}
            height={32}
            className="rounded-md"
          />
          <div className="flex items-center gap-2.5">
            <span className={cn('text-sm font-bold tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>
              ARIS
            </span>
            <div className={cn('w-px h-4', isDark ? 'bg-white/10' : 'bg-gray-200')} />
            <span className={cn('text-sm font-medium truncate max-w-[280px]', isDark ? 'text-white/70' : 'text-gray-600')}>
              {displayTitle}
            </span>
          </div>

          {/* Current dashboard badge */}
          {currentDashboardTitle && (
            <div className={cn(
              'hidden lg:flex items-center gap-2 ml-3 pl-3 border-l',
              isDark ? 'border-white/10' : 'border-gray-200',
            )}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor.accent }} />
              <span className={cn('text-[11px] truncate max-w-[180px]', isDark ? 'text-white/40' : 'text-gray-400')}>
                {currentDashboardTitle}
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Playback */}
          {slides.length > 1 && (
            <div className={cn(
              'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 mr-1',
              isDark ? 'bg-white/[0.06]' : 'bg-gray-100',
            )}>
              <Btn isDark={isDark} onClick={goPrev} tip="Precedent"><ChevronLeft className="w-3.5 h-3.5" /></Btn>
              <Btn isDark={isDark} onClick={() => setIsPlaying(!isPlaying)} tip={isPlaying ? 'Pause (P)' : 'Lecture (P)'}>
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Btn>
              <Btn isDark={isDark} onClick={goNext} tip="Suivant"><ChevronRight className="w-3.5 h-3.5" /></Btn>
              <span className={cn('text-[10px] font-mono px-1', isDark ? 'text-white/30' : 'text-gray-400')}>
                {currentIndex + 1}/{slides.length}
              </span>
            </div>
          )}

          {/* Language */}
          <div className="relative">
            <Btn isDark={isDark} onClick={() => { setShowColorMenu(false); setShowLangMenu(!showLangMenu); }} tip="Langue">
              <Globe className="w-4 h-4" />
            </Btn>
            {showLangMenu && (
              <div className={cn(
                'absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-xl z-50 min-w-[120px]',
                isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200',
              )}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setLocale(lang.code as any); setShowLangMenu(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                      locale === lang.code
                        ? isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                        : isDark ? 'text-white/60 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <span className="font-bold w-5">{lang.label}</span>
                    <span className="font-light">{lang.full}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color theme */}
          <div className="relative">
            <Btn isDark={isDark} onClick={() => { setShowLangMenu(false); setShowColorMenu(!showColorMenu); }} tip="Couleur">
              <Palette className="w-4 h-4" />
            </Btn>
            {showColorMenu && (
              <div className={cn(
                'absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-xl z-50 p-2',
                isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200',
              )}>
                <div className="grid grid-cols-5 gap-1.5">
                  {THEME_COLORS.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { setThemeColor(c); setShowColorMenu(false); }}
                      title={c.label}
                      className={cn(
                        'w-7 h-7 rounded-full transition-all border-2',
                        themeColor.code === c.code
                          ? 'border-white scale-110 ring-2 ring-white/30'
                          : 'border-transparent hover:scale-110',
                      )}
                      style={{ backgroundColor: c.accent }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dark/Light */}
          <Btn isDark={isDark} onClick={() => setIsDark(!isDark)} tip="Theme (D)">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Btn>

          {/* Share */}
          <Btn isDark={isDark} onClick={handleShare} tip="Partager">
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </Btn>

          {/* Fullscreen */}
          <Btn isDark={isDark} onClick={toggleFullscreen} tip="Plein ecran (F)">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Btn>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════���════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div key={currentIndex} className={cn('absolute inset-0 overflow-auto', animClass)}>
          {currentSlide?.dashboardId ? (
            <SlideRenderer dashboardId={currentSlide.dashboardId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-white/30">Chargement...</p>
            </div>
          )}
        </div>

        {/* Side arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-16 rounded-xl flex items-center justify-center transition-all opacity-0 hover:opacity-100',
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-black/5 hover:bg-black/10 text-gray-500',
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-16 rounded-xl flex items-center justify-center transition-all opacity-0 hover:opacity-100',
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-black/5 hover:bg-black/10 text-gray-500',
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER — Progress + Dots + Smart Ticker
      ═══════════════════════════════════════════════════════════════ */}
      <footer className={cn(
        'relative z-30 shrink-0',
        isDark
          ? 'bg-black/50 backdrop-blur-2xl border-t border-white/[0.06]'
          : 'bg-white/70 backdrop-blur-2xl border-t border-gray-200/60',
      )}>
        {/* Progress bar */}
        {showProgress && slides.length > 1 && (
          <div className="h-[2px]">
            <div
              className="h-full rounded-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${themeColor.accent}, ${themeColor.accent}88)`,
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-5 py-2.5">
          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setProgress(0); }}
                  className={cn(
                    'transition-all duration-300 rounded-full',
                    i === currentIndex ? 'w-5 h-1.5' : cn('w-1.5 h-1.5', isDark ? 'bg-white/15 hover:bg-white/30' : 'bg-gray-300 hover:bg-gray-400'),
                  )}
                  style={i === currentIndex ? { background: `linear-gradient(90deg, ${themeColor.accent}, ${themeColor.accent}99)` } : undefined}
                />
              ))}
            </div>
          )}

          {slides.length > 1 && <div className={cn('w-px h-3.5 shrink-0', isDark ? 'bg-white/10' : 'bg-gray-200')} />}

          {/* Ticker */}
          <div className="flex-1 overflow-hidden min-w-0">
            {currentSlide?.dashboardId && (
              <SmartTicker dashboardId={currentSlide.dashboardId} accentColor={themeColor.accent} />
            )}
          </div>

          {/* Branding */}
          <span className={cn('shrink-0 text-[9px] font-medium tracking-[0.15em] uppercase', isDark ? 'text-white/20' : 'text-gray-300')}>
            AU-IBAR
          </span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Button
// ═══════════════════════════════════════════════════════════════════════

function Btn({ isDark, onClick, tip, children }: { isDark: boolean; onClick: () => void; tip: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={cn(
        'inline-flex items-center justify-center rounded-lg w-8 h-8 transition-all',
        isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  );
}
