import { Injectable } from '@nestjs/common';

@Injectable()
export class SettlementPolicy {
  readonly feeBasisPoints: number;
  constructor() {
    const value = process.env.PLATFORM_FEE_BPS ?? '500';
    if (!/^\d+$/.test(value) || Number(value) > 10000)
      throw new Error('PLATFORM_FEE_BPS must be an integer from 0 to 10000');
    this.feeBasisPoints = Number(value);
  }
  calculate(vaultAmount: number) {
    if (
      !Number.isSafeInteger(vaultAmount) ||
      vaultAmount <= 0 ||
      vaultAmount > 2147483647
    )
      throw new Error('Vault amount must be a positive PostgreSQL integer');
    // BigInt division floors nonnegative values, without floating-point rounding.
    const platformFee = Number(
      (BigInt(vaultAmount) * BigInt(this.feeBasisPoints)) / 10000n,
    );
    return {
      vaultAmount,
      platformFee,
      winnerAmount: vaultAmount - platformFee,
      feeBasisPoints: this.feeBasisPoints,
    };
  }
}
