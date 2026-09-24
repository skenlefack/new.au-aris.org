'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function SettingsBackButton() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
        border border-gray-200 bg-white text-gray-600
        hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300
        dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400
        dark:hover:bg-gray-700 dark:hover:text-gray-200
        transition-colors shrink-0"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Settings
    </Link>
  );
}
