import { hashPassword, verifyPassword } from '../src/auth/password';
describe('Argon2id passwords', () => {
  it('salts hashes and verifies a passphrase', async () => {
    const password = 'correct horse battery staple';
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, password)).toBe(true);
    expect(await verifyPassword(first, 'incorrect password')).toBe(false);
  });
  it('does not authenticate legacy passwordless accounts', async () => {
    expect(await verifyPassword('', 'anything')).toBe(false);
  });
});
