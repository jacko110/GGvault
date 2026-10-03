import { MatchScreen } from '@/components/match-screen';
export default function Page({ params }: { params: { id: string } }) {
  return <MatchScreen id={params.id} />;
}
