import { Request } from 'express';
import {
  observeQuery,
  observeSuboperation,
  observeTransaction,
  queryDiagnostics,
  suboperationDiagnostics,
  transactionContext,
  transactionDiagnostics,
} from '../src/common/transaction-observation';

describe('safe transaction diagnostics', () => {
  const old = process.env.TRANSACTION_DIAGNOSTICS;
  afterEach(() => {
    if (old === undefined) delete process.env.TRANSACTION_DIAGNOSTICS;
    else process.env.TRANSACTION_DIAGNOSTICS = old;
    transactionDiagnostics(true);
    queryDiagnostics(true);
    suboperationDiagnostics(true);
  });
  it('ignores arbitrary header identifiers and records static route templates', () => {
    process.env.TRANSACTION_DIAGNOSTICS = 'true';
    transactionContext.run(
      {
        method: 'POST',
        route: { path: '/challenges/:id/fund' },
        headers: { 'x-ggvault-lab-step': 'private-user-id' },
      } as unknown as Request,
      () => observeTransaction(10, true, false, 'P2034'),
    );
    expect(Object.keys(transactionDiagnostics())).toEqual([
      'POST /challenges/:id/fund',
    ]);
    expect(transactionDiagnostics()['POST /challenges/:id/fund']).toMatchObject(
      { attempts: 1, retries: 1, conflicts: 1, exhausted: 0 },
    );
  });
  it('disables query and stage samples outside explicitly enabled lab diagnostics', async () => {
    delete process.env.TRANSACTION_DIAGNOSTICS;
    observeQuery('LedgerAccount', 'upsert', 2);
    await observeSuboperation('settlement', async () => 1);
    expect(queryDiagnostics()).toEqual({});
    expect(suboperationDiagnostics()).toEqual({});
  });
  it('separates nested settlement work from the outer commit measurement', async () => {
    process.env.TRANSACTION_DIAGNOSTICS = 'true';
    await observeSuboperation('settlement', async () =>
      observeQuery('LedgerTransaction', 'create', 2),
    );
    expect(suboperationDiagnostics().settlement).toMatchObject({
      attempts: 1,
      successes: 1,
      p2034: 0,
    });
    expect(
      queryDiagnostics()['settlement LedgerTransaction.create'].count,
    ).toBe(1);
    expect(transactionDiagnostics()).toEqual({});
  });
});
