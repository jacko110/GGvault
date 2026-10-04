import { evidenceContent } from '../../../../../../web/lib/evidence-proxy';
import { failure } from '../../../../../../web/lib/route-security';
import { moderatorAccess } from '../../../../../lib/access';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  {
    params: pendingParams,
  }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const params = await pendingParams;
  try {
    await moderatorAccess();
    return evidenceContent(params.id, params.evidenceId);
  } catch (error) {
    return failure(error);
  }
}
