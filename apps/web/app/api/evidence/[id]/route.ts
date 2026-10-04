import { NextRequest } from 'next/server';
import { uploadEvidence } from '@/lib/evidence-proxy';
export const runtime = 'nodejs';
export async function POST(
  request: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  return uploadEvidence(request, params.id);
}
