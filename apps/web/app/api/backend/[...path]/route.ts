import { NextRequest, NextResponse } from 'next/server';
import { authenticated, upstreamJson } from '@/lib/session';
import { checkMutation, failure } from '@/lib/route-security';
const id = 'c[a-z0-9]{24}';
const allowed: Record<string, RegExp[]> = {
  GET: [
    /^matches$/,
    new RegExp(`^matches/${id}(/(timeline|evidence|refunds))?$`),
    /^auth\/me$/,
    /^games$/,
    /^challenges$/,
    new RegExp(`^challenges/${id}$`),
    new RegExp(`^challenges/${id}/vault$`),
    new RegExp(`^users/${id}/balance$`),
    /^users\/me\/transactions$/,
    /^users\/me\/game-accounts$/,
  ],
  POST: [
    new RegExp(`^matches/${id}/(ready|result|result/confirm|result/dispute)$`),
    /^challenges$/,
    new RegExp(`^challenges/${id}/(join|cancel|fund)$`),
    /^users\/me\/game-accounts$/,
  ],
  PATCH: [/^users\/me$/],
};
export const runtime = 'nodejs';
async function handle(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    const path = params.path.join('/');
    if (!allowed[request.method]?.some((pattern) => pattern.test(path)))
      return new NextResponse(null, { status: 404 });
    if (request.method !== 'GET') checkMutation(request);
    const raw = request.method === 'GET' ? undefined : await request.text();
    if (raw && raw.length > 8192)
      return new NextResponse(null, { status: 413 });
    const headers: Record<string, string> = {};
    if (path.endsWith('/fund'))
      headers['Idempotency-Key'] = request.headers.get('idempotency-key') ?? '';
    const result = await upstreamJson<unknown>(
      await authenticated(`/${path}${request.nextUrl.search}`, {
        method: request.method,
        body: raw,
        headers,
      }),
    );
    const safe = path.endsWith('/vault')
      ? {
          challengeId: (result as { challengeId: string }).challengeId,
          balance: (result as { balance: number }).balance,
        }
      : result;
    return NextResponse.json(safe, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
export { handle as GET, handle as POST, handle as PATCH };
