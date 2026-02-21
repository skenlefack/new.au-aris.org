import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StructuredLogger } from '../structured-logger';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new StructuredLogger();
    logger.setServiceName('test-service');
    logger.setContext('TestContext');
    StructuredLogger.currentCorrelationId = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('should output JSON to stdout for log level', () => {
    logger.log('Test message');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.service).toBe('test-service');
    expect(parsed.context).toBe('TestContext');
    expect(parsed.timestamp).toBeDefined();
  });

  it('should output JSON to stderr for error level', () => {
    logger.error('Something failed', 'stack trace here');

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Something failed');
    expect(parsed.stack).toBe('stack trace here');
  });

  it('should include correlation ID when set', () => {
    StructuredLogger.setCorrelationId('corr-123-abc');
    logger.log('With correlation');

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.correlationId).toBe('corr-123-abc');
  });

  it('should omit correlation ID when not set', () => {
    logger.log('No correlation');

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.correlationId).toBeUndefined();
  });

  it('should handle warn level', () => {
    logger.warn('Warning message');

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('warn');
  });

  it('should handle debug level', () => {
    logger.debug('Debug info');

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('debug');
  });

  it('should use context from last param if string', () => {
    logger.log('Message', 'OverriddenContext');

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.context).toBe('OverriddenContext');
  });

  it('should handle Error objects in error logs', () => {
    const error = new Error('Kaboom');
    logger.error('Crash', error);

    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.stack).toContain('Kaboom');
  });
});
