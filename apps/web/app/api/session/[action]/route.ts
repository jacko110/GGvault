import { NextRequest, NextResponse } from 'next/server';
import {
  beginSession,
  cookieName,
  cookieOptions,
  endSession,
  refreshSession,
} from '@/lib/session';
import { checkMutation, failure } from '@/lib/route-security';
export const runtime = 'nodejs';
export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } },
) {
  let validMutation = false;
  try {
    checkMutation(request);
    validMutation = true;
    const action = params.action;
    if (!['login', 'register', 'logout', 'refresh'].includes(action))
      return new NextResponse(null, { status: 404 });
    const response = NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    if (action === 'logout') {
      await endSession();
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
    } else if (action === 'refresh') await refreshSession();
    else {
      const raw = await request.text();
      if (raw.length > 8192) return new NextResponse(null, { status: 413 });
      const sid = await beginSession(
        action as 'login' | 'register',
        JSON.parse(raw),
      );
      response.cookies.set(cookieName, sid, cookieOptions);
    }
    return response;
  } catch (error) {
    const response = failure(error);
    if (validMutation && params.action === 'logout')
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }
}
