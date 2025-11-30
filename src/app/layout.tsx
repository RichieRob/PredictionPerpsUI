import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@rainbow-me/rainbowkit/styles.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Prediction Perps',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
