import { AsyncLocalStorage } from 'node:async_hooks';
import { Request } from 'express';

export const transactionContext = new AsyncLocalStorage<Request>();
type Sample = {
  attempts: number;
  conflicts: number;
  exhausted: number;
  durationMs: number;
  maxDurationMs: number;
};
const samples = new Map<string, Sample>();
export function observeTransaction(
  durationMs: number,
  conflict: boolean,
  exhausted: boolean,
) {
  const req = transactionContext.getStore();
  const operation = req?.route?.path
    ? `${req.method} ${req.route.path}`
    : 'internal';
  const row = samples.get(operation) ?? {
    attempts: 0,
    conflicts: 0,
    exhausted: 0,
    durationMs: 0,
    maxDurationMs: 0,
  };
  row.attempts++;
  row.conflicts += Number(conflict);
  row.exhausted += Number(exhausted);
  row.durationMs += durationMs;
  row.maxDurationMs = Math.max(row.maxDurationMs, durationMs);
  samples.set(operation, row);
}
export function transactionDiagnostics(reset = false) {
  const result = Object.fromEntries(
    [...samples].map(([key, value]) => [key, { ...value }]),
  );
  if (reset) samples.clear();
  return result;
}
