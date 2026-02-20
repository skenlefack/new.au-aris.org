import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Active Outbreaks" value={42} />);
    expect(screen.getByText('Active Outbreaks')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(<KpiCard label="Coverage" value="87.3" unit="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders trend with direction and value', () => {
    render(
      <KpiCard
        label="Outbreaks"
        value={42}
        trend={{ direction: 'up', value: '+12%', label: 'vs last month' }}
      />,
    );
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('does not render trend when not provided', () => {
    const { container } = render(<KpiCard label="Count" value={10} />);
    expect(container.querySelector('.flex.items-center.gap-1')).toBeNull();
  });

  it('renders icon when provided', () => {
    render(
      <KpiCard label="Test" value={1} icon={<span data-testid="icon">I</span>} />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    render(<KpiCard label="Test" value={1} variant="primary" />);
    const card = screen.getByTestId('kpi-card');
    expect(card.className).toContain('aris-primary');
  });

  it('applies custom className', () => {
    render(<KpiCard label="Test" value={1} className="custom-class" />);
    const card = screen.getByTestId('kpi-card');
    expect(card.className).toContain('custom-class');
  });

  it('renders down trend', () => {
    render(
      <KpiCard label="Test" value={1} trend={{ direction: 'down', value: '-5%' }} />,
    );
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('renders neutral trend', () => {
    render(
      <KpiCard label="Test" value={1} trend={{ direction: 'neutral', value: '0%' }} />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
