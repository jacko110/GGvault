import { readFileSync } from 'fs';
import { join } from 'path';
import { EvidencePolicy } from '../src/matches/evidence.policy';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
  'base64',
);
const jpeg = Buffer.from(
  readFileSync(join(__dirname, 'fixtures/pixel-jpeg.base64'), 'utf8'),
  'base64',
);
const webp = Buffer.from(
  'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64',
);
// An ISO BMFF ftyp box for signature validation; not a decoded/playable video fixture.
const mp4Header = Buffer.from(
  '000000186674797069736f6d0000020069736f6d6d703432',
  'hex',
);

describe('Evidence upload policy', () => {
  const original = { ...process.env };
  afterEach(() => {
    for (const key of [
      'EVIDENCE_SCREENSHOT_MAX_BYTES',
      'EVIDENCE_VIDEO_MAX_BYTES',
      'EVIDENCE_ALLOWED_MIME_TYPES',
      'EVIDENCE_ALLOWED_EXTENSIONS',
    ]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  it.each([
    ['score.png', 'image/png', png, 'SCREENSHOT'],
    ['score.jpg', 'image/jpeg', jpeg, 'SCREENSHOT'],
    ['score.jpeg', 'image/jpeg', jpeg, 'SCREENSHOT'],
    ['score.webp', 'image/webp', webp, 'SCREENSHOT'],
    ['match.mp4', 'video/mp4', mp4Header, 'VIDEO'],
  ] as const)(
    'accepts matching content and declared type for %s',
    (originalname, mimetype, buffer, type) => {
      expect(
        new EvidencePolicy().validate(
          { originalname, mimetype, buffer, size: buffer.length },
          type,
        ),
      ).toEqual({ mime: mimetype, size: buffer.length });
    },
  );
  it('rejects mismatched screenshot/video category', () => {
    expect(() =>
      new EvidencePolicy().validate(
        {
          originalname: 'score.png',
          mimetype: 'image/png',
          buffer: png,
          size: png.length,
        },
        'VIDEO',
      ),
    ).toThrow();
  });
  it('honors configured MIME and extension restrictions', () => {
    process.env.EVIDENCE_ALLOWED_MIME_TYPES = 'image/jpeg';
    expect(() =>
      new EvidencePolicy().validate(
        {
          originalname: 'score.png',
          mimetype: 'image/png',
          buffer: png,
          size: png.length,
        },
        'SCREENSHOT',
      ),
    ).toThrow();
    process.env.EVIDENCE_ALLOWED_MIME_TYPES = 'image/png';
    process.env.EVIDENCE_ALLOWED_EXTENSIONS = '.jpg';
    expect(() =>
      new EvidencePolicy().validate(
        {
          originalname: 'score.png',
          mimetype: 'image/png',
          buffer: png,
          size: png.length,
        },
        'SCREENSHOT',
      ),
    ).toThrow();
  });
  it('does not trust the client size field', () => {
    process.env.EVIDENCE_SCREENSHOT_MAX_BYTES = '32';
    expect(() =>
      new EvidencePolicy().validate(
        {
          originalname: 'score.png',
          mimetype: 'image/png',
          buffer: png,
          size: 1,
        },
        'SCREENSHOT',
      ),
    ).toThrow();
  });
  it.each(['0', '-1', 'garbage', '104857601'])(
    'rejects unsafe configured size %s',
    (value) => {
      process.env.EVIDENCE_SCREENSHOT_MAX_BYTES = value;
      expect(() => new EvidencePolicy()).toThrow();
    },
  );
});
