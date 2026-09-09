import { Database } from '@nozbe/watermelondb';

import { error,info } from '@/utils/logger/logger';

// File d'attente globale des écritures : deux saveToCache concurrents
// (ex. semaines w-1/w+1) ne peuvent plus s'entrelacer en read-delete-create
// et ressusciter des lignes supprimées par l'autre.
let writeQueue: Promise<unknown> = Promise.resolve();

export async function safeWrite<T>(
  database: Database,
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  operationName: string = 'unnamed'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`🍉 Database write operation "${operationName}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const run = writeQueue.then(() =>
    Promise.race([
      database.write(operation),
      timeoutPromise
    ])
  );
  // La file ne doit jamais rester bloquée sur un rejet.
  writeQueue = run.catch(() => {});
  try {
    return await run;
  } catch (err) {
    error(`🍉 Failed safe write operation "${operationName}":`, String(err));
    throw err;
  }
}

export async function safeRead<T>(
  database: Database,
  operation: () => Promise<T>,
  timeoutMs: number = 5000,
  operationName: string = 'unnamed'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`🍉 Database read operation "${operationName}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      database.read(operation),
      timeoutPromise
    ]);
    info(`🍉 Completed safe read operation: ${operationName}`);
    return result;
  } catch (err) {
    error(`🍉 Failed safe read operation "${operationName}":`, String(err));
    throw err;
  }
}

export function batchOperations<T>(
  items: T[],
  batchSize: number = 100
): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

export async function executeBatchedOperations<T>(
  database: Database,
  batches: (() => Promise<T>)[],
  delayMs: number = 100,
  operationName: string = 'batched'
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < batches.length; i++) {
    info(`🍉 Executing batch ${i + 1}/${batches.length} for ${operationName}`);
    
    try {
      const result = await safeWrite(
        database,
        batches[i],
        15000,
        `${operationName}_batch_${i + 1}`
      );
      results.push(result);
      
      if (i < batches.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      error(`🍉 Failed batch ${i + 1} for ${operationName}:`, String(err));
      throw err;
    }
  }
  
  return results;
}