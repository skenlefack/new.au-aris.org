/** The list APIs accept at most this many rows per page. */
export const API_MAX_PAGE_SIZE = 100;

interface Page<T> {
  data?: T[];
  meta?: { total?: number; page?: number; limit?: number; [k: string]: unknown };
  [k: string]: unknown;
}

/**
 * Fetch up to `wanted` rows from a paginated list API that caps `limit` at 100.
 * Loads page 1, then the remaining pages in parallel. Returns the same shape
 * as a single page, with every row in `data`.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<Page<T>>,
  wanted: number,
): Promise<Page<T> & { data: T[] }> {
  const first = await fetchPage(1, API_MAX_PAGE_SIZE);
  const rows: T[] = Array.isArray(first?.data) ? [...first.data] : [];
  const total = Math.min(first?.meta?.total ?? rows.length, wanted);
  const pages = Math.ceil(total / API_MAX_PAGE_SIZE);

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => fetchPage(i + 2, API_MAX_PAGE_SIZE)),
    );
    for (const p of rest) if (Array.isArray(p?.data)) rows.push(...p.data);
  }

  const data = rows.slice(0, wanted);
  return { ...first, data, meta: { ...first?.meta, total: first?.meta?.total ?? data.length, page: 1, limit: data.length } };
}
