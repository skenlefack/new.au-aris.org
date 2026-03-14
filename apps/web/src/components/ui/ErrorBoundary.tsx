'use client';

import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface InternalErrorBoundaryProps extends ErrorBoundaryProps {
  labels: {
    somethingWentWrong: string;
    unexpectedError: string;
    tryAgain: string;
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InternalErrorBoundary extends Component<
  InternalErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: InternalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-card border border-red-200 bg-red-50 p-6">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h3 className="mt-3 text-sm font-semibold text-red-900">
            {this.props.labels.somethingWentWrong}
          </h3>
          <p className="mt-1 text-xs text-red-600">
            {this.state.error?.message ?? this.props.labels.unexpectedError}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="h-3 w-3" />
            {this.props.labels.tryAgain}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const t = useTranslations('shared');

  const labels = {
    somethingWentWrong: t('somethingWentWrong'),
    unexpectedError: t('unexpectedError'),
    tryAgain: t('tryAgain'),
  };

  return (
    <InternalErrorBoundary labels={labels} fallback={fallback}>
      {children}
    </InternalErrorBoundary>
  );
}
