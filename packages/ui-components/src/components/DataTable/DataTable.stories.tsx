import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';

interface Outbreak {
  id: string;
  disease: string;
  country: string;
  status: string;
  cases: number;
  reportedAt: string;
}

const sampleData: Outbreak[] = Array.from({ length: 50 }, (_, i) => ({
  id: `OB-${String(i + 1).padStart(4, '0')}`,
  disease: ['FMD', 'PPR', 'HPAI', 'ASF', 'RVF'][i % 5],
  country: ['Kenya', 'Ethiopia', 'Nigeria', 'Senegal', 'Tanzania'][i % 5],
  status: ['confirmed', 'suspected', 'resolved'][i % 3],
  cases: Math.floor(Math.random() * 500) + 1,
  reportedAt: new Date(2025, 0, i + 1).toISOString().split('T')[0],
}));

const meta: Meta<typeof DataTable<Outbreak>> = {
  title: 'Components/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable<Outbreak>>;

export const Default: Story = {
  args: {
    columns: [
      { key: 'id', header: 'ID', sortable: true },
      { key: 'disease', header: 'Disease', sortable: true },
      { key: 'country', header: 'Country', sortable: true },
      { key: 'status', header: 'Status', sortable: true },
      { key: 'cases', header: 'Cases', sortable: true },
      { key: 'reportedAt', header: 'Reported', sortable: true },
    ],
    data: sampleData,
    keyExtractor: (row: Outbreak) => row.id,
    pageSize: 10,
  },
};

export const WithData: Story = {
  args: {
    ...Default.args,
    data: sampleData.slice(0, 5),
    pageSize: 20,
  },
};

export const Empty: Story = {
  args: {
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
    ],
    data: [],
    keyExtractor: (row: Outbreak) => row.id,
    emptyMessage: 'No outbreaks found for this period.',
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    data: [],
    loading: true,
  },
};

export const Error: Story = {
  args: {
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'disease', header: 'Disease' },
    ],
    data: [],
    keyExtractor: (row: Outbreak) => row.id,
    emptyMessage: 'Error loading data. Please try again.',
    className: 'border-red-300',
  },
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
