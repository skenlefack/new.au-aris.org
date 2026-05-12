'use client';

import React from 'react';
import { ImageIcon } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface ImageWidgetProps {
  src: string;
  alt: string;
  caption?: string;
  fit?: 'cover' | 'contain';
}

export function ImageWidget({ src, alt, caption, fit = 'cover' }: ImageWidgetProps) {
  const t = useTranslations('dashboard');
  if (!src) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-gray-400 dark:text-gray-500">
        <ImageIcon className="h-10 w-10" />
        <p className="text-xs">{t('dbNoImageConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full"
          style={{ objectFit: fit }}
        />
      </div>
      {caption && (
        <p className="flex-shrink-0 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 text-center">
          {caption}
        </p>
      )}
    </div>
  );
}
