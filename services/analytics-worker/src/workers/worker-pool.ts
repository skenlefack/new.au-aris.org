import { Worker } from 'worker_threads';
import path from 'path';

interface QueueItem<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  data: unknown;
}

/**
 * Worker pool for CPU-intensive aggregation tasks.
 * Spawns up to `maxWorkers` Worker Threads running the aggregation worker script.
 */
export class WorkerPool {
  private pool: Worker[] = [];
  private queue: Array<QueueItem<unknown>> = [];
  private activeWorkers = 0;
  private shuttingDown = false;

  constructor(private readonly maxWorkers: number = 4) {}

  async runTask<T>(data: unknown): Promise<T> {
    if (this.shuttingDown) {
      throw new Error('WorkerPool is shutting down');
    }

    return new Promise<T>((resolve, reject) => {
      if (this.activeWorkers < this.maxWorkers) {
        this.spawnWorker<T>(data, resolve, reject);
      } else {
        this.queue.push({
          resolve: resolve as (value: unknown) => void,
          reject,
          data,
        });
      }
    });
  }

  private spawnWorker<T>(
    data: unknown,
    resolve: (value: T) => void,
    reject: (reason: unknown) => void,
  ): void {
    this.activeWorkers++;

    const workerPath = path.resolve(__dirname, 'aggregation.worker.js');
    const worker = new Worker(workerPath, { workerData: data });

    this.pool.push(worker);

    worker.on('message', (result: { success: boolean; data?: T; error?: string }) => {
      this.activeWorkers--;
      this.removeWorker(worker);

      if (result.success) {
        resolve(result.data as T);
      } else {
        reject(new Error(result.error ?? 'Worker task failed'));
      }

      this.processQueue();
    });

    worker.on('error', (error: Error) => {
      this.activeWorkers--;
      this.removeWorker(worker);
      reject(error);
      this.processQueue();
    });

    worker.on('exit', (code: number) => {
      if (code !== 0) {
        this.activeWorkers--;
        this.removeWorker(worker);
        reject(new Error(`Worker exited with code ${code}`));
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const item = this.queue.shift();
      if (item) {
        this.spawnWorker(item.data, item.resolve, item.reject);
      }
    }
  }

  private removeWorker(worker: Worker): void {
    const index = this.pool.indexOf(worker);
    if (index !== -1) {
      this.pool.splice(index, 1);
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    // Reject all queued tasks
    for (const item of this.queue) {
      item.reject(new Error('WorkerPool shutting down'));
    }
    this.queue = [];

    // Terminate all active workers
    const terminatePromises = this.pool.map((worker) => worker.terminate());
    await Promise.all(terminatePromises);
    this.pool = [];
    this.activeWorkers = 0;
  }
}
