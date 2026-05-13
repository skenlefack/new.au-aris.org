/**
 * ConditionEvaluator — Evaluates field conditions against form values
 * Used by FormRenderer to implement show/hide, enable/disable, setRequired logic.
 */

import type { FieldCondition, FieldConditionRule, CrossFieldValidationRule } from '../utils/form-schema';

/**
 * Evaluate a single condition rule against the current form values.
 */
function evaluateRule(rule: FieldConditionRule, formValues: Record<string, unknown>): boolean {
  const fieldValue = formValues[rule.field];
  const ruleValue = rule.value;

  switch (rule.operator) {
    case 'equals':
      return fieldValue === ruleValue || String(fieldValue) === String(ruleValue);

    case 'notEquals':
      return fieldValue !== ruleValue && String(fieldValue) !== String(ruleValue);

    case 'contains': {
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(ruleValue);
      }
      return false;
    }

    case 'notContains': {
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return !fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(ruleValue);
      }
      return true;
    }

    case 'greaterThan':
      return toNumber(fieldValue) !== null && toNumber(ruleValue) !== null
        && toNumber(fieldValue)! > toNumber(ruleValue)!;

    case 'lessThan':
      return toNumber(fieldValue) !== null && toNumber(ruleValue) !== null
        && toNumber(fieldValue)! < toNumber(ruleValue)!;

    case 'greaterOrEqual':
      return toNumber(fieldValue) !== null && toNumber(ruleValue) !== null
        && toNumber(fieldValue)! >= toNumber(ruleValue)!;

    case 'lessOrEqual':
      return toNumber(fieldValue) !== null && toNumber(ruleValue) !== null
        && toNumber(fieldValue)! <= toNumber(ruleValue)!;

    case 'between': {
      const num = toNumber(fieldValue);
      if (num === null || !Array.isArray(ruleValue) || ruleValue.length < 2) return false;
      const low = toNumber(ruleValue[0]);
      const high = toNumber(ruleValue[1]);
      if (low === null || high === null) return false;
      return num >= low && num <= high;
    }

    case 'in': {
      if (!Array.isArray(ruleValue)) return false;
      return ruleValue.some((v) => v === fieldValue || String(v) === String(fieldValue));
    }

    case 'notIn': {
      if (!Array.isArray(ruleValue)) return true;
      return !ruleValue.some((v) => v === fieldValue || String(v) === String(fieldValue));
    }

    case 'startsWith': {
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return fieldValue.toLowerCase().startsWith(ruleValue.toLowerCase());
      }
      return false;
    }

    case 'endsWith': {
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return fieldValue.toLowerCase().endsWith(ruleValue.toLowerCase());
      }
      return false;
    }

    case 'isEmpty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
        || (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'isNotEmpty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
        && !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'isTrue':
      return fieldValue === true || fieldValue === 'true' || fieldValue === 1;

    case 'isFalse':
      return fieldValue === false || fieldValue === 'false' || fieldValue === 0 || fieldValue === '';

    default:
      // Unknown operator — treat as non-matching
      return false;
  }
}

/**
 * Convert a value to a number, returning null if not possible.
 */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Evaluate all rules in a condition using the specified logic.
 * @param rules - Array of condition rules
 * @param formValues - Current form values keyed by field code
 * @param logic - 'all' = AND (every rule must pass), 'any' = OR (at least one)
 */
export function evaluateConditions(
  rules: FieldConditionRule[],
  formValues: Record<string, unknown>,
  logic: 'all' | 'any',
): boolean {
  if (!rules || rules.length === 0) return true;

  if (logic === 'all') {
    return rules.every((rule) => evaluateRule(rule, formValues));
  }
  return rules.some((rule) => evaluateRule(rule, formValues));
}

/**
 * Evaluate a full FieldCondition (with its rules and logic) and return the result.
 */
export function evaluateFieldCondition(
  condition: FieldCondition,
  formValues: Record<string, unknown>,
): boolean {
  return evaluateConditions(condition.rules, formValues, condition.logic);
}

/**
 * Compare two values (numbers or date strings).
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b, null if not comparable.
 */
function compareValues(a: unknown, b: unknown): number | null {
  // Try as dates first (ISO strings like "2026-01-15")
  if (typeof a === 'string' && typeof b === 'string') {
    const da = Date.parse(a);
    const db = Date.parse(b);
    if (Number.isFinite(da) && Number.isFinite(db)) {
      return da < db ? -1 : da > db ? 1 : 0;
    }
  }
  // Try as numbers
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) {
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  // String comparison fallback
  if (typeof a === 'string' && typeof b === 'string' && a !== '' && b !== '') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return null;
}

/**
 * Evaluate cross-field validation rules against form values.
 * Returns a map of fieldCode → error message for fields that fail validation.
 */
export function evaluateCrossFieldRules(
  rules: CrossFieldValidationRule[] | undefined,
  formValues: Record<string, unknown>,
  locale: string = 'en',
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!rules || rules.length === 0) return errors;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const valA = formValues[rule.fieldA];
    const valB = formValues[rule.fieldB];

    // Skip if either value is empty (don't validate unfilled fields)
    if (valA === null || valA === undefined || valA === '') continue;
    if (valB === null || valB === undefined || valB === '') continue;

    const cmp = compareValues(valA, valB);
    if (cmp === null) continue; // not comparable

    let violated = false;
    switch (rule.operator) {
      case 'lessThan':
        violated = cmp >= 0; // a should be < b
        break;
      case 'lessOrEqual':
        violated = cmp > 0;
        break;
      case 'greaterThan':
        violated = cmp <= 0;
        break;
      case 'greaterOrEqual':
        violated = cmp < 0;
        break;
      case 'equals':
        violated = cmp !== 0;
        break;
      case 'notEquals':
        violated = cmp === 0;
        break;
    }

    if (violated) {
      errors[rule.fieldA] = rule.message[locale] || rule.message.en || rule.message.fr || 'Validation error';
    }
  }

  return errors;
}
