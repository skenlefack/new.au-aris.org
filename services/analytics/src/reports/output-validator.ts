/**
 * output-validator.ts — Post-generation guardrails for AI-produced report content.
 *
 * Checks:
 *   1. Anti-PVS: block any mention of PVS (prohibited)
 *   2. Unknown acronyms: warn on unrecognized uppercase abbreviations
 *   3. Anti-hallucination: verify numbers in output exist in source data
 *   4. Length bounds: warn if output is too short or too long
 *   5. Language heuristic: warn if output seems to be in the wrong language
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class OutputValidator {
  // Known institutions / acronyms to avoid false positives
  private knownAcronyms = new Set([
    'AU', 'IBAR', 'OMSA', 'FAO', 'CAADP', 'ECOWAS', 'EAC', 'IGAD', 'SADC', 'ECCAS',
    'COMESA', 'AMU', 'CEN-SAD', 'WAHIS', 'EMPRES', 'FAOSTAT', 'GDP', 'GHG', 'AMR',
    'SPS', 'PPR', 'FMD', 'ASF', 'HPAI', 'RVF', 'CBPP', 'LSD', 'CITES', 'WDPA',
  ]);

  validate(output: string, context: {
    expectedLanguage: string;
    resolvedData?: any;
    expectedLengthMin?: number;
    expectedLengthMax?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Anti-PVS : bloquer
    if (/\bPVS\b/.test(output) || /performance of veterinary services/i.test(output)) {
      errors.push('Output contains prohibited PVS mention');
    }

    // 2. Acronymes non reconnus : warning
    const acronyms = output.match(/\b[A-Z]{3,}\b/g) || [];
    for (const acr of acronyms) {
      if (!this.knownAcronyms.has(acr)) {
        warnings.push(`Unknown acronym: ${acr}`);
      }
    }

    // 3. Anti-hallucination chiffres : si des donnees sont fournies, verifier que les chiffres de l'output viennent des donnees
    if (context.resolvedData) {
      // Extraire tous les nombres du contexte
      const dataNumbers = this.extractNumbers(JSON.stringify(context.resolvedData));
      const outputNumbers = this.extractNumbers(output);
      for (const num of outputNumbers) {
        if (num > 1 && num < 100000 && !this.isYearLike(num)) {
          const found = dataNumbers.some(d => Math.abs(d - num) / Math.max(Math.abs(d), 1) < 0.02);
          if (!found) {
            warnings.push(`Unverified number in output: ${num}`);
          }
        }
      }
    }

    // 4. Longueur
    if (context.expectedLengthMin && output.length < context.expectedLengthMin) {
      warnings.push(`Output too short: ${output.length} chars (min ${context.expectedLengthMin})`);
    }
    if (context.expectedLengthMax && output.length > context.expectedLengthMax) {
      warnings.push(`Output too long: ${output.length} chars (max ${context.expectedLengthMax})`);
    }

    // 5. Langue (heuristique simple)
    if (context.expectedLanguage === 'fr' && !/[éèêëàâùûôîç]/i.test(output)) {
      warnings.push('Output may not be in French (no accented characters detected)');
    }
    if (context.expectedLanguage === 'ar' && !/[\u0600-\u06FF]/.test(output)) {
      warnings.push('Output may not be in Arabic');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private extractNumbers(text: string): number[] {
    return (text.match(/\b\d+(?:[.,]\d+)?\b/g) || [])
      .map(n => parseFloat(n.replace(',', '.')))
      .filter(n => !isNaN(n));
  }

  private isYearLike(n: number): boolean {
    return n >= 1900 && n <= 2100;
  }
}
