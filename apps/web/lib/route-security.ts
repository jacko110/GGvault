import { NextRequest, NextResponse } from 'next/server';
import { ApiError, friendlyError } from './errors';
export function checkMutation(request: NextRequest) {
  const expected = process.env.WEB_ORIGIN ?? new URL(request.url).origin;
  if (
    request.headers.get('origin') !== expected ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    throw new ApiError('AUTH_FORBIDDEN', 403);
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    throw new ApiError('HTTP_400', 400);
}
export async function readMutationBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError('HTTP_413', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export function failure(error: unknown) {
  const status =
    error instanceof ApiError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 503;
  const code =
    error instanceof ApiError
      ? error.code
      : status === 400
        ? 'HTTP_400'
        : 'SERVICE_UNAVAILABLE';
  return NextResponse.json(
    {
      code,
      message: friendlyError(code, status),
      requestId: error instanceof ApiError ? error.requestId : undefined,
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
