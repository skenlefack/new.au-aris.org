import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export type SortOrder = 'asc' | 'desc';

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  pageSize?: number;
  currentPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, order: SortOrder) => void;
  emptyMessage?: string;
  className?: string;
  loading?: boolean;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pageSize = 20,
  currentPage,
  totalItems,
  onPageChange,
  onSort,
  emptyMessage = 'No data available',
  className,
  loading = false,
}: DataTableProps<T>): React.ReactElement {
  const [internalSort, setInternalSort] = useState<{ key: string; order: SortOrder } | null>(null);
  const [internalPage, setInternalPage] = useState(1);

  const page = currentPage ?? internalPage;
  const isServerPaginated = currentPage !== undefined && totalItems !== undefined;

  const sortedData = useMemo(() => {
    if (onSort || !internalSort) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = getNestedValue(a, internalSort.key);
      const bVal = getNestedValue(b, internalSort.key);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return internalSort.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return internalSort.order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, internalSort, onSort]);

  const paginatedData = useMemo(() => {
    if (isServerPaginated) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, isServerPaginated]);

  const total = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = useCallback(
    (key: string) => {
      const newOrder: SortOrder =
        internalSort?.key === key && internalSort.order === 'asc' ? 'desc' : 'asc';
      setInternalSort({ key, order: newOrder });
      onSort?.(key, newOrder);
    },
    [internalSort, onSort],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      setInternalPage(newPage);
      onPageChange?.(newPage);
    },
    [totalPages, onPageChange],
  );

  return (
    <div data-testid="data-table" className={cn('overflow-hidden rounded-card border border-gray-200 bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                    col.className,
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex" aria-label={`Sort by ${col.header}`}>
                        {internalSort?.key === col.key ? (
                          internalSort.order === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-300" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr key={keyExtractor(row)} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-gray-700', col.className)}>
                      {col.render
                        ? col.render(row)
                        : String(getNestedValue(row, col.key) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
          <span>
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              data-testid="prev-page"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              data-testid="next-page"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
