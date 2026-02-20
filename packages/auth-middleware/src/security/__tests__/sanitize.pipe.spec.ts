import { describe, it, expect } from 'vitest';
import { SanitizePipe } from '../sanitize.pipe';

describe('SanitizePipe', () => {
  const pipe = new SanitizePipe();

  it('should strip <script> tags', () => {
    const result = pipe.transform('Hello <script>alert("xss")</script> World');
    expect(result).toBe('Hello  World');
  });

  it('should strip inline event handlers', () => {
    const result = pipe.transform('<div onclick="evil()">text</div>');
    expect(result).not.toContain('onclick');
  });

  it('should HTML-encode < > & " \'', () => {
    const result = pipe.transform('<b>test</b> & "quotes" \'apos\'');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&#x27;');
  });

  it('should recursively sanitize nested objects', () => {
    const input = {
      name: '<script>alert(1)</script>John',
      details: {
        bio: '<img onerror="hack()">',
      },
    };
    const result = pipe.transform(input) as Record<string, unknown>;
    expect((result['name'] as string)).not.toContain('<script>');
    expect((result['details'] as Record<string, string>)['bio']).not.toContain(
      'onerror',
    );
  });

  it('should sanitize arrays', () => {
    const input = ['<script>x</script>', 'clean', '<b>bold</b>'];
    const result = pipe.transform(input) as string[];
    expect(result[0]).not.toContain('<script>');
    expect(result[1]).toBe('clean');
    expect(result[2]).toContain('&lt;b&gt;');
  });

  it('should pass through numbers unchanged', () => {
    expect(pipe.transform(42)).toBe(42);
  });

  it('should pass through booleans unchanged', () => {
    expect(pipe.transform(true)).toBe(true);
    expect(pipe.transform(false)).toBe(false);
  });

  it('should pass through null unchanged', () => {
    expect(pipe.transform(null)).toBeNull();
  });

  it('should pass through undefined unchanged', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('should handle mixed nested structures', () => {
    const input = {
      items: [
        { title: '<script>bad</script>Good' },
        { title: 'Clean' },
      ],
      count: 2,
      active: true,
    };
    const result = pipe.transform(input) as Record<string, unknown>;
    const items = result['items'] as Array<Record<string, string>>;
    expect(items[0]['title']).not.toContain('<script>');
    expect(items[1]['title']).toBe('Clean');
    expect(result['count']).toBe(2);
    expect(result['active']).toBe(true);
  });
});
