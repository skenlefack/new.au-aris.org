import type { PrismaClient } from '@prisma/client';

/**
 * Free-text search helpers, same semantics as services/tenant/src/services/text-search.ts:
 * case- and accent-insensitive ("veterinaire" finds "Vétérinaire"), and every
 * word must match somewhere in the row ("kenya chief"). SQL compares through
 * `m(col)` / `mJson(col)` against the `$1` pattern and selects an `id` column.
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

/** Same as `m` on the values of a multilingual JSON column ({ en, fr, pt, ar }), never on its keys. */
export function mJson(col: string): string {
  return m(`(SELECT string_agg(v.value, ' ') FROM jsonb_each_text(CASE WHEN jsonb_typeof(${col}) = 'object' THEN ${col} ELSE '{}'::jsonb END) v)`);
}

/**
 * Words of a search (max 5): `word` is folded (no accents, lower case), `raw`
 * is the same word as typed (lower case), for Prisma `contains` on columns
 * that cannot go through `m()`.
 */
export function searchWords(search: string): { word: string; raw: string }[] {
  return search.replace(/_/g, ' ').toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 5)
    .map((raw) => ({ word: normalizeSearch(raw), raw }))
    .filter((w) => w.word.length > 0);
}

/** Ids returned by `sql` for one already-normalized word. */
export async function wordIds(prisma: PrismaClient, sql: string, word: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, likePattern(word));
  return rows.map((r) => String(r.id));
}

/** Ids matching every word of `search` (one query per word, intersected). */
export async function searchIds(prisma: PrismaClient, sql: string, search: string): Promise<string[]> {
  let ids: string[] | null = null;
  for (const { word } of searchWords(search)) {
    const found = await wordIds(prisma, sql, word);
    ids = ids === null ? found : ids.filter((id) => found.includes(id));
    if (ids.length === 0) break;
  }
  return ids ?? [];
}

/** Users whose email, first name or last name matches the `$1` word. */
export const USER_WORD_SQL = `
  SELECT u.id::text AS id FROM public.users u
  WHERE ${m('u.email')} OR ${m('u.first_name')} OR ${m('u.last_name')}`;

/**
 * Ids of users matched by every word of the search on email, first name or
 * last name ("john doe", "doe john", "jose" for "José").
 */
export async function matchingUserIds(prisma: PrismaClient, search: string): Promise<string[]> {
  return searchIds(prisma, USER_WORD_SQL, search);
}

export const SUB_DOMAIN_SEARCH_SQL = `
  SELECT s.id::text AS id FROM governance.sub_domains s
  LEFT JOIN governance.domains d ON d.id = s.domain_id
  WHERE ${m('s.code')} OR ${m('s.label_fr')} OR ${m('s.label_en')}
     OR ${m('s.label_ar')} OR ${m('s.label_pt')} OR ${m('s.value_chain_code')}
     OR ${m('s.type_enum')} OR ${m('d.code')} OR ${mJson('d.name')}`;

export const MDM_DEVICE_SEARCH_SQL = `
  SELECT d.id::text AS id FROM public.mdm_devices d
  LEFT JOIN public.users u ON u.id = d.user_id
  WHERE ${m('d.device_name')} OR ${m('d.device_model')} OR ${m('d.manufacturer')}
     OR ${m('d.app_version')} OR ${m('d.network_type')} OR ${m('d.hardware_id')}
     OR ${m('u.email')} OR ${m('u.first_name')} OR ${m('u.last_name')}`;

/**
 * Distinct session-log values (device, country, city) matching the `$1` word.
 * The value sets stay small however many sessions exist, so the list can be
 * filtered with `column IN (values)` instead of a growing id list.
 */
export const SESSION_VALUE_SEARCH_SQL = `
  SELECT DISTINCT 'deviceName' AS col, device_name AS v FROM public.session_logs WHERE ${m('device_name')}
  UNION SELECT DISTINCT 'country', country FROM public.session_logs WHERE country IS NOT NULL AND ${m('country')}
  UNION SELECT DISTINCT 'city', city FROM public.session_logs WHERE city IS NOT NULL AND ${m('city')}`;
