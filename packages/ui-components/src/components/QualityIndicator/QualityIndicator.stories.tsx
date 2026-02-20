import type { Meta, StoryObj } from '@storybook/react';
import { QualityIndicator, QualityGateResult } from './QualityIndicator';

const meta: Meta<typeof QualityIndicator> = {
  title: 'Components/QualityIndicator',
  component: QualityIndicator,
  tags: ['autodocs'],
  argTypes: {
    overallResult: {
      control: 'select',
      options: ['PASS', 'FAIL', 'WARNING', 'SKIPPED'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof QualityIndicator>;

export const Pass: Story = {
  args: {
    overallResult: 'PASS',
  },
};

export const Warning: Story = {
  args: {
    overallResult: 'WARNING',
  },
};

export const Fail: Story = {
  args: {
    overallResult: 'FAIL',
  },
};

export const AllResults: Story = {
  render: () => {
    const results: QualityGateResult[] = ['PASS', 'WARNING', 'FAIL', 'SKIPPED'];
    return (
      <div className="flex items-center gap-6">
        {results.map((r) => (
          <QualityIndicator key={r} overallResult={r} />
        ))}
      </div>
    );
  },
};

export const WithDetails: Story = {
  args: {
    overallResult: 'WARNING',
    showDetails: true,
    gates: [
      { gate: 'COMPLETENESS', result: 'PASS' },
      { gate: 'TEMPORAL_CONSISTENCY', result: 'PASS' },
      { gate: 'GEOGRAPHIC_CONSISTENCY', result: 'WARNING', message: 'Coordinates outside admin boundary' },
      { gate: 'CODES_VOCABULARIES', result: 'PASS' },
      { gate: 'UNITS', result: 'PASS' },
      { gate: 'DEDUPLICATION', result: 'WARNING', message: 'Possible duplicate found' },
      { gate: 'AUDITABILITY', result: 'PASS' },
      { gate: 'CONFIDENCE_SCORE', result: 'PASS' },
    ],
  },
};

export const FailedGates: Story = {
  args: {
    overallResult: 'FAIL',
    showDetails: true,
    gates: [
      { gate: 'COMPLETENESS', result: 'FAIL', message: 'Missing required field: species' },
      { gate: 'TEMPORAL_CONSISTENCY', result: 'FAIL', message: 'Confirmation date before suspicion' },
      { gate: 'GEOGRAPHIC_CONSISTENCY', result: 'PASS' },
      { gate: 'CODES_VOCABULARIES', result: 'PASS' },
      { gate: 'UNITS', result: 'SKIPPED' },
      { gate: 'DEDUPLICATION', result: 'PASS' },
      { gate: 'AUDITABILITY', result: 'PASS' },
      { gate: 'CONFIDENCE_SCORE', result: 'WARNING', message: 'Only rumor-level' },
    ],
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-start gap-6">
      <QualityIndicator overallResult="PASS" size="sm" />
      <QualityIndicator overallResult="PASS" size="md" />
      <QualityIndicator overallResult="PASS" size="lg" />
    </div>
  ),
};
