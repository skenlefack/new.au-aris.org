import { PipeTransform, Injectable } from '@nestjs/common';

const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_RE = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

const HTML_ENTITY_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#x27;',
};

function encodeHtmlEntities(str: string): string {
  return str.replace(/[<>&"']/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

function sanitizeString(value: string): string {
  let result = value.replace(SCRIPT_TAG_RE, '');
  result = result.replace(EVENT_HANDLER_RE, '');
  return encodeHtmlEntities(result);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  // Pass through numbers, booleans, null, undefined
  return value;
}

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return sanitizeValue(value);
  }
}
