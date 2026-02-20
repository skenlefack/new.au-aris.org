import type { Meta, StoryObj } from '@storybook/react';
import { KpiCard } from './KpiCard';
import { Activity, Bug, Syringe, BarChart3 } from 'lucide-react';

const meta: Meta<typeof KpiCard> = {
  title: 'Components/KpiCard',
  component: KpiCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'accent'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {
  args: {
    label: 'Active Outbreaks',
    value: 42,
    trend: { direction: 'up', value: '+12%', label: 'vs last month' },
  },
};

export const Primary: Story = {
  args: {
    label: 'Vaccination Coverage',
    value: '87.3',
    unit: '%',
    variant: 'primary',
    icon: <Syringe className="h-5 w-5" />,
    trend: { direction: 'up', value: '+5.2%', label: 'vs last quarter' },
  },
};

export const Secondary: Story = {
  args: {
    label: 'Data Quality Score',
    value: '94.1',
    unit: '%',
    variant: 'secondary',
    icon: <BarChart3 className="h-5 w-5" />,
    trend: { direction: 'neutral', value: '0%', label: 'stable' },
  },
};

export const Accent: Story = {
  args: {
    label: 'Pending Validations',
    value: 156,
    variant: 'accent',
    icon: <Activity className="h-5 w-5" />,
    trend: { direction: 'down', value: '-8%', label: 'improving' },
  },
};

export const WithoutTrend: Story = {
  args: {
    label: 'Total Species Tracked',
    value: '1,284',
    icon: <Bug className="h-5 w-5" />,
  },
};

export const DashboardRow: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active Outbreaks"
        value={42}
        variant="accent"
        trend={{ direction: 'up', value: '+12%', label: 'vs last month' }}
      />
      <KpiCard
        label="Vaccination Coverage"
        value="87.3"
        unit="%"
        variant="primary"
        trend={{ direction: 'up', value: '+5.2%' }}
      />
      <KpiCard
        label="Pending Validations"
        value={156}
        trend={{ direction: 'down', value: '-8%' }}
      />
      <KpiCard
        label="Quality Score"
        value="94.1"
        unit="%"
        variant="secondary"
        trend={{ direction: 'neutral', value: '0%' }}
      />
    </div>
  ),
};
