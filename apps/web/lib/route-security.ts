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
export function failure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 503;
  const code = error instanceof ApiError ? error.code : 'SERVICE_UNAVAILABLE';
  return NextResponse.json(
    { code, message: friendlyError(code, status) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
