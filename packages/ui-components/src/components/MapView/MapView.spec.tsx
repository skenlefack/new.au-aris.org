import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MapView } from './MapView';

describe('MapView', () => {
  it('renders the map container', () => {
    render(<MapView />);
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<MapView height="600px" />);
    const container = screen.getByTestId('map-container');
    expect(container.style.height).toBe('600px');
  });

  it('renders layer controls when layers provided', () => {
    const layers = [
      { id: 'outbreaks', name: 'Active Outbreaks', visible: true },
      { id: 'vaccination', name: 'Vaccination Coverage', visible: false },
    ];

    render(<MapView layers={layers} />);
    expect(screen.getByTestId('layer-controls')).toBeInTheDocument();
    expect(screen.getByText('Active Outbreaks')).toBeInTheDocument();
    expect(screen.getByText('Vaccination Coverage')).toBeInTheDocument();
  });

  it('does not render layer controls when no layers', () => {
    render(<MapView />);
    expect(screen.queryByTestId('layer-controls')).not.toBeInTheDocument();
  });

  it('calls onLayerToggle when checkbox changes', async () => {
    const user = userEvent.setup();
    const onLayerToggle = vi.fn();
    const layers = [
      { id: 'outbreaks', name: 'Active Outbreaks', visible: true },
    ];

    render(<MapView layers={layers} onLayerToggle={onLayerToggle} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(onLayerToggle).toHaveBeenCalledWith('outbreaks', false);
  });

  it('renders checkbox with correct initial state', () => {
    const layers = [
      { id: 'a', name: 'Layer A', visible: true },
      { id: 'b', name: 'Layer B', visible: false },
    ];

    render(<MapView layers={layers} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('applies custom className', () => {
    render(<MapView className="my-map" />);
    expect(screen.getByTestId('map-view').className).toContain('my-map');
  });
});
