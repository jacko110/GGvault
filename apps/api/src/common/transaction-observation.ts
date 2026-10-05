import { AsyncLocalStorage } from 'node:async_hooks';
import { Request } from 'express';

export const transactionContext = new AsyncLocalStorage<Request>();
const transactionStage = new AsyncLocalStorage<string>();
const stages = new Map<
  string,
  {
    attempts: number;
    successes: number;
    p2034: number;
    p2028: number;
    otherErrors: number;
    durations: number[];
  }
>();
export async function observeSuboperation<T>(
  name: 'settlement',
  work: () => Promise<T>,
): Promise<T> {
  if (!labDiagnosticsEnabled()) return work();
  return transactionStage.run(name, async () => {
    const row = stages.get(name) ?? {
      attempts: 0,
      successes: 0,
      p2034: 0,
      p2028: 0,
      otherErrors: 0,
      durations: [],
    };
    stages.set(name, row);
    const started = performance.now();
    row.attempts++;
    try {
      const result = await work();
      row.successes++;
      return result;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if (code === 'P2034') row.p2034++;
      else if (code === 'P2028') row.p2028++;
      else row.otherErrors++;
      throw error;
    } finally {
      if (row.durations.length < 10000)
        row.durations.push(performance.now() - started);
    }
  });
}
export function suboperationDiagnostics(reset = false) {
  const result = Object.fromEntries(stages);
  if (reset) stages.clear();
  return result;
}
type Sample = {
  attempts: number;
  conflicts: number;
  exhausted: number;
  durationMs: number;
  maxDurationMs: number;
  successes: number;
  p2028: number;
  retries: number;
  otherErrors: number;
  durations: number[];
  admissionMs: number[];
  workMs: number[];
};
const samples = new Map<string, Sample>();
const queries = new Map<
  string,
  { count: number; durationMs: number; errors: Record<string, number> }
>();
export function labDiagnosticsEnabled() {
  return (
    process.env.NODE_ENV === 'test' &&
    process.env.TRANSACTION_DIAGNOSTICS === 'true'
  );
}
function operationName() {
  if (transactionStage.getStore()) return transactionStage.getStore()!;
  const req = transactionContext.getStore();
  const step = req?.headers['x-ggvault-lab-step'];
  if (
    labDiagnosticsEnabled() &&
    typeof step === 'string' &&
    [
      'create',
      'join',
      'fund_a',
      'fund_b',
      'ready_a',
      'ready_b',
      'result',
      'confirm',
    ].includes(step)
  )
    return step;
  return req?.route?.path ? `${req.method} ${req.route.path}` : 'internal';
}
export function observeQuery(
  model: string,
  action: string,
  durationMs: number,
  code?: string,
) {
  if (!labDiagnosticsEnabled()) return;
  const key = `${operationName()} ${model}.${action}`;
  const value = queries.get(key) ?? { count: 0, durationMs: 0, errors: {} };
  value.count++;
  value.durationMs += durationMs;
  if (code) value.errors[code] = (value.errors[code] ?? 0) + 1;
  queries.set(key, value);
}
export function queryDiagnostics(reset = false) {
  const result = Object.fromEntries(queries);
  if (reset) queries.clear();
  return result;
}
export function observeTransaction(
  durationMs: number,
  conflict: boolean,
  exhausted: boolean,
  code?: string,
  timing?: { admissionMs: number; workMs: number },
) {
  const operation = operationName();
  const row = samples.get(operation) ?? {
    attempts: 0,
    conflicts: 0,
    exhausted: 0,
    durationMs: 0,
    maxDurationMs: 0,
    successes: 0,
    p2028: 0,
    retries: 0,
    otherErrors: 0,
    durations: [],
    admissionMs: [],
    workMs: [],
  };
  row.attempts++;
  row.conflicts += Number(conflict);
  row.exhausted += Number(exhausted);
  row.successes += Number(!code && !conflict);
  row.p2028 += Number(code === 'P2028');
  row.retries += Number(conflict && !exhausted);
  row.otherErrors += Number(!!code && !conflict && code !== 'P2028');
  if (labDiagnosticsEnabled() && row.durations.length < 10000)
    row.durations.push(durationMs);
  if (labDiagnosticsEnabled() && timing && row.admissionMs.length < 10000) {
    row.admissionMs.push(timing.admissionMs);
    row.workMs.push(timing.workMs);
  }
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
