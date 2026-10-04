import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { authenticated, upstreamJson } from './session';
import { ApiError } from './errors';
import { failure } from './route-security';
const validId = /^c[a-z0-9]{24}$/;
export function evidencePolicy() {
  const screenshot = Number(
    process.env.EVIDENCE_SCREENSHOT_MAX_BYTES ?? 10485760,
  );
  const video = Number(process.env.EVIDENCE_VIDEO_MAX_BYTES ?? 52428800);
  if (
    ![screenshot, video].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 104857600,
    )
  )
    throw new Error('Invalid upload configuration');
  const types = (
    process.env.EVIDENCE_ALLOWED_MIME_TYPES ??
    'image/png,image/jpeg,image/webp,video/mp4'
  )
    .split(',')
    .map((t) => t.trim())
    .filter((t) =>
      ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(t),
    );
  const max = Number(process.env.MAX_EVIDENCE_SIZE ?? 52428800);
  if (!Number.isSafeInteger(max) || max < 1 || max > 104857600)
    throw new Error('Invalid upload configuration');
  return {
    screenshot: Math.min(screenshot, max),
    video: Math.min(video, max),
    types,
  };
}
export async function uploadEvidence(request: NextRequest, id: string) {
  try {
    if (!validId.test(id)) return new NextResponse(null, { status: 404 });
    const contentType = request.headers.get('content-type') ?? '';
    if (
      request.headers.get('origin') !==
        (process.env.WEB_ORIGIN ?? new URL(request.url).origin) ||
      !contentType.startsWith('multipart/form-data;')
    )
      throw new ApiError('AUTH_FORBIDDEN', 403);
    await upstreamJson(await authenticated(`/matches/${id}`));
    const policy = evidencePolicy(),
      max = Math.max(policy.screenshot, policy.video) + 65536;
    if (Number(request.headers.get('content-length') ?? 0) > max)
      throw new ApiError('EVIDENCE_TOO_LARGE', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError('EVIDENCE_FILE_REQUIRED', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > max) {
          await reader.cancel();
          throw new ApiError('EVIDENCE_TOO_LARGE', 413);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    const result = await upstreamJson(
      await authenticated(`/matches/${id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      }),
    );
    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function evidenceContent(id: string, evidenceId: string) {
  try {
    if (!validId.test(id) || !validId.test(evidenceId))
      return new NextResponse(null, { status: 404 });
    const response = await authenticated(
      `/matches/${id}/evidence/${evidenceId}/content`,
    );
    if (!response.ok) await upstreamJson(response);
    const type = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(type))
      throw new ApiError('EVIDENCE_UNAVAILABLE', 502);
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Disposition': `inline; filename="evidence-${evidenceId}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
