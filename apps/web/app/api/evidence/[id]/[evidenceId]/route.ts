import { evidenceContent } from '@/lib/evidence-proxy';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  {
    params: pendingParams,
  }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const params = await pendingParams;
  return evidenceContent(params.id, params.evidenceId);
}
