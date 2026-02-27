import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { NativeInit } from '@/components/NativeInit'
import './globals.css'

export const metadata: Metadata = {
  title: 'Todoer',
  description: 'A task manager that refuses to let you forget.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Todoer',
  },
  icons: {
    apple: '/icons/icon-192x192.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var stored = JSON.parse(localStorage.getItem('todoer-ui') || '{}');
              var theme = (stored.state && stored.state.theme) || 'dark';
              var root = document.documentElement;
              if (theme === 'system') {
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.className = prefersDark ? 'dark' : 'light';
              } else {
                root.className = theme;
              }
            } catch(e) { document.documentElement.className = 'dark'; }
          })();
        `}} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ServiceWorkerRegistration />
        <NativeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
