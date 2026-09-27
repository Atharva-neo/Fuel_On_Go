import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { AIChatBot } from '@/components/AIChatBot';

export const metadata: Metadata = {
  title: 'Fuel on Go AI | Smart CNG Slot Booking',
  description: 'Smart CNG queue and slot booking for India powered by AI.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen font-sans text-gray-900">
        <Navbar trustScore={100} />
        <main className="max-w-md mx-auto min-h-[calc(100vh-60px)] shadow-2xl bg-white relative pb-20">
          {children}
          <AIChatBot />
        </main>
      </body>
    </html>
  );
}
