import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TenantSelector, TenantNode } from './TenantSelector';

const sampleTenants: TenantNode[] = [
  {
    id: 'au-ibar',
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
          { id: 'ug', name: 'Uganda', code: 'UG', level: 'MEMBER_STATE' },
          { id: 'so', name: 'Somalia', code: 'SO', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'ecowas',
        name: 'ECOWAS',
        code: 'ECOWAS',
        level: 'REC',
        children: [
          { id: 'ng', name: 'Nigeria', code: 'NG', level: 'MEMBER_STATE' },
          { id: 'sn', name: 'Senegal', code: 'SN', level: 'MEMBER_STATE' },
          { id: 'gh', name: 'Ghana', code: 'GH', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'sadc',
        name: 'SADC',
        code: 'SADC',
        level: 'REC',
        children: [
          { id: 'za', name: 'South Africa', code: 'ZA', level: 'MEMBER_STATE' },
          { id: 'tz', name: 'Tanzania', code: 'TZ', level: 'MEMBER_STATE' },
          { id: 'mz', name: 'Mozambique', code: 'MZ', level: 'MEMBER_STATE' },
        ],
      },
    ],
  },
];

const meta: Meta<typeof TenantSelector> = {
  title: 'Components/TenantSelector',
  component: TenantSelector,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TenantSelector>;

export const Default: Story = {
  args: {
    tenants: sampleTenants,
    onSelect: (id) => console.log('Selected:', id),
  },
};

export const WithSelection: Story = {
  args: {
    tenants: sampleTenants,
    selectedId: 'ke',
    onSelect: (id) => console.log('Selected:', id),
  },
};

export const Disabled: Story = {
  args: {
    tenants: sampleTenants,
    selectedId: 'au-ibar',
    onSelect: () => {},
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    tenants: [],
    onSelect: () => {},
    placeholder: 'Loading tenants...',
    disabled: true,
    className: 'animate-pulse opacity-60',
  },
};

export const Error: Story = {
  args: {
    tenants: [],
    onSelect: () => {},
    placeholder: 'Failed to load tenants',
    disabled: true,
    className: 'border-red-300',
  },
};

export const DarkMode: Story = {
  args: {
    tenants: sampleTenants,
    selectedId: 'ke',
    onSelect: (id) => console.log('Selected:', id),
  },
  decorators: [
    (Story) => (
      <div className="dark bg-gray-900 p-6 rounded-lg max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  render: () => {
    const [selectedId, setSelectedId] = useState<string | undefined>();
    return (
      <TenantSelector
        tenants={sampleTenants}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />
    );
  },
};
