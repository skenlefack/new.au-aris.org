'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface MapWidgetProps {
  title?: string;
  config?: Record<string, unknown>;
}

export function MapWidget({ title }: MapWidgetProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1F4E79]/10">
        <MapPin className="h-8 w-8 text-[#1F4E79]" />
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {title ?? 'Interactive Map'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Map visualization coming soon
      </p>
    </div>
  );
}
