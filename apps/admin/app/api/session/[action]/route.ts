import { NextRequest, NextResponse } from 'next/server';
import { POST as sessionAction } from '../../../../../web/app/api/session/[action]/route';
export const runtime = 'nodejs';
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  if (!['login', 'logout', 'refresh'].includes((await context.params).action))
    return new NextResponse(null, { status: 404 });
  return sessionAction(request, context);
}
