import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { serializable } from '../src/common/domain';
import { PrismaService } from '../src/database/prisma.service';

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('private detail', {
    code,
    clientVersion: 'test',
  });
describe('bounded transaction retries', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('retries serialization conflicts with the same closure and isolation', async () => {
    const admission = jest.fn().mockResolvedValue(0);
    const tx = { $executeRaw: admission };
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(known('P2034'))
      .mockImplementation((callback) => callback(tx));
    const work = jest.fn().mockImplementation(async (client) => {
      expect(client).toBe(tx);
      expect(admission).toHaveBeenCalledWith([
        'LOCK TABLE ledger_transactions IN SHARE ROW EXCLUSIVE MODE',
      ]);
      return 'ok';
    });
    const result = serializable(
      { $transaction: transaction } as unknown as PrismaService,
      work,
    );
    await jest.runAllTimersAsync();
    await expect(result).resolves.toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 15000,
      maxWait: 5000,
    });
  });
  it.each([
    known('P2002'),
    known('P2028'),
    new HttpException('insufficient funds', 400),
    new HttpException('forbidden', 403),
    new HttpException('state changed', 409),
  ])('does not retry permanent failures', async (error) => {
    const transaction = jest.fn().mockRejectedValue(error);
    await expect(
      serializable(
        { $transaction: transaction } as unknown as PrismaService,
        jest.fn(),
      ),
    ).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('exhausts after nine attempts and exposes only the safe domain error', async () => {
    const transaction = jest.fn().mockRejectedValue(known('P2034'));
    const result = serializable(
      { $transaction: transaction } as unknown as PrismaService,
      jest.fn(),
    ).catch((error) => error);
    await jest.runAllTimersAsync();
    const error = await result;
    expect(transaction).toHaveBeenCalledTimes(9);
    if (!(error instanceof HttpException))
      throw new Error('Expected safe HttpException');
    expect(error.getResponse()).toMatchObject({ code: 'TRANSACTION_RETRY' });
    expect(error.message).not.toMatch(/Prisma|P2034|private detail/);
  });
});
