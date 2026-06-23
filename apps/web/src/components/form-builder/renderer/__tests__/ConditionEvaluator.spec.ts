import { describe, it, expect } from 'vitest';
import {
  evaluateFieldCondition,
  evaluateConditions,
  evaluateCrossFieldRules,
} from '../ConditionEvaluator';

// ═══════════════════════════════════════════════════════════════════
// evaluateConditions — individual operators
// ═══════════════════════════════════════════════════════════════════

describe('evaluateConditions — operators', () => {
  const vals = { name: 'Kenya', count: 42, tags: ['health', 'trade'], empty: '', nothing: null };

  it('equals — string match', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'equals', value: 'Kenya' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'equals', value: 'Nigeria' }], vals, 'all')).toBe(false);
  });

  it('equals — numeric coercion', () => {
    expect(evaluateConditions([{ field: 'count', operator: 'equals', value: '42' }], vals, 'all')).toBe(true);
  });

  it('notEquals', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'notEquals', value: 'Nigeria' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'notEquals', value: 'Kenya' }], vals, 'all')).toBe(false);
  });

  it('contains — string', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'contains', value: 'eny' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'contains', value: 'xyz' }], vals, 'all')).toBe(false);
  });

  it('contains — array', () => {
    expect(evaluateConditions([{ field: 'tags', operator: 'contains', value: 'health' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'tags', operator: 'contains', value: 'fish' }], vals, 'all')).toBe(false);
  });

  it('notContains', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'notContains', value: 'xyz' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'notContains', value: 'Ken' }], vals, 'all')).toBe(false);
  });

  it('greaterThan / lessThan', () => {
    expect(evaluateConditions([{ field: 'count', operator: 'greaterThan', value: 40 }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'count', operator: 'greaterThan', value: 42 }], vals, 'all')).toBe(false);
    expect(evaluateConditions([{ field: 'count', operator: 'lessThan', value: 50 }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'count', operator: 'lessThan', value: 42 }], vals, 'all')).toBe(false);
  });

  it('greaterOrEqual / lessOrEqual', () => {
    expect(evaluateConditions([{ field: 'count', operator: 'greaterOrEqual', value: 42 }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'count', operator: 'lessOrEqual', value: 42 }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'count', operator: 'greaterOrEqual', value: 43 }], vals, 'all')).toBe(false);
  });

  it('between', () => {
    expect(evaluateConditions([{ field: 'count', operator: 'between', value: [40, 50] }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'count', operator: 'between', value: [43, 50] }], vals, 'all')).toBe(false);
  });

  it('in / notIn', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'in', value: ['Kenya', 'Ethiopia'] }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'in', value: ['Nigeria', 'Ghana'] }], vals, 'all')).toBe(false);
    expect(evaluateConditions([{ field: 'name', operator: 'notIn', value: ['Nigeria', 'Ghana'] }], vals, 'all')).toBe(true);
  });

  it('startsWith / endsWith', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'startsWith', value: 'Ken' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'endsWith', value: 'ya' }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'startsWith', value: 'Eth' }], vals, 'all')).toBe(false);
  });

  it('isEmpty / isNotEmpty', () => {
    expect(evaluateConditions([{ field: 'empty', operator: 'isEmpty', value: null }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'nothing', operator: 'isEmpty', value: null }], vals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'name', operator: 'isEmpty', value: null }], vals, 'all')).toBe(false);
    expect(evaluateConditions([{ field: 'name', operator: 'isNotEmpty', value: null }], vals, 'all')).toBe(true);
  });

  it('isTrue / isFalse', () => {
    const boolVals = { yes: true, no: false, one: 1, zero: 0, strTrue: 'true' };
    expect(evaluateConditions([{ field: 'yes', operator: 'isTrue', value: null }], boolVals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'one', operator: 'isTrue', value: null }], boolVals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'strTrue', operator: 'isTrue', value: null }], boolVals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'no', operator: 'isFalse', value: null }], boolVals, 'all')).toBe(true);
    expect(evaluateConditions([{ field: 'zero', operator: 'isFalse', value: null }], boolVals, 'all')).toBe(true);
  });

  it('unknown operator returns false', () => {
    expect(evaluateConditions([{ field: 'name', operator: 'unknown' as any, value: 'Kenya' }], vals, 'all')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// evaluateConditions — logic modes (all / any)
// ═══════════════════════════════════════════════════════════════════

describe('evaluateConditions — logic', () => {
  const vals = { a: 10, b: 20 };

  it('all = AND — both must pass', () => {
    expect(evaluateConditions([
      { field: 'a', operator: 'greaterThan', value: 5 },
      { field: 'b', operator: 'greaterThan', value: 15 },
    ], vals, 'all')).toBe(true);
  });

  it('all = AND — one fails → false', () => {
    expect(evaluateConditions([
      { field: 'a', operator: 'greaterThan', value: 5 },
      { field: 'b', operator: 'greaterThan', value: 25 },
    ], vals, 'all')).toBe(false);
  });

  it('any = OR — one passes → true', () => {
    expect(evaluateConditions([
      { field: 'a', operator: 'greaterThan', value: 50 },
      { field: 'b', operator: 'greaterThan', value: 15 },
    ], vals, 'any')).toBe(true);
  });

  it('any = OR — none passes → false', () => {
    expect(evaluateConditions([
      { field: 'a', operator: 'greaterThan', value: 50 },
      { field: 'b', operator: 'greaterThan', value: 50 },
    ], vals, 'any')).toBe(false);
  });

  it('empty rules → true', () => {
    expect(evaluateConditions([], vals, 'all')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// evaluateFieldCondition — wrapper with action
// ═══════════════════════════════════════════════════════════════════

describe('evaluateFieldCondition', () => {
  it('evaluates condition with show action', () => {
    const result = evaluateFieldCondition({
      action: 'show',
      logic: 'all',
      rules: [{ field: 'type', operator: 'equals', value: 'outbreak' }],
    }, { type: 'outbreak' });
    expect(result).toBe(true);
  });

  it('evaluates condition that fails', () => {
    const result = evaluateFieldCondition({
      action: 'show',
      logic: 'all',
      rules: [{ field: 'type', operator: 'equals', value: 'outbreak' }],
    }, { type: 'vaccination' });
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// evaluateCrossFieldRules — cross-field validation
// ═══════════════════════════════════════════════════════════════════

describe('evaluateCrossFieldRules', () => {
  it('returns empty for no rules', () => {
    expect(evaluateCrossFieldRules(undefined, {})).toEqual({});
    expect(evaluateCrossFieldRules([], {})).toEqual({});
  });

  it('validates lessThan (date comparison)', () => {
    const rules = [{
      fieldA: 'startDate',
      fieldB: 'endDate',
      operator: 'lessThan' as const,
      message: { en: 'Start must be before end' },
      enabled: true,
    }];

    // Valid: start < end
    expect(evaluateCrossFieldRules(rules, { startDate: '2026-01-01', endDate: '2026-12-31' })).toEqual({});

    // Invalid: start > end
    const errors = evaluateCrossFieldRules(rules, { startDate: '2026-12-31', endDate: '2026-01-01' });
    expect(errors.startDate).toBe('Start must be before end');
  });

  it('validates numeric greaterThan', () => {
    const rules = [{
      fieldA: 'deaths',
      fieldB: 'cases',
      operator: 'lessOrEqual' as const,
      message: { en: 'Deaths cannot exceed cases' },
      enabled: true,
    }];

    expect(evaluateCrossFieldRules(rules, { deaths: 5, cases: 10 })).toEqual({});
    expect(evaluateCrossFieldRules(rules, { deaths: 15, cases: 10 })).toHaveProperty('deaths');
  });

  it('skips disabled rules', () => {
    const rules = [{
      fieldA: 'a',
      fieldB: 'b',
      operator: 'equals' as const,
      message: { en: 'err' },
      enabled: false,
    }];
    expect(evaluateCrossFieldRules(rules, { a: 1, b: 2 })).toEqual({});
  });

  it('skips when values are empty', () => {
    const rules = [{
      fieldA: 'a',
      fieldB: 'b',
      operator: 'lessThan' as const,
      message: { en: 'err' },
      enabled: true,
    }];
    expect(evaluateCrossFieldRules(rules, { a: '', b: 5 })).toEqual({});
    expect(evaluateCrossFieldRules(rules, { a: 10, b: null })).toEqual({});
  });

  it('uses locale-specific message', () => {
    const rules = [{
      fieldA: 'a',
      fieldB: 'b',
      operator: 'lessThan' as const,
      message: { en: 'English error', fr: 'Erreur française' },
      enabled: true,
    }];
    const errors = evaluateCrossFieldRules(rules, { a: 10, b: 5 }, 'fr');
    expect(errors.a).toBe('Erreur française');
  });
});
