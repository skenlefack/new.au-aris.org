'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface IframeWidgetProps {
  url: string;
  title?: string;
}

export function IframeWidget({ url, title }: IframeWidgetProps) {
  const t = useTranslations('dashboard');
  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-gray-400 dark:text-gray-500">
        <Globe className="h-10 w-10" />
        <p className="text-xs">{t('dbConfigureUrl')}</p>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={title ?? t('dbEmbeddedContent')}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
