import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CryptoProvider } from '@/context/CryptoContext';
import { getActiveUserId } from '@/lib/session';

export const metadata: Metadata = {
  title: {
    default: 'Sunset Messages',
    template: '%s | Sunset Messages',
  },
  description: 'Private, end-to-end encrypted letters between Sun and Moon.',
  manifest: '/manifest.json',

  appleWebApp: {
    capable: true,
    title: 'Sunset Messages',
    statusBarStyle: 'black-translucent',
  },

  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
  },

  openGraph: {
    type: 'website',
    siteName: 'Sunset Messages',
    title: 'Sunset Messages',
    description: 'Private end-to-end encrypted letters between Sun and Moon.',
  },

  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFF8ED',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getActiveUserId();
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sunset" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        <meta name="msapplication-TileColor" content="#FFF8ED" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
      </head>
      <body className="antialiased safe-top safe-bottom">
        {/*
          CryptoProvider is a client component that:
          1. Checks IndexedDB for an existing RSA keypair
          2. Generates one if absent, stores private key in IDB
          3. Publishes the public key to /api/users/public-key
          4. Makes keypair available to all child components via useCrypto()
        */}
        <CryptoProvider userId={userId}>
          {children}
        </CryptoProvider>
      </body>
    </html>
  );
}
