import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowStatusBadge, WorkflowStatus } from './WorkflowStatusBadge';

describe('WorkflowStatusBadge', () => {
  it('renders the status label', () => {
    render(<WorkflowStatusBadge status="DRAFT" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it.each<[WorkflowStatus, string]>([
    ['DRAFT', 'Draft'],
    ['SUBMITTED', 'Submitted'],
    ['PENDING_REVIEW', 'Pending Review'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
    ['ESCALATED', 'Escalated'],
    ['WAHIS_READY', 'WAHIS Ready'],
    ['ANALYTICS_READY', 'Analytics Ready'],
    ['PUBLISHED', 'Published'],
  ])('renders %s as "%s"', (status, label) => {
    render(<WorkflowStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders the workflow level', () => {
    render(<WorkflowStatusBadge status="PENDING_REVIEW" level={2} />);
    expect(screen.getByTestId('workflow-level')).toHaveTextContent('L2');
  });

  it('does not render level when not provided', () => {
    render(<WorkflowStatusBadge status="APPROVED" />);
    expect(screen.queryByTestId('workflow-level')).not.toBeInTheDocument();
  });

  it('applies size variant', () => {
    const { rerender } = render(<WorkflowStatusBadge status="DRAFT" size="sm" />);
    let badge = screen.getByTestId('workflow-status-badge');
    expect(badge.className).toContain('text-xs');

    rerender(<WorkflowStatusBadge status="DRAFT" size="lg" />);
    badge = screen.getByTestId('workflow-status-badge');
    expect(badge.className).toContain('text-sm');
  });

  it('hides icon when showIcon is false', () => {
    const { container } = render(<WorkflowStatusBadge status="DRAFT" showIcon={false} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('shows icon by default', () => {
    const { container } = render(<WorkflowStatusBadge status="DRAFT" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies correct color class for approved', () => {
    render(<WorkflowStatusBadge status="APPROVED" />);
    const badge = screen.getByTestId('workflow-status-badge');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-700');
  });

  it('applies correct color class for rejected', () => {
    render(<WorkflowStatusBadge status="REJECTED" />);
    const badge = screen.getByTestId('workflow-status-badge');
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-700');
  });

  it('applies custom className', () => {
    render(<WorkflowStatusBadge status="DRAFT" className="extra" />);
    expect(screen.getByTestId('workflow-status-badge').className).toContain('extra');
  });
});
