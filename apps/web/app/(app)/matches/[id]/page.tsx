import { MatchScreen } from '@/components/match-screen';
export default async function Page({
  params: pendingParams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingParams;
  return <MatchScreen id={params.id} />;
}
