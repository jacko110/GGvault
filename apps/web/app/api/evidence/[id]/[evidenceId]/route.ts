import { evidenceContent } from '@/lib/evidence-proxy';
export const runtime = 'nodejs';
export function GET(
  _request: Request,
  { params }: { params: { id: string; evidenceId: string } },
) {
  return evidenceContent(params.id, params.evidenceId);
}
