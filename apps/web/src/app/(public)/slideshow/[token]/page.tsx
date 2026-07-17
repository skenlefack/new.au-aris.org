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
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-4" />
          <p>Chargement du diaporama...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Diaporama introuvable</p>
          <p className="text-white/60">
            Ce lien est invalide ou le diaporama a été désactivé.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background">
      <SlideshowPlayer
        slides={data.slides || []}
        transition={data.transition}
        intervalMs={data.intervalMs}
        autoPlay={data.autoPlay}
        loop={data.loop}
        showProgress={data.showProgress}
        showControls={data.showControls}
        isPublic
      />
    </div>
  );
}
