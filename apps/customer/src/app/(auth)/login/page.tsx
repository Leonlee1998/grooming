import type { Metadata } from 'next'
import { LoginClient } from './LoginClient'

export const metadata: Metadata = { title: '登入 — 寵物美容預約' }

export default function LoginPage() {
  // NEXT_PUBLIC_LINE_LIFF_ID 傳入 client component（server 讀 env，避免 bundle 洩漏）
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? null
  return <LoginClient liffId={liffId} />
}
