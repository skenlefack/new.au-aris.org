import jsonata from 'jsonata';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

export class TransformEngine {
  private expressionCache = new Map<string, jsonata.Expression>();

  async transform(data: unknown, expression: string): Promise<unknown> {
    let compiled = this.expressionCache.get(expression);
    if (!compiled) {
      compiled = jsonata(expression);
      this.expressionCache.set(expression, compiled);
    }
    return compiled.evaluate(data as jsonata.Focus);
  }

  async applyMappings(
    record: unknown,
    mappings: Array<{
      sourceField: string;
      targetField: string;
      transformation?: string | null;
    }>,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      try {
        let value: unknown;
        if (mapping.transformation) {
          value = await this.transform(record, mapping.transformation);
        } else {
          value = await this.transform(record, mapping.sourceField);
        }
        result[mapping.targetField] = value;
      } catch {
        // If a single mapping fails, continue with others
        result[mapping.targetField] = undefined;
      }
    }

    return result;
  }

  validateJsonSchema(
    data: unknown,
    schema: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const validate = ajv.compile(schema);
    const valid = validate(data);
    const errors = validate.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? [];
    return { valid: valid as boolean, errors };
  }

  getCacheSize(): number {
    return this.expressionCache.size;
  }

  clearCache(): void {
    this.expressionCache.clear();
  }
}
