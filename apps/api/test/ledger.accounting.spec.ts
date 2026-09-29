import { calculateBalance, calculateConservation, assertBalanced, assertPositiveInteger } from '@ggvault/ledger';

type LedgerEntry = { ledgerAccountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number };

function totalCredits(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.direction === 'CREDIT').reduce((s, e) => s + e.amount, 0);
}

function totalDebits(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.direction === 'DEBIT').reduce((s, e) => s + e.amount, 0);
}

describe('ledger accounting', () => {
  it('creates a balanced initial credit transaction', () => {
    const entries: LedgerEntry[] = [
      { ledgerAccountId: 'system-account', direction: 'DEBIT', amount: 100 },
      { ledgerAccountId: 'user-amir-available', direction: 'CREDIT', amount: 100 },
    ];

    expect(entries).toHaveLength(2);
    expect(totalCredits(entries)).toBe(100);
    expect(totalDebits(entries)).toBe(100);
    expect(calculateBalance(entries, 'user-amir-available')).toBe(100);
    expect(calculateConservation(entries)).toBe(0);
  });

  it('locks a user stake into the challenge vault and preserves conservation', () => {
    const entries: LedgerEntry[] = [
      { ledgerAccountId: 'user-amir-available', direction: 'DEBIT', amount: 10 },
      { ledgerAccountId: 'challenge-01-vault', direction: 'CREDIT', amount: 10 },
    ];

    expect(totalCredits(entries)).toBe(totalDebits(entries));
    expect(calculateBalance(entries, 'user-amir-available')).toBe(-10);
    expect(calculateBalance(entries, 'challenge-01-vault')).toBe(10);
    expect(calculateConservation(entries)).toBe(0);
  });

  it('rejects invalid amounts', () => {
    expect(() => assertPositiveInteger(0, 'amount')).toThrow('amount');
    expect(() => assertPositiveInteger(-1, 'amount')).toThrow('amount');
  });
});
