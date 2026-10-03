import { NextRequest, NextResponse } from 'next/server';
import { authenticated, upstreamJson } from '../../../../../web/lib/session';
import { checkMutation, failure } from '../../../../../web/lib/route-security';
import { moderatorAccess } from '../../../../lib/access';
const id = 'c[a-z0-9]{24}';
const allowed: Record<string, RegExp[]> = {
  GET: [
    /^moderation\/disputes$/,
    new RegExp(`^moderation/disputes/${id}$`),
    new RegExp(`^matches/${id}(/(timeline|evidence|refunds))?$`),
  ],
  POST: [new RegExp(`^moderation/disputes/${id}/resolve$`)],
};
export const runtime = 'nodejs';
async function handle(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    const path = params.path.join('/');
    if (!allowed[request.method]?.some((p) => p.test(path)))
      return new NextResponse(null, { status: 404 });
    if (request.method !== 'GET') checkMutation(request);
    await moderatorAccess();
    const body = request.method === 'GET' ? undefined : await request.text();
    if (body && body.length > 8192)
      return new NextResponse(null, { status: 413 });
    return NextResponse.json(
      await upstreamJson(
        await authenticated(`/${path}${request.nextUrl.search}`, {
          method: request.method,
          body,
        }),
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
export { handle as GET, handle as POST };
