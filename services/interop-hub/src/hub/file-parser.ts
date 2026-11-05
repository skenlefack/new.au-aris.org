/**
 * Parses an uploaded ingest file into records.
 * Supported: .json (array, or { records: [] } / { data: [] }), .csv, .tsv (RFC 4180 quoting).
 */

export class FileParseError extends Error {}

export function parseIngestFile(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  const ext = fileName.toLowerCase().split('.').pop();
  const content = buffer.toString('utf-8').replace(/^﻿/, '');

  if (ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new FileParseError(`Invalid JSON: ${(err as Error).message}`);
    }
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj?.records)) return obj.records as Record<string, unknown>[];
    if (Array.isArray(obj?.data)) return obj.data as Record<string, unknown>[];
    throw new FileParseError('JSON file must contain an array or an object with a "records" or "data" array');
  }

  if (ext === 'csv' || ext === 'tsv') {
    const rows = parseDelimited(content, ext === 'tsv' ? '\t' : detectSeparator(content));
    const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
    if (nonEmpty.length < 2) {
      throw new FileParseError('File must have a header row and at least one data row');
    }
    const headers = nonEmpty[0].map((h) => h.trim());
    return nonEmpty.slice(1).map((values) => {
      const record: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        if (!h) return;
        const raw = (values[j] ?? '').trim();
        record[h] = raw !== '' && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      });
      return record;
    });
  }

  throw new FileParseError(`Unsupported file format: .${ext}. Supported: .json, .csv, .tsv`);
}

/** Excel exports in French locales often use ';' — pick the most frequent separator in the header. */
function detectSeparator(content: string): string {
  const header = content.split(/\r?\n/, 1)[0] ?? '';
  return (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ';' : ',';
}

function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === sep) { row.push(field); field = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
      continue;
    }
    field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
