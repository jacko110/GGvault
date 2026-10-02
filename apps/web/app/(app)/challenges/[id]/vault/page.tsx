import { ChallengeScreen } from '@/components/challenge-screen';
export default function Vault({ params }: { params: { id: string } }) {
  return <ChallengeScreen id={params.id} vault />;
}
