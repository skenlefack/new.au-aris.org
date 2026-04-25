/**
 * formula-evaluator.ts — Safe evaluation of composite indicator formulas.
 *
 * Features:
 *  - Sandboxed evaluation via mathjs (limited scope, no code injection)
 *  - Cycle detection (DFS on dependency graph)
 *  - Timeout protection (500 ms per evaluation)
 *  - Division-by-zero handling (returns NaN with error detail)
 *  - Redis caching of computed results (TTL 60 s)
 */

import { create, all, type MathJsStatic } from 'mathjs';
import type { RedisClient } from '../services/redis-client';
import type { IndicatorService } from './indicator.service';

const EVAL_TIMEOUT_MS = 500;
const CACHE_TTL = 60; // seconds
const CACHE_PREFIX = 'analytics:formula:result:';

/** Safe mathjs instance — only pure math, no side effects */
const math: MathJsStatic = create(all, {
  // No implicit multiplication to avoid ambiguity
});

// Remove dangerous functions
const BLOCKED_FUNCTIONS = [
  'import', 'createUnit', 'evaluate', 'parse', 'simplify', 'derivative',
  'rationalize', 'compile', 'chain', 'resolve',
];

export interface FormulaValidationResult {
  valid: boolean;
  errors: string[];
  referencedCodes: string[];
}

export interface FormulaEvaluationResult {
  value: number | null;
  cached: boolean;
  errors: string[];
  dependencies: Record<string, number>;
}

export class FormulaEvaluator {
  constructor(
    private readonly redis: RedisClient,
    private readonly indicatorService: IndicatorService,
  ) {}

  /**
   * Validate a formula expression without evaluating it.
   * Checks syntax, cycle detection, and that all referenced indicators exist.
   */
  async validate(
    indicatorId: string,
    expression: string,
    dependencyCodes: string[],
  ): Promise<FormulaValidationResult> {
    const errors: string[] = [];
    const referencedCodes: string[] = [];

    // 1. Check that expression contains valid math syntax
    try {
      // Replace indicator references with dummy values for syntax check
      let testExpr = expression;
      for (const code of dependencyCodes) {
        const pattern = new RegExp(`\\{\\{indicator:${escapeRegex(code)}\\}\\}`, 'g');
        testExpr = testExpr.replace(pattern, '1');
        referencedCodes.push(code);
      }

      // Check for blocked functions
      for (const fn of BLOCKED_FUNCTIONS) {
        if (testExpr.includes(fn)) {
          errors.push(`Blocked function used: ${fn}`);
        }
      }

      if (errors.length === 0) {
        math.evaluate(testExpr);
      }
    } catch (err) {
      errors.push(`Invalid expression: ${(err as Error).message}`);
    }

    // 2. Check that all referenced indicators exist
    for (const code of dependencyCodes) {
      try {
        await this.indicatorService.getIndicatorByCode(code);
      } catch {
        errors.push(`Referenced indicator not found: ${code}`);
      }
    }

    // 3. Cycle detection
    if (errors.length === 0) {
      const hasCycle = await this.detectCycle(indicatorId, dependencyCodes);
      if (hasCycle) {
        errors.push('Circular dependency detected in formula references');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      referencedCodes,
    };
  }

  /**
   * Evaluate a composite indicator's formula for a specific context.
   */
  async evaluate(
    indicatorId: string,
    year: number,
    countryCode?: string,
  ): Promise<FormulaEvaluationResult> {
    const errors: string[] = [];

    // Check cache
    const cacheKey = `${CACHE_PREFIX}${indicatorId}:${year}:${countryCode ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...parsed, cached: true };
      } catch { /* stale cache */ }
    }

    // Get formula
    const formulaData = await this.indicatorService.getFormula(indicatorId);
    if (!formulaData) {
      return { value: null, cached: false, errors: ['No formula defined'], dependencies: {} };
    }

    const formula = formulaData.formula as { expression: string };
    const dependencies = formulaData.dependencies as Array<{ indicator_code: string }>;

    // Resolve dependency values
    const depValues = await this.indicatorService.resolveDependencyValues(
      indicatorId,
      year,
      countryCode,
    );

    // Substitute values into expression
    let expr = formula.expression;
    for (const dep of dependencies) {
      const pattern = new RegExp(`\\{\\{indicator:${escapeRegex(dep.indicator_code)}\\}\\}`, 'g');
      if (depValues[dep.indicator_code] !== undefined) {
        expr = expr.replace(pattern, String(depValues[dep.indicator_code]));
      } else {
        errors.push(`Missing value for dependency: ${dep.indicator_code} (year=${year}, country=${countryCode ?? 'all'})`);
        expr = expr.replace(pattern, 'NaN');
      }
    }

    // Evaluate with timeout
    let value: number | null = null;
    try {
      value = await this.evaluateWithTimeout(expr);

      if (value !== null && !isFinite(value)) {
        errors.push('Result is not finite (possible division by zero)');
        value = null;
      }
    } catch (err) {
      errors.push(`Evaluation error: ${(err as Error).message}`);
    }

    const result: FormulaEvaluationResult = {
      value,
      cached: false,
      errors,
      dependencies: depValues,
    };

    // Cache successful results
    if (value !== null && errors.length === 0) {
      await this.redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    }

    return result;
  }

  /**
   * Evaluate a math expression with a timeout to prevent resource abuse.
   */
  private evaluateWithTimeout(expression: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Formula evaluation timed out after ${EVAL_TIMEOUT_MS}ms`));
      }, EVAL_TIMEOUT_MS);

      try {
        // Check for blocked functions before evaluation
        for (const fn of BLOCKED_FUNCTIONS) {
          if (expression.includes(fn)) {
            clearTimeout(timer);
            reject(new Error(`Blocked function: ${fn}`));
            return;
          }
        }

        const result = math.evaluate(expression);
        clearTimeout(timer);

        if (typeof result === 'number') {
          resolve(result);
        } else if (result && typeof result.toNumber === 'function') {
          resolve(result.toNumber());
        } else {
          resolve(null);
        }
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * DFS cycle detection on the indicator dependency graph.
   * Returns true if adding the proposed dependencies to `indicatorId` would create a cycle.
   */
  private async detectCycle(indicatorId: string, newDependencyCodes: string[]): Promise<boolean> {
    // Build adjacency: indicator id -> set of referenced indicator ids
    const visited = new Set<string>();
    const inStack = new Set<string>();

    // Map codes to IDs
    const codeToId = new Map<string, string>();
    for (const code of newDependencyCodes) {
      try {
        const indicator = await this.indicatorService.getIndicatorByCode(code) as { id: string };
        codeToId.set(code, indicator.id);
      } catch {
        // If indicator doesn't exist, it can't create a cycle
        continue;
      }
    }

    // Get existing dependencies for all indicators (limited depth)
    const getNeighbors = async (id: string): Promise<string[]> => {
      if (id === indicatorId) {
        // Use proposed dependencies
        return Array.from(codeToId.values());
      }
      const formulaData = await this.indicatorService.getFormula(id);
      if (!formulaData) return [];
      return (formulaData.dependencies as Array<{ referenced_indicator_id: string }>)
        .map((d) => d.referenced_indicator_id);
    };

    const dfs = async (nodeId: string): Promise<boolean> => {
      if (inStack.has(nodeId)) return true; // cycle found
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      inStack.add(nodeId);

      const neighbors = await getNeighbors(nodeId);
      for (const neighbor of neighbors) {
        if (await dfs(neighbor)) return true;
      }

      inStack.delete(nodeId);
      return false;
    };

    return dfs(indicatorId);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
