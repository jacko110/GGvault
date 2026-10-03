import 'server-only';
import { authenticated, upstreamJson } from '../../web/lib/session';
export async function moderatorAccess() {
  await upstreamJson(await authenticated('/auth/moderation-access'));
}
