'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Pause, Play, Maximize, Minimize,
  Sun, Moon, Share2, Download, Volume2, VolumeX, Presentation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionList } from '@/components/dashboard-builder/SectionList';
import { useDashboard, useDashboardRender } from '@/lib/api/dashboard-hooks';

// ═══════════════════════════════════════════════════════════════════════
//  Slide Renderer — fetches and displays a single dashboard
// ═══════════════════════════════════════════════════════════════════════

function SlideRenderer({ dashboardId, isDark }: { dashboardId: string; isDark: boolean }) {
  const { data: dashboardData, isLoading: loadingDash } = useDashboard(dashboardId);
  const { data: renderData, isLoading: loadingRender } = useDashboardRender(dashboardId);

  const dashboard = dashboardData?.data;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;

  if (loadingDash || loadingRender) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-[#C9A227]/20 animate-pulse" />
            <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#C9A227]/60 animate-spin" />
          </div>
          <p className="text-xs text-gray-400 font-light tracking-wide">Chargement des donnees...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
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
//  Smart Ticker — scrolling synthesis of current dashboard
// ═══════════════════════════════════════════════════════════════════════

function SmartTicker({ dashboardId, isDark }: { dashboardId: string; isDark: boolean }) {
  const { data: renderData } = useDashboardRender(dashboardId);
  const { data: dashboardData } = useDashboard(dashboardId);

  const messages = useMemo(() => {
    const msgs: string[] = [];
    const dashboard = dashboardData?.data;
    const renderedWidgets = (renderData?.data as any)?.renderedWidgets;

    if (!renderedWidgets && !dashboard) return ['ARIS 4.0 - Animal Resources Information System - African Union Inter-African Bureau for Animal Resources'];

    const title = dashboard?.title || (dashboard as any)?.titleFr || '';
    if (title) msgs.push(title);

    // Extract KPI values from rendered widgets
    if (Array.isArray(renderedWidgets)) {
      for (const w of renderedWidgets) {
        if (!w.data) continue;
        const d = w.data as any;
        const widgetTitle = w.title?.fr || w.title?.en || '';

        if (d.value !== undefined && d.value !== null) {
          const val = typeof d.value === 'number' ? d.value.toLocaleString() : d.value;
          const label = d.label || d.labels?.fr || d.labels?.en || widgetTitle;
          if (label) msgs.push(`${label}: ${val}`);
        }

        if (Array.isArray(d.data) && d.data.length > 0 && d.data.length <= 5) {
          const summary = d.data.slice(0, 3).map((r: any) =>
            `${r.name || r.key}: ${typeof r.value === 'number' ? r.value.toLocaleString() : r.value}`
          ).join(' | ');
          if (summary && widgetTitle) msgs.push(`${widgetTitle} - ${summary}`);
        }
      }
    }

    // Extract from sections/widgets structure
    if (dashboard?.sections) {
      for (const section of dashboard.sections) {
        for (const widget of (section.widgets || [])) {
          const cfg = widget.config as any;
          if (cfg?.value !== undefined && cfg?.labels) {
            const label = cfg.labels?.fr || cfg.labels?.en || widget.title;
            msgs.push(`${label}: ${typeof cfg.value === 'number' ? cfg.value.toLocaleString() : cfg.value}`);
          }
        }
      }
    }

    if (msgs.length === 0) msgs.push('AU-IBAR ARIS 4.0 - Systeme continental d\'information sur les ressources animales');

    return msgs;
  }, [renderData, dashboardData]);

  const tickerText = messages.join('    \u2022    ');
  const doubledText = `${tickerText}    \u2022    ${tickerText}`;

  return (
    <div className="relative overflow-hidden whitespace-nowrap">
      <div
        className="inline-block animate-ticker"
        style={{ animationDuration: `${Math.max(20, messages.length * 8)}s` }}
      >
        <span className={cn(
          'text-xs font-light tracking-wide',
          isDark ? 'text-white/60' : 'text-gray-600',
        )}>
          {doubledText}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Transition CSS
// ═══════════════════════════════════════════════════════════════════════

const TRANSITION_CLASSES: Record<string, { enter: string; exit: string }> = {
  FADE: { enter: 'animate-fadeIn', exit: 'animate-fadeOut' },
  SLIDE_LEFT: { enter: 'animate-slideInRight', exit: 'animate-slideOutLeft' },
  SLIDE_RIGHT: { enter: 'animate-slideInLeft', exit: 'animate-slideOutRight' },
  ZOOM: { enter: 'animate-zoomIn', exit: 'animate-zoomOut' },
  FLIP: { enter: 'animate-flipIn', exit: 'animate-fadeOut' },
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
//  Main Player Component
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
  showControls = true,
  isPublic = false,
  onClose,
}: SlideshowPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [progress, setProgress] = useState(0);
  const [animClass, setAnimClass] = useState('animate-fadeIn');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSlide = slides[currentIndex];
  const currentDuration = currentSlide?.durationMs ?? intervalMs;
  const currentTransition = currentSlide?.transition ?? transition;
  const currentDashboardTitle = currentSlide?.dashboardTitleFr || currentSlide?.dashboardTitleEn || '';

  // Auto-hide header after inactivity
  useEffect(() => {
    const resetHide = () => {
      setHeaderVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setHeaderVisible(false), 4000);
    };
    resetHide();
    window.addEventListener('mousemove', resetHide);
    window.addEventListener('click', resetHide);
    return () => {
      window.removeEventListener('mousemove', resetHide);
      window.removeEventListener('click', resetHide);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= slides.length - 1) {
        if (loop) return 0;
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
    setProgress(0);
    setAnimClass(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
  }, [slides.length, loop, currentTransition]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return loop ? slides.length - 1 : 0;
      return prev - 1;
    });
    setProgress(0);
    setAnimClass(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
  }, [slides.length, loop, currentTransition]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;
    timerRef.current = setTimeout(goNext, currentDuration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, currentDuration, goNext, slides.length]);

  // Progress bar
  useEffect(() => {
    if (!isPlaying || !showProgress || slides.length <= 1) { setProgress(0); return; }
    const step = 50;
    const increment = (step / currentDuration) * 100;
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + increment, 100));
    }, step);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [isPlaying, currentIndex, currentDuration, showProgress, slides.length]);

  // Animation on index change
  useEffect(() => {
    setAnimClass(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
  }, [currentIndex, currentTransition]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto fullscreen on public
  useEffect(() => {
    if (isPublic && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPublic]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  }, [goNext, goPrev, toggleFullscreen, onClose]);

  // Share
  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (!slides.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#0a1628]">
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
        'fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-500',
        isDark
          ? 'bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]'
          : 'bg-gradient-to-br from-gray-50 via-white to-gray-100',
      )}
    >
      {/* ── Global Styles ── */}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideInRight { from { transform: translateX(4%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-4%); opacity: 0; } }
        @keyframes slideInLeft { from { transform: translateX(-4%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(4%); opacity: 0; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(1.05); opacity: 0; } }
        @keyframes flipIn { from { transform: perspective(800px) rotateY(-15deg); opacity: 0; } to { transform: perspective(800px) rotateY(0); opacity: 1; } }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .animate-fadeIn { animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fadeOut { animation: fadeOut 0.5s ease-out forwards; }
        .animate-slideInRight { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideOutLeft { animation: slideOutLeft 0.5s ease-out forwards; }
        .animate-slideInLeft { animation: slideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideOutRight { animation: slideOutRight 0.5s ease-out forwards; }
        .animate-zoomIn { animation: zoomIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-zoomOut { animation: zoomOut 0.5s ease-out forwards; }
        .animate-flipIn { animation: flipIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-ticker { animation: ticker linear infinite; }
      `}</style>

      {/* ── Ambient Background Effects ── */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-[#1F4E79]/8 blur-[120px]" style={{ animation: 'pulse-glow 8s ease-in-out infinite' }} />
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-[#C9A227]/5 blur-[120px]" style={{ animation: 'pulse-glow 10s ease-in-out infinite 3s' }} />
          <div className="absolute top-1/3 right-1/4 w-1/3 h-1/3 rounded-full bg-[#1F4E79]/4 blur-[100px]" style={{ animation: 'pulse-glow 12s ease-in-out infinite 6s' }} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          HEADER BAR
      ═══════════════════════════════════════════════════════════════ */}
      <header
        className={cn(
          'relative z-30 flex items-center justify-between px-6 py-3 transition-all duration-500',
          headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full',
          isDark
            ? 'bg-gradient-to-r from-[#0a1628]/90 via-[#0d1f3c]/80 to-transparent backdrop-blur-xl border-b border-white/5'
            : 'bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm',
        )}
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          {/* ARIS Logo Mark */}
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center',
              isDark ? 'bg-[#C9A227]/10 border border-[#C9A227]/20' : 'bg-[#1F4E79]/5 border border-[#1F4E79]/10',
            )}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke={isDark ? '#C9A227' : '#1F4E79'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className={cn('text-[10px] font-medium tracking-[0.2em] uppercase', isDark ? 'text-[#C9A227]/70' : 'text-[#1F4E79]/60')}>
                ARIS 4.0
              </div>
              <div className={cn('text-sm font-semibold truncate max-w-[300px]', isDark ? 'text-white' : 'text-gray-900')}>
                {title}
              </div>
            </div>
          </div>

          {/* Current dashboard name */}
          {currentDashboardTitle && (
            <div className={cn(
              'hidden md:flex items-center gap-2 pl-4 border-l',
              isDark ? 'border-white/10' : 'border-gray-200',
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className={cn('text-xs font-light truncate max-w-[200px]', isDark ? 'text-white/50' : 'text-gray-500')}>
                {currentDashboardTitle}
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5">
          {/* Playback controls */}
          {slides.length > 1 && (
            <div className={cn(
              'flex items-center gap-0.5 rounded-full px-1 py-0.5 mr-2',
              isDark ? 'bg-white/5' : 'bg-gray-100',
            )}>
              <ControlBtn isDark={isDark} onClick={goPrev} title="Precedent"><ChevronLeft className="w-3.5 h-3.5" /></ControlBtn>
              <ControlBtn isDark={isDark} onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Lecture'}>
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </ControlBtn>
              <ControlBtn isDark={isDark} onClick={goNext} title="Suivant"><ChevronRight className="w-3.5 h-3.5" /></ControlBtn>
            </div>
          )}

          {/* Slide counter */}
          {slides.length > 1 && (
            <span className={cn('text-[10px] font-mono mr-2', isDark ? 'text-white/40' : 'text-gray-400')}>
              {currentIndex + 1}/{slides.length}
            </span>
          )}

          {/* Theme toggle */}
          <ControlBtn isDark={isDark} onClick={() => setIsDark(!isDark)} title="Mode sombre/clair">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </ControlBtn>

          {/* Share */}
          <ControlBtn isDark={isDark} onClick={handleShare} title="Copier le lien">
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </ControlBtn>

          {/* Fullscreen */}
          <ControlBtn isDark={isDark} onClick={toggleFullscreen} title="Plein ecran">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </ControlBtn>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT — Dashboard Slide
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative overflow-hidden">
        <div key={currentIndex} className={cn('absolute inset-0 overflow-auto', animClass)}>
          {currentSlide?.dashboardId ? (
            <SlideRenderer dashboardId={currentSlide.dashboardId} isDark={isDark} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className={cn('text-sm', isDark ? 'text-white/40' : 'text-gray-400')}>Chargement...</p>
            </div>
          )}
        </div>

        {/* Side navigation arrows (large, subtle) */}
        {slides.length > 1 && headerVisible && (
          <>
            <button
              onClick={goPrev}
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 rounded-xl flex items-center justify-center transition-all',
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-700',
              )}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-20 rounded-xl flex items-center justify-center transition-all',
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-700',
              )}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER — Smart Ticker + Progress
      ═══════════════════════════════════════════════════════════════ */}
      <footer
        className={cn(
          'relative z-30 transition-all duration-500',
          isDark
            ? 'bg-gradient-to-r from-[#0a1628]/95 via-[#0d1f3c]/90 to-[#0a1628]/95 backdrop-blur-xl border-t border-white/5'
            : 'bg-white/90 backdrop-blur-xl border-t border-gray-200/50',
        )}
      >
        {/* Progress bar (top of footer) */}
        {showProgress && slides.length > 1 && (
          <div className="h-[2px] bg-transparent">
            <div
              className="h-full bg-gradient-to-r from-[#1F4E79] via-[#C9A227] to-[#1F4E79] transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Ticker content */}
        <div className="px-6 py-2.5 flex items-center gap-4">
          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setProgress(0); }}
                  className={cn(
                    'transition-all duration-300 rounded-full',
                    i === currentIndex
                      ? 'w-5 h-1.5 bg-gradient-to-r from-[#1F4E79] to-[#C9A227]'
                      : cn('w-1.5 h-1.5', isDark ? 'bg-white/20 hover:bg-white/40' : 'bg-gray-300 hover:bg-gray-400'),
                  )}
                />
              ))}
            </div>
          )}

          {/* Divider */}
          {slides.length > 1 && (
            <div className={cn('w-px h-4', isDark ? 'bg-white/10' : 'bg-gray-200')} />
          )}

          {/* Smart ticker */}
          <div className="flex-1 overflow-hidden">
            {currentSlide?.dashboardId && (
              <SmartTicker dashboardId={currentSlide.dashboardId} isDark={isDark} />
            )}
          </div>

          {/* AU-IBAR branding */}
          <div className={cn('shrink-0 text-[10px] font-light tracking-wider', isDark ? 'text-white/25' : 'text-gray-300')}>
            AU-IBAR
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Control Button Component
// ═══════════════════════════════════════════════════════════════════════

function ControlBtn({
  isDark, onClick, title, children,
}: {
  isDark: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center rounded-lg w-8 h-8 transition-all',
        isDark
          ? 'text-white/60 hover:text-white hover:bg-white/10'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  );
}
