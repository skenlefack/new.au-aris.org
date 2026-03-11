import type { Meta, StoryObj } from '@storybook/react';
import { MapView } from './MapView';

const meta: Meta<typeof MapView> = {
  title: 'Components/MapView',
  component: MapView,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MapView>;

export const Default: Story = {
  args: {
    center: [1.5, 20.0],
    zoom: 4,
    height: '500px',
  },
};

export const WithMarkers: Story = {
  args: {
    center: [0.0, 30.0],
    zoom: 5,
    height: '500px',
    markers: [
      { id: '1', lat: -1.286, lng: 36.817, label: 'Nairobi — FMD Outbreak', color: '#C62828' },
      { id: '2', lat: 9.005, lng: 38.763, label: 'Addis Ababa — PPR Suspected', color: '#F57F17' },
      { id: '3', lat: -6.792, lng: 39.208, label: 'Dar es Salaam — HPAI Resolved', color: '#2E7D32' },
    ],
  },
};

export const WithLayers: Story = {
  args: {
    center: [5.0, 25.0],
    zoom: 4,
    height: '500px',
    layers: [
      { id: 'outbreaks', name: 'Active Outbreaks', visible: true },
      { id: 'vaccination', name: 'Vaccination Coverage', visible: false },
      { id: 'risk', name: 'Risk Heatmap', visible: false },
      { id: 'boundaries', name: 'Admin Boundaries', visible: true },
    ],
  },
};

export const Loading: Story = {
  args: {
    center: [1.5, 20.0],
    zoom: 4,
    height: '500px',
    className: 'animate-pulse opacity-60',
  },
};

export const Error: Story = {
  render: () => (
    <div className="relative overflow-hidden rounded-lg border border-red-300 bg-red-50" style={{ height: '500px' }}>
      <div className="flex h-full items-center justify-center text-red-600">
        <div className="text-center">
          <p className="text-lg font-medium">Map failed to load</p>
          <p className="text-sm text-red-400">Check your network connection</p>
        </div>
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: Default.args,
  decorators: [
    (Story) => (
      <div className="dark bg-gray-900 p-6 rounded-lg">
        <Story />
      </div>
    ),
  ],
};
