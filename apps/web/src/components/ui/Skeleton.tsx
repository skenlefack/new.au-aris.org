import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-3 h-4 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-card border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="flex h-[500px] items-center justify-center rounded-card border border-gray-200 bg-gray-100">
      <div className="text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-full" />
        <p className="mt-2 text-sm text-gray-400">Loading map...</p>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-gray-200 bg-white p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-5 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center rounded-card border border-gray-200 bg-white p-6">
      <div className="text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-full" />
        <p className="mt-2 text-sm text-gray-400">Loading chart...</p>
      </div>
    </div>
  );
}
