import { NextResponse } from 'next/server';
import { evidencePolicy } from '@/lib/evidence-proxy';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json(evidencePolicy(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
