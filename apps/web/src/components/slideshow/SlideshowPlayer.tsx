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
  { code: 'navy', label: 'Navy', darkBg: '#0a1628', darkVia: '#0d1f3c', accent: '#1F4E79', lightBg: '#f0f5fa', lightAccent: '#1F4E79' },
  { code: 'gold', label: 'Gold', darkBg: '#1a1400', darkVia: '#2d2200', accent: '#C9A227', lightBg: '#fdf8e8', lightAccent: '#92750B' },
  { code: 'emerald', label: 'Emerald', darkBg: '#021a12', darkVia: '#03291c', accent: '#059669', lightBg: '#ecfdf5', lightAccent: '#047857' },
  { code: 'crimson', label: 'Crimson', darkBg: '#1a0507', darkVia: '#2d0a0e', accent: '#DC2626', lightBg: '#fef2f2', lightAccent: '#B91C1C' },
  { code: 'violet', label: 'Violet', darkBg: '#0f0720', darkVia: '#1a0d35', accent: '#7C3AED', lightBg: '#f5f3ff', lightAccent: '#6D28D9' },
  { code: 'ocean', label: 'Ocean', darkBg: '#021a2b', darkVia: '#032d47', accent: '#0891B2', lightBg: '#ecfeff', lightAccent: '#0E7490' },
  { code: 'sunset', label: 'Sunset', darkBg: '#1a0d02', darkVia: '#2d1604', accent: '#EA580C', lightBg: '#fff7ed', lightAccent: '#C2410C' },
  { code: 'slate', label: 'Slate', darkBg: '#0f1114', darkVia: '#1a1e24', accent: '#64748B', lightBg: '#f8fafc', lightAccent: '#475569' },
  { code: 'rose', label: 'Rose', darkBg: '#1a0510', darkVia: '#2d0a1c', accent: '#E11D48', lightBg: '#fff1f2', lightAccent: '#BE123C' },
  { code: 'teal', label: 'Teal', darkBg: '#021a1a', darkVia: '#032d2d', accent: '#0D9488', lightBg: '#f0fdfa', lightAccent: '#0F766E' },
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

function IframeSlideRenderer({ src, onReady }: { src: string; onReady?: () => void }) {
  return (
    <iframe
      src={src}
      className="w-full h-full border-0"
      onLoad={() => onReady?.()}
      allow="fullscreen"
    />
  );
}

function SlideRenderer({ dashboardId, durationMs, onReady, isPublic, preRendered }: {
  dashboardId: string; durationMs: number; onReady?: () => void; isPublic?: boolean; preRendered?: any;
}) {
  // System page — rendered as iframe (requires auth session)
  if (dashboardId.startsWith('page:')) {
    const path = dashboardId.replace('page:', '');
    const sep = path.includes('?') ? '&' : '?';
    return <IframeSlideRenderer src={`${path}${sep}embed=1`} onReady={onReady} />;
  }
  // BI dashboard — rendered as iframe via embed URL
  if (dashboardId.startsWith('bi:')) {
    return <IframeSlideRenderer src={`/bi-embed/${dashboardId.replace('bi:', '')}`} onReady={onReady} />;
  }
  // Dashboard Builder — use pre-rendered data in public mode, otherwise fetch live
  if (isPublic && preRendered) {
    return <PublicDashboardSlideRenderer dashboard={preRendered} durationMs={durationMs} onReady={onReady} />;
  }
  return <DashboardSlideRenderer dashboardId={dashboardId} durationMs={durationMs} onReady={onReady} />;
}

function PublicDashboardSlideRenderer({ dashboard: preRendered, durationMs, onReady }: { dashboard: any; durationMs: number; onReady?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const readyCalledRef = useRef(false);

  // Public render returns { dashboard: {metadata}, renderedWidgets: [{widgetId, type, data, title, grid}] }
  // Reconstruct sections + widgetData for SectionList
  const { sections, widgetData } = useMemo(() => {
    const rw: any[] = preRendered?.renderedWidgets ?? [];
    if (!rw.length) return { sections: [], widgetData: {} };

    // Build widgetData map
    const wd: Record<string, Record<string, unknown>> = {};
    const widgets = rw.map((w: any) => {
      if (w.data) wd[w.widgetId] = w.data;
      return {
        id: w.widgetId,
        type: w.type,
        title: typeof w.title === 'object' ? (w.title?.fr || w.title?.en || '') : (w.title || ''),
        config: w.config ?? {},
        grid: w.grid ?? { x: 0, y: 0, w: 6, h: 4 },
        dataSource: w.dataSource,
      };
    });

    // Group by section_id, or put all in one default section
    const sectionMap = new Map<string, any[]>();
    for (const w of rw) {
      const sid = w.section_id || 'default';
      if (!sectionMap.has(sid)) sectionMap.set(sid, []);
      sectionMap.get(sid)!.push(widgets.find((ww: any) => ww.id === w.widgetId));
    }

    const secs = Array.from(sectionMap.entries()).map(([id, wgts]) => ({
      id,
      title: id === 'default' ? '' : id,
      collapsed: false,
      config: {},
      widgets: wgts,
    }));

    return { sections: secs, widgetData: wd };
  }, [preRendered]);

  useEffect(() => {
    const measureTimer = setTimeout(() => {
      if (!readyCalledRef.current) {
        readyCalledRef.current = true;
        onReady?.();
      }

      const el = scrollRef.current;
      if (!el) return;
      const contentHeight = el.scrollHeight;
      const viewHeight = el.clientHeight;
      if (contentHeight <= viewHeight) return;

      const totalScreens = Math.ceil(contentHeight / viewHeight);
      const timePerScreen = durationMs / totalScreens;
      scrollTimersRef.current = [];
      for (let i = 1; i < totalScreens; i++) {
        const t = setTimeout(() => {
          if (!scrollRef.current) return;
          scrollRef.current.scrollTo({
            top: Math.min(i * viewHeight, contentHeight - viewHeight),
            behavior: 'smooth',
          });
        }, i * timePerScreen);
        scrollTimersRef.current.push(t);
      }
    }, 600);

    return () => {
      clearTimeout(measureTimer);
      scrollTimersRef.current.forEach(clearTimeout);
    };
  }, [dashboard, durationMs, onReady]);

  if (!sections.length) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <p className="text-sm">Dashboard introuvable</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="px-6 py-4 overflow-hidden h-full">
      <SectionList sections={sections} widgetData={widgetData} editable={false} />
    </div>
  );
}

function DashboardSlideRenderer({ dashboardId, durationMs, onReady }: { dashboardId: string; durationMs: number; onReady?: () => void }) {
  const { data: dashboardData, isLoading: loadingDash } = useDashboard(dashboardId);
  const { data: renderData, isLoading: loadingRender } = useDashboardRender(dashboardId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const readyCalledRef = useRef(false);

  const dashboard = dashboardData?.data;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;

  // Auto-scroll: screen-by-screen when content overflows
  useEffect(() => {
    if (loadingDash || loadingRender || !dashboard) return;

    // Wait for content to render and measure
    const measureTimer = setTimeout(() => {
      // Signal ready — auto-play timer starts NOW in the parent
      if (!readyCalledRef.current) {
        readyCalledRef.current = true;
        onReady?.();
      }

      const el = scrollRef.current;
      if (!el) return;

      const contentHeight = el.scrollHeight;
      const viewHeight = el.clientHeight;
      if (contentHeight <= viewHeight) return; // No overflow, nothing to scroll

      // Calculate number of "screens" (pages)
      const totalScreens = Math.ceil(contentHeight / viewHeight);
      // Equal time per screen — first screen gets the same time as all others
      const timePerScreen = durationMs / totalScreens;

      // Scroll to each screen sequentially — first scroll at timePerScreen (after first screen has had its full time)
      scrollTimersRef.current = [];
      for (let i = 1; i < totalScreens; i++) {
        const t = setTimeout(() => {
          if (!scrollRef.current) return;
          const targetScroll = Math.min(i * viewHeight, contentHeight - viewHeight);
          scrollRef.current.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
          });
        }, i * timePerScreen);
        scrollTimersRef.current.push(t);
      }
    }, 600); // Wait for dashboard widgets to render

    return () => {
      clearTimeout(measureTimer);
      scrollTimersRef.current.forEach(clearTimeout);
    };
  }, [loadingDash, loadingRender, dashboard, durationMs, onReady]);

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
    <div ref={scrollRef} className="px-6 py-4 overflow-hidden h-full">
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

function SmartTicker({ dashboardId, accentColor, isDark }: { dashboardId: string; accentColor: string; isDark: boolean }) {
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
        <span className={cn('text-[11px] font-light tracking-wide', isDark ? 'text-white/60' : 'text-gray-600')}>
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
  // In public mode, filter out slides that require authentication (page: and bi: prefixes)
  const effectiveSlides = useMemo(() =>
    isPublic
      ? slides.filter((s) => !s.dashboardId.startsWith('page:') && !s.dashboardId.startsWith('bi:'))
      : slides,
    [slides, isPublic],
  );

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
  const [slideReady, setSlideReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const currentSlide = effectiveSlides[currentIndex];
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
      if (prev >= effectiveSlides.length - 1) { if (loop) return 0; setIsPlaying(false); return prev; }
      return prev + 1;
    });
    setProgress(0);
    setSlideReady(false);
    setAnimClass(TRANSITION_CLASSES[currentTransition] ?? 'animate-fadeIn');
  }, [effectiveSlides.length, loop, currentTransition]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return loop ? effectiveSlides.length - 1 : 0;
      return prev - 1;
    });
    setProgress(0);
    setSlideReady(false);
    setAnimClass(TRANSITION_CLASSES[currentTransition] ?? 'animate-fadeIn');
  }, [effectiveSlides.length, loop, currentTransition]);

  const handleSlideReady = useCallback(() => {
    setSlideReady(true);
  }, []);

  // Auto-play — wait until slide content is ready before starting the timer
  useEffect(() => {
    if (!isPlaying || effectiveSlides.length <= 1 || !slideReady) return;
    timerRef.current = setTimeout(goNext, currentDuration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, currentDuration, goNext, effectiveSlides.length, slideReady]);

  // Progress — also waits for slide to be ready
  useEffect(() => {
    if (!isPlaying || !showProgress || effectiveSlides.length <= 1 || !slideReady) { setProgress(0); return; }
    const step = 50;
    const increment = (step / currentDuration) * 100;
    setProgress(0);
    progressRef.current = setInterval(() => setProgress((p) => Math.min(p + increment, 100)), step);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [isPlaying, currentIndex, currentDuration, showProgress, effectiveSlides.length, slideReady]);

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

  if (!effectiveSlides.length) {
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
      className="fixed inset-0 z-50 flex flex-col overflow-hidden transition-all duration-700"
      style={{
        background: isDark
          ? `linear-gradient(135deg, ${themeColor.darkBg} 0%, ${themeColor.darkVia} 50%, ${themeColor.darkBg} 100%)`
          : `linear-gradient(135deg, ${themeColor.lightBg} 0%, #ffffff 50%, ${themeColor.lightBg} 100%)`,
      }}
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
      <header
        className={cn(
          'relative z-30 flex items-center justify-between px-5 py-2.5 shrink-0 backdrop-blur-2xl',
          isDark ? 'bg-black/40' : 'bg-white/70 shadow-sm',
        )}
        style={{ borderBottom: `1px solid ${isDark ? themeColor.accent + '15' : themeColor.lightAccent + '20'}` }}
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <Image
            src="/aris-logo.png"
            alt="ARIS"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div className={cn('w-px h-5', isDark ? 'bg-white/10' : 'bg-gray-200')} />
          <span className={cn('text-sm font-semibold truncate max-w-[300px]', isDark ? 'text-white/80' : 'text-gray-700')}>
            {displayTitle}
          </span>

          {/* Current dashboard badge */}
          {currentDashboardTitle && (
            <div className={cn(
              'hidden lg:flex items-center gap-2 ml-2 pl-3 border-l',
              isDark ? 'border-white/10' : 'border-gray-200',
            )}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor.accent }} />
              <span className={cn('text-[11px] truncate max-w-[200px]', isDark ? 'text-white/40' : 'text-gray-400')}>
                {currentDashboardTitle}
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Playback */}
          {effectiveSlides.length > 1 && (
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
                {currentIndex + 1}/{effectiveSlides.length}
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
                'absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 p-3 min-w-[200px]',
                isDark ? 'bg-gray-900/95 border border-white/10 backdrop-blur-xl' : 'bg-white border border-gray-200 backdrop-blur-xl',
              )}>
                <p className={cn('text-[10px] font-medium uppercase tracking-wider mb-2 px-1', isDark ? 'text-white/40' : 'text-gray-400')}>
                  Theme
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {THEME_COLORS.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { setThemeColor(c); setShowColorMenu(false); }}
                      title={c.label}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all duration-200 relative group',
                        themeColor.code === c.code
                          ? 'scale-110 ring-2 ring-offset-2'
                          : 'hover:scale-110',
                        themeColor.code === c.code && isDark && 'ring-white/60 ring-offset-gray-900',
                        themeColor.code === c.code && !isDark && 'ring-gray-400 ring-offset-white',
                      )}
                      style={{ backgroundColor: c.accent }}
                    >
                      {themeColor.code === c.code && (
                        <svg className="absolute inset-0 m-auto w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
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
            <SlideRenderer
              dashboardId={currentSlide.dashboardId}
              durationMs={currentDuration}
              onReady={handleSlideReady}
              isPublic={isPublic}
              preRendered={currentSlide.dashboard}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-white/30">Chargement...</p>
            </div>
          )}
        </div>

        {/* Side arrows */}
        {effectiveSlides.length > 1 && (
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
      <footer
        className={cn(
          'relative z-30 shrink-0 backdrop-blur-2xl',
          isDark ? 'bg-black/50' : 'bg-white/70',
        )}
        style={{ borderTop: `1px solid ${isDark ? themeColor.accent + '15' : themeColor.lightAccent + '20'}` }}
      >
        {/* Progress bar */}
        {showProgress && effectiveSlides.length > 1 && (
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
          {effectiveSlides.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              {effectiveSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setProgress(0); setSlideReady(false); }}
                  className={cn(
                    'transition-all duration-300 rounded-full',
                    i === currentIndex ? 'w-5 h-1.5' : cn('w-1.5 h-1.5', isDark ? 'bg-white/15 hover:bg-white/30' : 'bg-gray-300 hover:bg-gray-400'),
                  )}
                  style={i === currentIndex ? { background: `linear-gradient(90deg, ${themeColor.accent}, ${themeColor.accent}99)` } : undefined}
                />
              ))}
            </div>
          )}

          {effectiveSlides.length > 1 && <div className={cn('w-px h-3.5 shrink-0', isDark ? 'bg-white/10' : 'bg-gray-200')} />}

          {/* Ticker */}
          <div className="flex-1 overflow-hidden min-w-0">
            {currentSlide?.dashboardId && (
              <SmartTicker dashboardId={currentSlide.dashboardId} accentColor={themeColor.accent} isDark={isDark} />
            )}
          </div>

          {/* Branding */}
          <span className={cn('shrink-0 text-[9px] font-medium tracking-[0.15em] uppercase', isDark ? 'text-white/25' : 'text-gray-400')}>
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

function Btn({ isDark, onClick, tip, children, active }: { isDark: boolean; onClick: () => void; tip: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={cn(
        'inline-flex items-center justify-center rounded-lg w-8 h-8 transition-all',
        active
          ? isDark ? 'text-white bg-white/15' : 'text-gray-900 bg-gray-200'
          : isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  );
}
