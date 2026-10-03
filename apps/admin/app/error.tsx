'use client';
import { Button, ErrorState } from '../../web/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="admin-main">
      <ErrorState message="The review service is temporarily unavailable." />
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
