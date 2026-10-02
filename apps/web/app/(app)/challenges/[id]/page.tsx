import { ChallengeScreen } from '@/components/challenge-screen';
export default function Challenge({ params }: { params: { id: string } }) {
  return <ChallengeScreen id={params.id} />;
}
