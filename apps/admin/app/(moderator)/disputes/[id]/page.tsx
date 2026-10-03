import { DisputeReview } from '../../../../components/moderation';
export default function Page({ params }: { params: { id: string } }) {
  return <DisputeReview id={params.id} />;
}
