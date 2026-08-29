'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/translations';

interface OfficialFooterProps {
  disclaimer?: string;
}

export function OfficialFooter({ disclaimer }: OfficialFooterProps) {
  const t = useTranslations('print');

  return (
    <div className="print-footer mt-8 border-t-2 border-gray-900 pt-4">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          <p className="font-semibold">AU-IBAR — ARIS</p>
          <p>{t('officialDocument')}</p>
        </div>
        <div className="text-right">
          <p>P.O. Box 30786-00100, Nairobi, Kenya</p>
          <p>www.au-ibar.org</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] italic text-gray-400">
        {disclaimer ?? t('disclaimer')}
      </p>
    </div>
  );
}
