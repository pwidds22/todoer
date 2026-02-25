import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
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
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <ServiceWorkerRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
