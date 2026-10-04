import { betaConfig } from '../src/common/beta-config';
import { EvidencePolicy } from '../src/matches/evidence.policy';
import { LocalEvidenceStorage } from '../src/matches/evidence.storage';

describe('Beta configuration and upload boundary', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it.each(['NaN', '-1', '0', '1.5', '999999999999999999999'])(
    'rejects invalid beta limit %s',
    (value) => {
      process.env.MAX_STAKE_TEST_CREDITS = value;
      expect(() => betaConfig()).toThrow('Invalid MAX_STAKE_TEST_CREDITS');
    },
  );
  it('rejects misspelled boolean configuration', () => {
    process.env.BETA_MODE = 'yes';
    expect(() => betaConfig()).toThrow('Invalid BETA_MODE');
  });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
    'base64',
  );
  it.each([
    '../../test.png',
    '..\\..\\test.png',
    '<script>.png',
    'x'.repeat(256) + '.png',
  ])('rejects unsafe filename %s', (originalname) => {
    expect(() =>
      new EvidencePolicy().validate(
        { buffer: png, size: png.length, originalname, mimetype: 'image/png' },
        'SCREENSHOT',
      ),
    ).toThrow();
  });
  it('accepts safe Unicode filename without using it as the storage key', () => {
    expect(
      new EvidencePolicy().validate(
        {
          buffer: png,
          size: png.length,
          originalname: '\u6bd4\u8d5b.png',
          mimetype: 'image/png',
        },
        'SCREENSHOT',
      ).mime,
    ).toBe('image/png');
  });
  it('rejects path traversal at the storage boundary', async () => {
    await expect(
      new LocalEvidenceStorage().read('../../secret'),
    ).rejects.toThrow('Invalid evidence object key');
  });
});
