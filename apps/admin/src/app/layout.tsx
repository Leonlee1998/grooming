import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pet Grooming Admin',
  description: 'Back-office management for pet grooming operations',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
