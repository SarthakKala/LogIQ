import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'LogIQ',
  description: 'Observability dashboard',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#E8D8C4] text-[#561C24] antialiased">
        {children}
      </body>
    </html>
  );
}
