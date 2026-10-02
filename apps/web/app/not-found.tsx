import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">404 · OUT OF BOUNDS</span>
      <h1>This arena doesn’t exist.</h1>
      <Link className="button primary" href="/">
        Back to home
      </Link>
    </main>
  );
}
