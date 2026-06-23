import { describe, it, expect } from 'vitest';
import { FIELD_TYPES } from '../../utils/field-types';

// ═══════════════════════════════════════════════════════════════════
// Field types registry completeness
// ═══════════════════════════════════════════════════════════════════

describe('FIELD_TYPES registry', () => {
  it('should have at least 30 field types', () => {
    expect(FIELD_TYPES.length).toBeGreaterThanOrEqual(30);
  });

  it('should have unique type names', () => {
    const names = FIELD_TYPES.map((f) => f.type);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every type has required metadata', () => {
    for (const ft of FIELD_TYPES) {
      expect(ft.type).toBeTruthy();
      expect(ft.label).toBeTruthy();
      expect(ft.category).toBeTruthy();
      expect(ft.icon).toBeTruthy();
    }
  });

  // ── Expected field types ─────────────────────────────────────

  const expectedTypes = [
    // Text
    'text', 'textarea', 'number', 'email', 'phone', 'url',
    // Choice
    'select', 'multi-select', 'radio', 'checkbox', 'toggle', 'rating',
    // Data source
    'master-data-select', 'form-data-select', 'cascade-select',
    // Date/time
    'date', 'time', 'datetime', 'date-range',
    // Location
    'admin-location', 'geo-point', 'geo-polygon', 'geo-selector',
    // Media
    'file-upload', 'image', 'signature',
    // Calculation
    'calculated', 'auto-id', 'lookup',
    // Layout
    'heading', 'divider', 'info-box', 'spacer',
    // Advanced
    'repeater', 'matrix', 'conditional-group',
  ];

  for (const type of expectedTypes) {
    it(`includes "${type}" field type`, () => {
      const found = FIELD_TYPES.find((f) => f.type === type);
      expect(found).toBeDefined();
    });
  }

  // ── Categories ───────────────────────────────────────────────

  const expectedCategories = [
    'text', 'choice', 'data-source', 'date-time', 'location', 'media', 'calculation', 'layout', 'advanced',
  ];

  it('covers all expected categories', () => {
    const categories = new Set(FIELD_TYPES.map((f) => f.category));
    for (const cat of expectedCategories) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});
