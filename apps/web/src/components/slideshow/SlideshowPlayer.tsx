'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Maximize, Minimize, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SectionList } from '@/components/dashboard-builder/SectionList';
import { useDashboard, useDashboardRender } from '@/lib/api/dashboard-hooks';

// ─── Single slide renderer (fetches its own dashboard data) ─────

function SlideRenderer({ dashboardId }: { dashboardId: string }) {
  const { data: dashboardData, isLoading: loadingDash } = useDashboard(dashboardId);
  const { data: renderData, isLoading: loadingRender } = useDashboardRender(dashboardId);

  const dashboard = dashboardData?.data;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;

  if (loadingDash || loadingRender) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <div className="animate-spin h-8 w-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full mx-auto mb-4" />
          <p className="text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Dashboard introuvable
      </div>
    );
  }

  const title = dashboard.title || (dashboard as any).title_fr || (dashboard as any).titleFr || '';

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-lg font-bold mb-4 text-foreground">{title}</h2>
      <SectionList
        sections={dashboard.sections ?? []}
        widgetData={widgetData}
        editable={false}
      />
    </div>
  );
}

// ─── Transition CSS classes ────────────────────────────────────

const TRANSITION_CLASSES: Record<string, { enter: string; exit: string }> = {
  FADE: {
    enter: 'animate-fadeIn',
    exit: 'animate-fadeOut',
  },
  SLIDE_LEFT: {
    enter: 'animate-slideInRight',
    exit: 'animate-slideOutLeft',
  },
  SLIDE_RIGHT: {
    enter: 'animate-slideInLeft',
    exit: 'animate-slideOutRight',
  },
  ZOOM: {
    enter: 'animate-zoomIn',
    exit: 'animate-zoomOut',
  },
  FLIP: {
    enter: 'animate-fadeIn',
    exit: 'animate-fadeOut',
  },
};

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
  transition?: string;
  intervalMs?: number;
  autoPlay?: boolean;
  loop?: boolean;
  showProgress?: boolean;
  showControls?: boolean;
  isPublic?: boolean;
  onClose?: () => void;
}

export function SlideshowPlayer({
  slides,
  transition = 'FADE',
  intervalMs = 15000,
  autoPlay = true,
  loop = true,
  showProgress = true,
  showControls = false,
  isPublic = false,
  onClose,
}: SlideshowPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(isPublic);
  const [progress, setProgress] = useState(0);
  const [animClass, setAnimClass] = useState('animate-fadeIn');
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSlide = slides[currentIndex];
  const currentDuration = currentSlide?.durationMs ?? intervalMs;
  const currentTransition = currentSlide?.transition ?? transition;

  const triggerTransition = useCallback(
    (enterClass: string) => {
      setAnimClass(enterClass);
    },
    [],
  );

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= slides.length - 1) {
        if (loop) {
          triggerTransition(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
          return 0;
        }
        setIsPlaying(false);
        return prev;
      }
      triggerTransition(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
      return prev + 1;
    });
    setProgress(0);
  }, [slides.length, loop, currentTransition, triggerTransition]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) {
        if (loop) {
          triggerTransition(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
          return slides.length - 1;
        }
        return 0;
      }
      triggerTransition(TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn');
      return prev - 1;
    });
    setProgress(0);
  }, [slides.length, loop, currentTransition, triggerTransition]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;

    timerRef.current = setTimeout(goNext, currentDuration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, currentDuration, goNext, slides.length]);

  // Progress bar animation
  useEffect(() => {
    if (!isPlaying || !showProgress || slides.length <= 1) {
      setProgress(0);
      return;
    }

    const step = 50;
    const increment = (step / currentDuration) * 100;
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + increment, 100));
    }, step);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPlaying, currentIndex, currentDuration, showProgress, slides.length]);

  // Trigger enter animation on index change
  useEffect(() => {
    const cls = TRANSITION_CLASSES[currentTransition]?.enter ?? 'animate-fadeIn';
    setAnimClass(cls);
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

  // Listen for fullscreen changes (e.g. Escape key exits fullscreen)
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto-enter fullscreen in public mode
  useEffect(() => {
    if (isPublic && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPublic]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'p':
          setIsPlaying((p) => !p);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          if (onClose) onClose();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, toggleFullscreen, onClose]);

  if (!slides.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
        Aucun tableau de bord sélectionné
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden bg-background',
        isFullscreen && 'fixed inset-0 z-50',
      )}
    >
      {/* Inline keyframe animations (no framer-motion dependency) */}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(1.1); opacity: 0; } }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
        .animate-fadeOut { animation: fadeOut 0.6s ease-out forwards; }
        .animate-slideInRight { animation: slideInRight 0.5s ease-out forwards; }
        .animate-slideOutLeft { animation: slideOutLeft 0.5s ease-out forwards; }
        .animate-slideInLeft { animation: slideInLeft 0.5s ease-out forwards; }
        .animate-slideOutRight { animation: slideOutRight 0.5s ease-out forwards; }
        .animate-zoomIn { animation: zoomIn 0.6s ease-out forwards; }
        .animate-zoomOut { animation: zoomOut 0.6s ease-out forwards; }
      `}</style>

      {/* Slide content */}
      <div key={currentIndex} className={cn('absolute inset-0 overflow-auto', animClass)}>
        {currentSlide?.dashboardId ? (
          <SlideRenderer dashboardId={currentSlide.dashboardId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">
                {currentSlide?.dashboardTitleFr || currentSlide?.dashboardTitleEn || 'Dashboard'}
              </p>
              <p className="text-sm mt-2">Chargement...</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && slides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 z-10">
          <div
            className="h-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Slide indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIndex(i);
                setProgress(0);
              }}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === currentIndex
                  ? 'bg-primary w-6'
                  : 'bg-muted-foreground/40 hover:bg-muted-foreground/60',
              )}
            />
          ))}
        </div>
      )}

      {/* Controls overlay */}
      {(showControls || !isPublic) && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity z-20">
          {slides.length > 1 && (
            <>
              <Button size="icon" variant="secondary" onClick={goPrev} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 w-8"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="secondary" onClick={goNext} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="secondary" onClick={toggleFullscreen} className="h-8 w-8">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button size="icon" variant="secondary" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Slide counter */}
      <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-background/80 rounded px-2 py-1 z-10">
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  );
}
