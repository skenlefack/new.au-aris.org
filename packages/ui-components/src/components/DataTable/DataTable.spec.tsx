import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './DataTable';

interface TestRow {
  id: string;
  name: string;
  value: number;
}

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'value', header: 'Value', sortable: true },
];

const data: TestRow[] = [
  { id: '1', name: 'Alpha', value: 30 },
  { id: '2', name: 'Beta', value: 10 },
  { id: '3', name: 'Gamma', value: 20 },
];

const keyExtractor = (row: TestRow) => row.id;

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders all rows', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        keyExtractor={keyExtractor}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <DataTable columns={columns} data={[]} keyExtractor={keyExtractor} loading />,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('sorts by column on click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    const rows = screen.getAllByRole('row');
    // header + 3 data rows
    expect(rows).toHaveLength(4);
    // First data row after ascending sort should be Alpha
    expect(rows[1]).toHaveTextContent('Alpha');
  });

  it('paginates data', () => {
    const bigData = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i,
    }));

    render(
      <DataTable columns={columns} data={bigData} keyExtractor={keyExtractor} pageSize={10} />,
    );

    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('navigates pages', async () => {
    const user = userEvent.setup();
    const bigData = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i,
    }));

    render(
      <DataTable columns={columns} data={bigData} keyExtractor={keyExtractor} pageSize={10} />,
    );

    const nextBtn = screen.getByTestId('next-page');
    await user.click(nextBtn);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('calls onSort when column is clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <DataTable columns={columns} data={data} keyExtractor={keyExtractor} onSort={onSort} />,
    );

    await user.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('calls onPageChange when navigating', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const bigData = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i,
    }));

    render(
      <DataTable
        columns={columns}
        data={bigData}
        keyExtractor={keyExtractor}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByTestId('next-page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders custom cell render function', () => {
    const customColumns = [
      ...columns.slice(0, 2),
      {
        key: 'value',
        header: 'Value',
        render: (row: TestRow) => <strong data-testid="bold-val">{row.value}!</strong>,
      },
    ];

    render(<DataTable columns={customColumns} data={data} keyExtractor={keyExtractor} />);
    expect(screen.getAllByTestId('bold-val')).toHaveLength(3);
  });
});
