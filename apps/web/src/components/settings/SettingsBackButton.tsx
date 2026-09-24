'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export function SettingsBackButton() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors mb-4"
    >
      <ChevronLeft className="h-4 w-4" />
      Settings
    </Link>
  );
}
