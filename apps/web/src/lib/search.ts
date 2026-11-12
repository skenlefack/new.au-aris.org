/**
 * Client-side search shared by every settings list and searchable picker.
 *
 * - case- and accent-insensitive ("veterinaire" finds "Vétérinaire")
 * - every word must match somewhere ("kenya chief" finds "Chief Veterinary Officer (Kenya)")
 * - accepts strings, numbers, multilingual objects ({ en, fr, pt, ar }) and arrays,
 *   so callers just pass every value the row displays
 */
export type Searchable = string | number | boolean | null | undefined | Searchable[] | { [key: string]: Searchable };

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
}

function flatten(value: Searchable, out: string[]): void {
  if (value === null || value === undefined || value === '') return;
  if (Array.isArray(value)) {
    for (const v of value) flatten(v, out);
  } else if (typeof value === 'object') {
    for (const v of Object.values(value)) flatten(v, out);
  } else {
    out.push(String(value));
  }
}

/** Text of all the given values, normalized, for repeated matching. */
export function searchText(...values: Searchable[]): string {
  const parts: string[] = [];
  flatten(values, parts);
  return normalizeSearch(parts.join(' '));
}

/** True when every word of `query` appears in one of `values` (empty query matches all). */
export function matchesSearch(query: string, ...values: Searchable[]): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchText(...values);
  return words.every((w) => haystack.includes(w));
}
