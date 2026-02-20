'use client';

import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { ApiClientError } from '@/lib/api/client';

/**
 * Hook that returns a function to display API errors as toast notifications.
 *
 * Usage:
 * ```tsx
 * const showApiError = useApiErrorToast();
 *
 * try {
 *   await apiClient.post('/some/endpoint', data);
 * } catch (error) {
 *   showApiError(error);
 * }
 * ```
 */
export function useApiErrorToast() {
  const addToast = useRealtimeStore((s) => s.addToast);

  return function showApiError(error: unknown) {
    // Handle ApiClientError with structured information
    if (error instanceof ApiClientError) {
      // 403 — Access denied
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

      // 422 / 400 — Validation / field errors
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

      // 5xx — Server errors
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

      // Other API errors (404, 409, etc.)
      addToast({
        type: 'error',
        title: `Error (${error.statusCode})`,
        message: error.message || 'An error occurred.',
      });
      return;
    }

    // Native Error with network-related message
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      addToast({
        type: 'error',
        title: 'Network error',
        message:
          'Unable to reach the server. Please check your internet connection.',
      });
      return;
    }

    // Generic Error
    if (error instanceof Error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'An unexpected error occurred.',
      });
      return;
    }

    // Unknown error type
    addToast({
      type: 'error',
      title: 'Error',
      message: 'An unexpected error occurred.',
    });
  };
}
