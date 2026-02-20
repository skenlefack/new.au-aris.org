import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QualityIndicator, QualityGateResult } from './QualityIndicator';

describe('QualityIndicator', () => {
  it('renders overall result label', () => {
    render(<QualityIndicator overallResult="PASS" />);
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it.each<[QualityGateResult, string]>([
    ['PASS', 'Pass'],
    ['WARNING', 'Warning'],
    ['FAIL', 'Fail'],
    ['SKIPPED', 'Skipped'],
  ])('renders %s as "%s"', (result, label) => {
    render(<QualityIndicator overallResult={result} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders traffic light indicator', () => {
    render(<QualityIndicator overallResult="PASS" />);
    const light = screen.getByTestId('quality-light');
    expect(light.className).toContain('bg-green-500');
  });

  it('renders red for FAIL', () => {
    render(<QualityIndicator overallResult="FAIL" />);
    const light = screen.getByTestId('quality-light');
    expect(light.className).toContain('bg-red-500');
  });

  it('renders amber for WARNING', () => {
    render(<QualityIndicator overallResult="WARNING" />);
    const light = screen.getByTestId('quality-light');
    expect(light.className).toContain('bg-amber-500');
  });

  it('does not show details by default', () => {
    render(
      <QualityIndicator
        overallResult="PASS"
        gates={[{ gate: 'COMPLETENESS', result: 'PASS' }]}
      />,
    );
    expect(screen.queryByTestId('quality-details')).not.toBeInTheDocument();
  });

  it('shows details when showDetails is true', () => {
    render(
      <QualityIndicator
        overallResult="WARNING"
        showDetails
        gates={[
          { gate: 'COMPLETENESS', result: 'PASS' },
          { gate: 'TEMPORAL_CONSISTENCY', result: 'WARNING', message: 'Check dates' },
        ]}
      />,
    );
    expect(screen.getByTestId('quality-details')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Temporal Consistency')).toBeInTheDocument();
    expect(screen.getByText(/Check dates/)).toBeInTheDocument();
  });

  it('renders gate with proper test id', () => {
    render(
      <QualityIndicator
        overallResult="PASS"
        showDetails
        gates={[{ gate: 'COMPLETENESS', result: 'PASS' }]}
      />,
    );
    expect(screen.getByTestId('quality-gate-COMPLETENESS')).toBeInTheDocument();
  });

  it('renders all 8 quality gates', () => {
    const gates = [
      'COMPLETENESS',
      'TEMPORAL_CONSISTENCY',
      'GEOGRAPHIC_CONSISTENCY',
      'CODES_VOCABULARIES',
      'UNITS',
      'DEDUPLICATION',
      'AUDITABILITY',
      'CONFIDENCE_SCORE',
    ].map((gate) => ({ gate, result: 'PASS' as const }));

    render(<QualityIndicator overallResult="PASS" showDetails gates={gates} />);
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Geographic Consistency')).toBeInTheDocument();
    expect(screen.getByText('Confidence Score')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<QualityIndicator overallResult="PASS" className="my-quality" />);
    expect(screen.getByTestId('quality-indicator').className).toContain('my-quality');
  });

  it('has accessible aria-label on traffic light', () => {
    render(<QualityIndicator overallResult="FAIL" />);
    const light = screen.getByTestId('quality-light');
    expect(light.getAttribute('aria-label')).toBe('Quality: Fail');
  });
});
