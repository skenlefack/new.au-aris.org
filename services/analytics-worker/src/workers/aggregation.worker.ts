import { parentPort, workerData } from 'worker_threads';

interface WorkerInput {
  domain: string;
  records: Record<string, unknown>[];
}

interface GroupByResult {
  [key: string]: number;
}

interface AggregateResult {
  field: string;
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

interface KpiOutput {
  domain: string;
  kpis: {
    count: number;
    aggregates: AggregateResult[];
    groupBy: GroupByResult;
  };
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function aggregate(input: WorkerInput): KpiOutput {
  const { domain, records } = input;
  const count = records.length;

  // Identify numeric fields from the first record
  const numericFields: string[] = [];
  if (records.length > 0) {
    const sample = records[0];
    for (const [key, value] of Object.entries(sample)) {
      if (isNumeric(value)) {
        numericFields.push(key);
      }
    }
  }

  // Compute aggregates for each numeric field
  const aggregates: AggregateResult[] = numericFields.map((field) => {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let numericCount = 0;

    for (const record of records) {
      const value = record[field];
      if (isNumeric(value)) {
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
        numericCount++;
      }
    }

    return {
      field,
      sum,
      avg: numericCount > 0 ? sum / numericCount : 0,
      min: numericCount > 0 ? min : 0,
      max: numericCount > 0 ? max : 0,
      count: numericCount,
    };
  });

  // Group-by counts on 'status' field (common across domains)
  const groupBy: GroupByResult = {};
  for (const record of records) {
    const status = record['status'];
    if (typeof status === 'string') {
      groupBy[status] = (groupBy[status] ?? 0) + 1;
    }
  }

  return {
    domain,
    kpis: {
      count,
      aggregates,
      groupBy,
    },
  };
}

// Worker thread entry point
if (parentPort) {
  const input = workerData as WorkerInput;
  try {
    const result = aggregate(input);
    parentPort.postMessage({ success: true, data: result });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
