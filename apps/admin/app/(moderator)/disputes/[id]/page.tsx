import { DisputeReview } from '../../../../components/moderation';
export default async function Page({
  params: pendingParams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingParams;
  return <DisputeReview id={params.id} />;
}
