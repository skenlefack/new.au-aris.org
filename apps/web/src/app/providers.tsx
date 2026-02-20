'use client';

import React, { useState } from 'react';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { ApiClientError } from '@/lib/api/client';

function buildMutationCache() {
  return new MutationCache({
    onError: (error) => {
      const addToast = useRealtimeStore.getState().addToast;

      if (error instanceof ApiClientError) {
        if (error.statusCode === 403) {
          addToast({
            type: 'error',
            title: 'Access denied',
            message:
              error.message ||
              'You do not have permission to perform this action.',
          });
          return;
        }

        if (error.errors && error.errors.length > 0) {
          const fieldMessages = error.errors
            .map((e) => `${e.field}: ${e.message}`)
            .join('; ');
          addToast({
            type: 'error',
            title: 'Validation error',
            message: fieldMessages,
          });
          return;
        }

        if (error.statusCode >= 500) {
          addToast({
            type: 'error',
            title: 'Server error',
            message:
              error.message ||
              'An unexpected server error occurred. Please try again later.',
          });
          return;
        }

        addToast({
          type: 'error',
          title: `Error (${error.statusCode})`,
          message: error.message || 'An error occurred.',
        });
        return;
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        addToast({
          type: 'error',
          title: 'Network error',
          message:
            'Unable to reach the server. Please check your internet connection.',
        });
        return;
      }

      if (error instanceof Error) {
        addToast({
          type: 'error',
          title: 'Error',
          message: error.message || 'An unexpected error occurred.',
        });
      }
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        mutationCache: buildMutationCache(),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <NetworkBanner />
        {children}
        <InstallPrompt />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
