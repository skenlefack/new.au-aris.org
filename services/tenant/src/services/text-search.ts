import type { PrismaClient } from '@prisma/client';

/**
 * Free-text search across every column a settings list displays, including
 * multilingual JSON names (en/fr/pt/ar) and joined labels (tenant, roles…),
 * which Prisma `contains` cannot reach. The SQL must select an `id` column
 * and compare through `m(col)`; the result feeds `where.id = { in: ids }`.
 *
 * Case- and accent-insensitive ("veterinaire" finds "Vétérinaire"), and every
 * word must match ("kenya chief" finds "Chief Veterinary Officer (Kenya)").
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

export const FUNCTION_SEARCH_SQL = `
  SELECT f.id FROM governance.functions f
  LEFT JOIN public.tenants t ON t.id = f.tenant_id
  WHERE ${m('f.code')} OR ${mJson('f.name')} OR ${mJson('f.description')}
     OR ${m('f.level')} OR ${m('f.category')}
     OR ${m('t.name')} OR ${m('t.code')}
     OR EXISTS (SELECT 1 FROM governance.function_roles fr JOIN governance.roles r ON r.id = fr.role_id
                WHERE fr.function_id = f.id AND (${m('r.code')} OR ${mJson('r.name')}))`;

export const ROLE_SEARCH_SQL = `
  SELECT r.id FROM governance.roles r
  LEFT JOIN public.tenants t ON t.id = r.tenant_id
  WHERE ${m('r.code')} OR ${mJson('r.name')} OR ${mJson('r.description')}
     OR ${m('r.level')} OR ${m('t.name')} OR ${m('t.code')}`;

export const USER_SEARCH_SQL = `
  SELECT u.id FROM public.users u
  LEFT JOIN public.tenants t ON t.id = u.tenant_id
  WHERE ${m('u.email')} OR ${m('u.first_name')} OR ${m('u.last_name')}
     OR ${m('u.phone')} OR ${m('u.role')}
     OR ${m('t.name')} OR ${m('t.code')}
     OR EXISTS (SELECT 1 FROM governance.user_role_assignments ura JOIN governance.roles r ON r.id = ura.role_id
                WHERE ura.user_id = u.id AND (${m('r.code')} OR ${mJson('r.name')}))
     OR EXISTS (SELECT 1 FROM governance.user_functions uf JOIN governance.functions f ON f.id = uf.function_id
                WHERE uf.user_id = u.id AND (${m('f.code')} OR ${mJson('f.name')}))`;

export const REC_SEARCH_SQL = `
  SELECT r.id FROM governance.recs r
  WHERE ${m('r.code')} OR ${mJson('r.name')} OR ${mJson('r.full_name')}
     OR ${m('r.headquarters')}`;

export const COUNTRY_SEARCH_SQL = `
  SELECT c.id FROM governance.countries c
  WHERE ${m('c.code')} OR ${mJson('c.name')} OR ${mJson('c.capital')}`;
