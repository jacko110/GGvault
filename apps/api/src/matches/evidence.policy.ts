import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { fail } from '../common/domain';
import { betaConfig } from '../common/beta-config';

export interface EvidenceUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
const formats = {
  'image/png': { extensions: ['.png'], type: 'SCREENSHOT' },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], type: 'SCREENSHOT' },
  'image/webp': { extensions: ['.webp'], type: 'SCREENSHOT' },
  'video/mp4': { extensions: ['.mp4'], type: 'VIDEO' },
};
function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100 * 1024 * 1024)
    throw new Error(`Invalid ${name} configuration`);
  return value;
}
export function uploadLimits() {
  return {
    screenshot: Math.min(
      limit('EVIDENCE_SCREENSHOT_MAX_BYTES', 10 * 1024 * 1024),
      betaConfig().maxEvidence,
    ),
    video: Math.min(
      limit('EVIDENCE_VIDEO_MAX_BYTES', 50 * 1024 * 1024),
      betaConfig().maxEvidence,
    ),
  };
}

// Header/container checks supplement MIME/extension validation. They are not malware scanning or media decoding.
function detectedMime(data: Buffer): string | undefined {
  if (
    data.length >= 45 &&
    data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    data.toString('ascii', 12, 16) === 'IHDR' &&
    data.toString('ascii', data.length - 8, data.length - 4) === 'IEND'
  )
    return 'image/png';
  if (
    data.length >= 12 &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255 &&
    data[data.length - 2] === 255 &&
    data[data.length - 1] === 217
  )
    return 'image/jpeg';
  if (
    data.length >= 20 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP' &&
    data.readUInt32LE(4) + 8 === data.length &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16))
  )
    return 'image/webp';
  if (
    data.length >= 24 &&
    data.toString('ascii', 4, 8) === 'ftyp' &&
    data.readUInt32BE(0) >= 16 &&
    data.readUInt32BE(0) <= data.length &&
    ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(
      data.toString('ascii', 8, 12),
    )
  )
    return 'video/mp4';
  return undefined;
}

@Injectable()
export class EvidencePolicy {
  readonly limits = uploadLimits();
  private readonly mimes = new Set(
    (process.env.EVIDENCE_ALLOWED_MIME_TYPES ?? Object.keys(formats).join(','))
      .split(',')
      .map((s) => s.trim()),
  );
  private readonly extensions = new Set(
    (process.env.EVIDENCE_ALLOWED_EXTENSIONS ?? '.png,.jpg,.jpeg,.webp,.mp4')
      .split(',')
      .map((s) => s.trim().toLowerCase()),
  );
  validate(file: EvidenceUpload | undefined, type: 'SCREENSHOT' | 'VIDEO') {
    if (!file || !file.buffer?.length)
      fail(400, 'EVIDENCE_FILE_REQUIRED', 'One nonempty file is required.');
    const max =
      type === 'SCREENSHOT' ? this.limits.screenshot : this.limits.video;
    if (file.buffer.length > max)
      fail(
        413,
        'EVIDENCE_TOO_LARGE',
        'Evidence exceeds the configured size limit.',
      );
    if (
      file.originalname.length > 255 ||
      /[\x00-\x1f\x7f/\\<>]/.test(file.originalname)
    )
      fail(400, 'EVIDENCE_INVALID_FILENAME', 'Invalid original filename.');
    const mime = detectedMime(file.buffer);
    const format = mime ? formats[mime as keyof typeof formats] : undefined;
    const extension = extname(file.originalname).toLowerCase();
    if (
      !mime ||
      !format ||
      format.type !== type ||
      mime !== file.mimetype ||
      !this.mimes.has(mime) ||
      !this.extensions.has(extension) ||
      !format.extensions.includes(extension)
    )
      fail(
        400,
        'EVIDENCE_INVALID_TYPE',
        'File content, MIME type, extension and evidence type must agree.',
      );
    return { mime, size: file.buffer.length };
  }
}
