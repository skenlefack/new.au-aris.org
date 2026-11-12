import type { PrismaClient } from '@prisma/client';

/**
 * Free-text search across every column the data-contracts list displays
 * (same approach as services/tenant/src/services/text-search.ts).
 * The SQL selects an `id` column and compares through `m(col)`; the result
 * feeds `where.id = { in: ids }`.
 *
 * Case- and accent-insensitive, and every word must match.
 */

// translate() keeps this free of the unaccent extension, which PROD does not have
const ACCENTED = 'àáâãäåāèéêëēìíîïīòóôõöōùúûüūçñýÿ';
const PLAIN = 'aaaaaaaeeeeeiiiiioooooouuuuucnyy';

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ').toLowerCase().trim();
}

export function likePattern(word: string): string {
  return `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** `col` folded (lower case, no accents, "_" as space) compared with the `$1` pattern. */
export function m(col: string): string {
  return `translate(replace(lower(${col}::text), '_', ' '), '${ACCENTED}', '${PLAIN}') LIKE $1`;
}

/** Ids matching every word of `search` (one query per word, intersected). */
export async function searchIds(prisma: PrismaClient, sql: string, search: string): Promise<string[]> {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean).slice(0, 5);
  let ids: string[] | null = null;
  for (const word of words) {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, likePattern(word));
    const found = rows.map((r) => String(r.id));
    ids = ids === null ? found : ids.filter((id) => found.includes(id));
    if (ids.length === 0) break;
  }
  return ids ?? [];
}

export const CONTRACT_SEARCH_SQL = `
  SELECT c.id FROM data_contract.data_contracts c
  WHERE ${m('c.name')} OR ${m('c.domain')} OR ${m('c.data_owner')} OR ${m('c.data_steward')}
     OR ${m('c.purpose')} OR ${m('c.frequency')} OR ${m('c.status')} OR ${m('c.classification')}
     OR ${m('c.exchange_mechanism')} OR ${m('c.officiality_level')}`;
