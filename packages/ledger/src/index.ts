export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerEntryLike {
  ledgerAccountId: string;
  direction: LedgerDirection;
  amount: number;
}

export function assertPositiveInteger(amount: number, fieldName: string): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

export function assertBalanced(entries: LedgerEntryLike[]): void {
  const debits = entries
    .filter((entry) => entry.direction === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const credits = entries
    .filter((entry) => entry.direction === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amount, 0);

  if (debits !== credits) {
    throw new Error('ledger entries are not balanced');
  }
}

export function calculateBalance(entries: LedgerEntryLike[], accountId: string): number {
  return entries.reduce((total, entry) => {
    if (entry.ledgerAccountId !== accountId) {
      return total;
    }

    return total + (entry.direction === 'CREDIT' ? entry.amount : -entry.amount);
  }, 0);
}

export function calculateConservation(entries: LedgerEntryLike[]): number {
  return entries.reduce((total, entry) => {
    return total + (entry.direction === 'CREDIT' ? entry.amount : -entry.amount);
  }, 0);
}
