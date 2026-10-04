import { readFileSync } from 'fs';
import { resolve } from 'path';
const { guard } = require('../../../scripts/beta-reset.cjs');
const schema = readFileSync(
  resolve(__dirname, '../../../packages/database/prisma/schema.prisma'),
  'utf8',
);
const allowed = {
  NODE_ENV: 'test',
  BETA_MODE: 'true',
  ENABLE_TEST_CREDITS: 'true',
  RESET_CREDIT_MODE: 'TEST',
  REAL_MONEY_MODE: 'false',
  CONFIRM_BETA_RESET: 'CREATE_NEW_TEST_DATABASE',
  DATABASE_URL: 'postgresql://test:placeholder@localhost:5432/old',
};
describe('TEST reset safety gate', () => {
  it('accepts only explicit local TEST replacement', () =>
    expect(guard(allowed, schema).hostname).toBe('localhost'));
  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: undefined },
    { REAL_MONEY_MODE: 'true' },
    { RESET_CREDIT_MODE: 'USD' },
    { CONFIRM_BETA_RESET: undefined },
    { DATABASE_URL: 'postgresql://test:placeholder@remote.example/db' },
  ])('refuses unsafe configuration', (change) =>
    expect(() => guard({ ...allowed, ...change }, schema)).toThrow(
      /Reset refused/,
    ),
  );
  it('refuses a future unreviewed schema', () =>
    expect(() => guard(allowed, schema + '\n// future money mode')).toThrow(
      /schema requires review/,
    ));
});
