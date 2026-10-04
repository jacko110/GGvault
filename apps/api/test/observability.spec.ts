import { structuredLog } from '../src/common/observability';
describe('Structured logging', () => {
  it('drops runtime fields outside the explicit allowlist', () => {
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      structuredLog({
        level: 'ERROR',
        event: 'test',
        password: 'secret',
        passwordHash: 'hash',
        authorization: 'Bearer token',
        cookie: 'session',
        refreshToken: 'refresh',
        stack: 'database credential',
      } as Parameters<typeof structuredLog>[0]);
      const output = String(write.mock.calls[0][0]);
      expect(JSON.parse(output)).toMatchObject({
        level: 'ERROR',
        service: 'ggvault-api',
        event: 'test',
      });
      expect(output).not.toMatch(
        /secret|hash|token|session|refresh|credential/,
      );
    } finally {
      write.mockRestore();
    }
  });
});
