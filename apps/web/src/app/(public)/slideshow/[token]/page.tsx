'use client';

import { useParams } from 'next/navigation';
import { usePublicSlideshowRender } from '@/lib/api/slideshow-hooks';
import { SlideshowPlayer } from '@/components/slideshow/SlideshowPlayer';

export default function PublicSlideshowPage() {
  const params = useParams();
  const token = params?.token as string;
  const { data, isLoading, error } = usePublicSlideshowRender(token);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#0a1628]">
        <div className="text-center">
          <div className="relative mx-auto mb-6 w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-[#C9A227]/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#C9A227] animate-spin" />
            <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-[#1F4E79] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="text-white/60 text-sm font-light tracking-wider uppercase">Chargement</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#0a1628]">
        <div className="text-center max-w-md px-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Diaporama introuvable</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Ce lien est invalide ou le diaporama a ete desactive par son proprietaire.
          </p>
        </div>
      </div>
    );
  }

  const title = data.titleFr || data.titleEn || data.title || 'ARIS Slideshow';

  return (
    <SlideshowPlayer
      slides={data.slides || []}
      title={title}
      titleEn={data.titleEn}
      titleFr={data.titleFr}
      transition={data.transition}
      intervalMs={data.intervalMs}
      autoPlay={data.autoPlay}
      loop={data.loop}
      showProgress={data.showProgress}
      showControls={data.showControls}
      isPublic
    />
  );
}
