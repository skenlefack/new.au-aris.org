'use client';

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem('aris-pwa-dismissed')) {
      setDismissed(true);
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem('aris-pwa-dismissed', 'true');
  }

  if (!deferredPrompt || dismissed || installed) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 right-4 z-50 flex items-center gap-3',
        'rounded-lg border border-aris-primary-200 bg-white px-4 py-3 shadow-lg',
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aris-primary-50">
        <Download className="h-5 w-5 text-aris-primary-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">Install ARIS</p>
        <p className="text-xs text-gray-500">Quick access from your desktop</p>
      </div>
      <button
        onClick={handleInstall}
        className="ml-2 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aris-primary-700"
        aria-label="Install ARIS application"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="rounded p-1 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
