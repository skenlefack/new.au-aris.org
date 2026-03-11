import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './DataTable';

interface TestRow {
  id: string;
  name: string;
  value: number;
  nested?: { deep: string };
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

  it('shows default empty message', () => {
    render(
      <DataTable columns={columns} data={[]} keyExtractor={keyExtractor} />,
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <DataTable columns={columns} data={[]} keyExtractor={keyExtractor} loading />,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('sorts by column ascending on first click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);

    await act(async () => {
      await user.click(screen.getByText('Name'));
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Alpha');
  });

  it('sorts descending on second click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);

    // First click: ascending
    await act(async () => {
      await user.click(screen.getByText('Name'));
    });
    // Second click: descending
    await act(async () => {
      await user.click(screen.getByText('Name'));
    });

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Gamma');
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

    await act(async () => {
      await user.click(screen.getByTestId('next-page'));
    });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('does not navigate beyond last page', async () => {
    const user = userEvent.setup();
    const smallData = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i,
    }));

    render(
      <DataTable columns={columns} data={smallData} keyExtractor={keyExtractor} pageSize={3} />,
    );

    // Go to page 2 (last page)
    await act(async () => {
      await user.click(screen.getByTestId('next-page'));
    });
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    // Click next again — should stay on page 2
    await act(async () => {
      await user.click(screen.getByTestId('next-page'));
    });
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('does not navigate before first page', async () => {
    const user = userEvent.setup();
    const bigData = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      value: i,
    }));

    render(
      <DataTable columns={columns} data={bigData} keyExtractor={keyExtractor} pageSize={10} />,
    );

    const prevBtn = screen.getByTestId('prev-page');
    expect(prevBtn).toBeDisabled();
  });

  it('calls onSort when column is clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <DataTable columns={columns} data={data} keyExtractor={keyExtractor} onSort={onSort} />,
    );

    await act(async () => {
      await user.click(screen.getByText('Name'));
    });
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

    await act(async () => {
      await user.click(screen.getByTestId('next-page'));
    });
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

  it('handles nested value access', () => {
    const nestedColumns = [
      { key: 'id', header: 'ID' },
      { key: 'nested.deep', header: 'Deep' },
    ];
    const nestedData: TestRow[] = [
      { id: '1', name: 'A', value: 1, nested: { deep: 'found' } },
    ];

    render(<DataTable columns={nestedColumns} data={nestedData} keyExtractor={keyExtractor} />);
    expect(screen.getByText('found')).toBeInTheDocument();
  });

  it('handles missing nested value gracefully', () => {
    const nestedColumns = [
      { key: 'id', header: 'ID' },
      { key: 'nested.deep', header: 'Deep' },
    ];
    const noNestedData: TestRow[] = [
      { id: '1', name: 'A', value: 1 },
    ];

    render(<DataTable columns={nestedColumns} data={noNestedData} keyExtractor={keyExtractor} />);
    // Should render empty string for missing nested value
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toBeInTheDocument();
  });

  it('handles sorting with null values', async () => {
    const user = userEvent.setup();
    const nullableData = [
      { id: '1', name: 'Alpha', value: 30, nested: { deep: 'a' } },
      { id: '2', name: 'Beta', value: 10 },
      { id: '3', name: 'Gamma', value: 20 },
    ];

    const nestedColumns = [
      { key: 'id', header: 'ID' },
      { key: 'nested.deep', header: 'Deep', sortable: true },
    ];

    render(
      <DataTable columns={nestedColumns} data={nullableData} keyExtractor={keyExtractor} />,
    );

    await act(async () => {
      await user.click(screen.getByText('Deep'));
    });
    // Should not crash, nulls sort to end
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('supports server-side pagination', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={keyExtractor}
        currentPage={2}
        totalItems={50}
        pageSize={10}
      />,
    );
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Showing 11–20 of 50')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <DataTable columns={columns} data={data} keyExtractor={keyExtractor} className="my-table" />,
    );
    expect(screen.getByTestId('data-table').className).toContain('my-table');
  });

  it('does not sort non-sortable columns', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} keyExtractor={keyExtractor} />);

    // ID column is not sortable
    await act(async () => {
      await user.click(screen.getByText('ID'));
    });

    // Data should remain in original order
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alpha');
    expect(rows[2]).toHaveTextContent('Beta');
    expect(rows[3]).toHaveTextContent('Gamma');
  });
});
