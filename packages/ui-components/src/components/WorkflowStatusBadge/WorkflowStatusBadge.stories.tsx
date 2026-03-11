import type { Meta, StoryObj } from '@storybook/react';
import { WorkflowStatusBadge, WorkflowStatus } from './WorkflowStatusBadge';

const meta: Meta<typeof WorkflowStatusBadge> = {
  title: 'Components/WorkflowStatusBadge',
  component: WorkflowStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: [
        'DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED',
        'ESCALATED', 'WAHIS_READY', 'ANALYTICS_READY', 'PUBLISHED',
      ],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowStatusBadge>;

export const Default: Story = {
  args: {
    status: 'PENDING_REVIEW',
    level: 2,
  },
};

export const AllStatuses: Story = {
  render: () => {
    const statuses: WorkflowStatus[] = [
      'DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED',
      'ESCALATED', 'WAHIS_READY', 'ANALYTICS_READY', 'PUBLISHED',
    ];
    return (
      <div className="flex flex-wrap gap-3">
        {statuses.map((status) => (
          <WorkflowStatusBadge key={status} status={status} />
        ))}
      </div>
    );
  },
};

export const WithLevels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <WorkflowStatusBadge status="PENDING_REVIEW" level={1} />
      <WorkflowStatusBadge status="APPROVED" level={2} />
      <WorkflowStatusBadge status="PENDING_REVIEW" level={3} />
      <WorkflowStatusBadge status="PUBLISHED" level={4} />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <WorkflowStatusBadge status="APPROVED" size="sm" />
      <WorkflowStatusBadge status="APPROVED" size="md" />
      <WorkflowStatusBadge status="APPROVED" size="lg" />
    </div>
  ),
};

export const WithoutIcon: Story = {
  args: {
    status: 'SUBMITTED',
    showIcon: false,
  },
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse">
      <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-1 text-xs text-gray-400">
        Loading...
      </span>
    </div>
  ),
};

export const Error: Story = {
  args: {
    status: 'REJECTED',
    level: 1,
    size: 'lg',
  },
};

export const DarkMode: Story = {
  render: () => {
    const statuses: WorkflowStatus[] = [
      'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAHIS_READY', 'PUBLISHED',
    ];
    return (
      <div className="dark bg-gray-900 p-6 rounded-lg">
        <div className="flex flex-wrap gap-3">
          {statuses.map((status) => (
            <WorkflowStatusBadge key={status} status={status} />
          ))}
        </div>
      </div>
    );
  },
};
