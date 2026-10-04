import { ChallengeScreen } from '@/components/challenge-screen';
export default async function Vault({
  params: pendingParams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingParams;
  return <ChallengeScreen id={params.id} vault />;
}
