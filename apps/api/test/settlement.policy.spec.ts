import { SettlementPolicy } from '../src/ledger/settlement.policy';

describe('SettlementPolicy integer test-credit fee', () => {
  const original = process.env.PLATFORM_FEE_BPS;
  afterEach(() => {
    if (original === undefined) delete process.env.PLATFORM_FEE_BPS;
    else process.env.PLATFORM_FEE_BPS = original;
  });
  it('defaults to five percent and floors fractional fees', () => {
    delete process.env.PLATFORM_FEE_BPS;
    const policy = new SettlementPolicy();
    expect(policy.calculate(20)).toEqual({
      vaultAmount: 20,
      winnerAmount: 19,
      platformFee: 1,
      feeBasisPoints: 500,
    });
    expect(policy.calculate(19).platformFee).toBe(0);
    expect(policy.calculate(2147483647).platformFee).toBe(107374182);
  });
  it.each(['-1', '10001', '1.5', '', 'NaN', ' 500', '5e2'])(
    'rejects invalid configuration %s',
    (value) => {
      process.env.PLATFORM_FEE_BPS = value;
      expect(() => new SettlementPolicy()).toThrow();
    },
  );
  it.each(['0', '10000'])('supports boundary fee %s', (value) => {
    process.env.PLATFORM_FEE_BPS = value;
    const result = new SettlementPolicy().calculate(20);
    expect(result.platformFee).toBe(value === '0' ? 0 : 20);
    expect(result.winnerAmount + result.platformFee).toBe(20);
  });
  it.each([0, -1, 1.5, 2147483648])('rejects invalid vault %s', (value) => {
    expect(() => new SettlementPolicy().calculate(value)).toThrow();
  });
});
