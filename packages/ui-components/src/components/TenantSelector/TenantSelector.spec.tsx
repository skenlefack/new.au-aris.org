import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TenantSelector, TenantNode } from './TenantSelector';

const tenants: TenantNode[] = [
  {
    id: 'au',
    name: 'AU-IBAR',
    code: 'AU',
    level: 'CONTINENTAL',
    children: [
      {
        id: 'igad',
        name: 'IGAD',
        code: 'IGAD',
        level: 'REC',
        children: [
          { id: 'ke', name: 'Kenya', code: 'KE', level: 'MEMBER_STATE' },
          { id: 'et', name: 'Ethiopia', code: 'ET', level: 'MEMBER_STATE' },
        ],
      },
    ],
  },
];

describe('TenantSelector', () => {
  it('renders with placeholder', () => {
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} />);
    expect(screen.getByText('Select tenant...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows selected tenant name', () => {
    render(<TenantSelector tenants={tenants} selectedId="ke" onSelect={vi.fn()} />);
    expect(screen.getByText('Kenya')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} />);

    await user.click(screen.getByTestId('tenant-trigger'));
    expect(screen.getByTestId('tenant-dropdown')).toBeInTheDocument();
  });

  it('calls onSelect when tenant is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TenantSelector tenants={tenants} onSelect={onSelect} />);

    await user.click(screen.getByTestId('tenant-trigger'));
    await user.click(screen.getByTestId('tenant-option-au'));

    expect(onSelect).toHaveBeenCalledWith('au', expect.objectContaining({ name: 'AU-IBAR' }));
  });

  it('closes dropdown after selection', async () => {
    const user = userEvent.setup();
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} />);

    await user.click(screen.getByTestId('tenant-trigger'));
    await user.click(screen.getByTestId('tenant-option-au'));

    expect(screen.queryByTestId('tenant-dropdown')).not.toBeInTheDocument();
  });

  it('expands children on expand button click', async () => {
    const user = userEvent.setup();
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} />);

    await user.click(screen.getByTestId('tenant-trigger'));

    // Initially, children of AU should not show because IGAD is not expanded
    expect(screen.queryByTestId('tenant-option-ke')).not.toBeInTheDocument();

    // Expand AU
    await user.click(screen.getByTestId('expand-au'));
    expect(screen.getByTestId('tenant-option-igad')).toBeInTheDocument();

    // Expand IGAD
    await user.click(screen.getByTestId('expand-igad'));
    expect(screen.getByTestId('tenant-option-ke')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-option-et')).toBeInTheDocument();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<TenantSelector tenants={tenants} onSelect={vi.fn()} disabled />);

    await user.click(screen.getByTestId('tenant-trigger'));
    expect(screen.queryByTestId('tenant-dropdown')).not.toBeInTheDocument();
  });

  it('shows tenant level badge', () => {
    render(<TenantSelector tenants={tenants} selectedId="ke" onSelect={vi.fn()} />);
    expect(screen.getByText('(Member State)')).toBeInTheDocument();
  });
});
