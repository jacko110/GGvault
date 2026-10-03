import { NextRequest } from 'next/server';
import { uploadEvidence } from '@/lib/evidence-proxy';
export const runtime = 'nodejs';
export function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return uploadEvidence(request, params.id);
}
