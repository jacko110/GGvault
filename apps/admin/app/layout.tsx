import type { ReactNode } from 'react';
import '../../web/app/globals.css';
import './admin.css';
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
