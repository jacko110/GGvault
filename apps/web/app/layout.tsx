import './globals.css';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GGVault',
  description: 'Competitive gaming challenge platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
