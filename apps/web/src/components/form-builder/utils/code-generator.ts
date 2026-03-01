// FormBuilder — Code generator and condition evaluator utilities

import type { MultilingualText } from './form-schema';

export function generateCodeFromLabel(label: MultilingualText): string {
  const text = label.en || label.fr || Object.values(label).find(v => v) || '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'field';
}

export function ensureUniqueCode(code: string, existingCodes: string[]): string {
  if (!existingCodes.includes(code)) return code;
  let counter = 2;
  while (existingCodes.includes(`${code}_${counter}`)) counter++;
  return `${code}_${counter}`;
}
