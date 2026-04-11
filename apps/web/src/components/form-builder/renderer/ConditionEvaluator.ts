/**
 * ConditionEvaluator — Evaluates field conditions against form values
 * Used by FormRenderer to implement show/hide, enable/disable, setRequired logic.
 */

import type { FieldCondition, FieldConditionRule } from '../utils/form-schema';

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
