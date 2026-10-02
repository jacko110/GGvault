'use client';
import { ErrorState } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <ErrorState
        message="We couldn't load this page. Please try again in a moment."
        retry={reset}
      />
    </main>
  );
}
