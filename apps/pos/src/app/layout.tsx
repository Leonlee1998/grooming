import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '寵物美容 POS',
  description: '寵物美容店 iPad 收銀暨報到系統',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '美容POS',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <meta name="theme-color" content="#78573A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
