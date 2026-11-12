import type { PrismaClient } from '@prisma/client';

/**
 * Free-text search for collecte lists whose displayed columns live in joined
 * tables (user names/emails), which Prisma `contains` cannot reach in one go.
 * Same pattern as services/tenant/src/services/text-search.ts: the SQL selects
 * an `id` column and compares through `m(col)`; the result feeds
 * `where.id = { in: ids }`.
 *
 * Case- and accent-insensitive ("benoit" finds "Benoît"), and every word must
 * match ("kenya national" finds a national-level chain of a Kenyan validator).
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

/** User name + email columns of the users joined under `alias`. */
const userCols = (alias: string) =>
  `${m(`${alias}.email`)} OR ${m(`${alias}.first_name`)} OR ${m(`${alias}.last_name`)}`;

/**
 * Validation chains: submitter, validator and backup validator (name, email),
 * and the level as displayed ("Admin 1 (Province)", "Regional (REC)" / "Régional (CER)").
 */
export const VALIDATION_CHAIN_SEARCH_SQL = `
  SELECT c.id FROM public.collecte_validation_chains c
  LEFT JOIN public.users u ON u.id = c.user_id
  LEFT JOIN public.users v ON v.id = c.validator_id
  LEFT JOIN public.users b ON b.id = c.backup_validator_id
  WHERE c.is_active
    AND (${userCols('u')} OR ${userCols('v')} OR ${userCols('b')}
      OR ${m(`c.level_type || ' ' || CASE c.level_type
               WHEN 'regional' THEN 'regional (rec) régional (cer)'
               WHEN 'admin1' THEN 'admin 1 (province)'
               WHEN 'admin2' THEN 'admin 2 (district)'
               WHEN 'admin3' THEN 'admin 3 (commune)'
               WHEN 'admin4' THEN 'admin 4 (village)'
               WHEN 'admin5' THEN 'admin 5 (locality) (localité)'
               ELSE '' END`)})`;
