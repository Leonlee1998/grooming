'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Status =
  | 'detecting' // LIFF 初始化中
  | 'not-in-liff' // 不在 LINE 瀏覽器裡，顯示按鈕讓用戶手動登入
  | 'not-bound' // LINE 帳號尚未綁定任何客戶
  | 'error' // 發生錯誤

export function LoginClient({ liffId }: { liffId: string | null }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('detecting')
  const [displayName, setDisplayName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!liffId) {
      setStatus('not-in-liff')
      return
    }

    let cancelled = false

    import('@line/liff')
      .then(async ({ default: liff }) => {
        await liff.init({ liffId })
        if (cancelled) return

        if (!liff.isInClient() && !liff.isLoggedIn()) {
          // 在桌機瀏覽器或尚未登入 — 觸發 LINE Login redirect
          liff.login({
            redirectUri: window.location.href,
          })
          return
        }

        if (!liff.isLoggedIn()) {
          setStatus('not-in-liff')
          return
        }

        const accessToken = liff.getAccessToken()
        if (!accessToken) {
          setStatus('not-in-liff')
          return
        }

        const res = await fetch('/api/auth/line-liff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        })

        if (cancelled) return

        if (!res.ok) {
          setErrorMsg('驗證失敗，請重試')
          setStatus('error')
          return
        }

        const data = (await res.json()) as {
          bound: boolean
          tokenHash?: string
          email?: string
          displayName?: string
          customerName?: string
          error?: string
        }

        if (!data.bound) {
          setDisplayName(data.displayName ?? '')
          setStatus('not-bound')
          return
        }

        // 用 magic link token 建立 Supabase session
        const { error: otpError } = await getSupabase().auth.verifyOtp({
          token_hash: data.tokenHash!,
          type: 'magiclink',
        })

        if (otpError) {
          console.error('[liff-login] verifyOtp error:', otpError)
          setErrorMsg('登入失敗，請重試')
          setStatus('error')
          return
        }

        // 讀取 liff.state 決定導向路徑
        const params = new URLSearchParams(window.location.search)
        const liffState = params.get('liff.state') ?? ''
        const redirect = liffState.startsWith('/') ? liffState : '/appointments'
        router.replace(redirect)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[liff-login] init error:', e)
        setStatus('not-in-liff')
      })

    return () => {
      cancelled = true
    }
  }, [liffId, router])

  // ── 初始化中 ────────────────────────────────────────────────────────────────
  if (status === 'detecting') {
    return (
      <main className="flex flex-col min-h-screen px-6 py-10">
        <div className="flex-1 flex flex-col justify-center items-center gap-4">
          <div className="text-5xl">🐾</div>
          <p className="text-sm text-gray-500">身分確認中…</p>
          <div className="w-6 h-6 border-2 border-[#78573A] border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  // ── LINE 帳號尚未綁定 ────────────────────────────────────────────────────────
  if (status === 'not-bound') {
    return (
      <main className="flex flex-col min-h-screen px-6 py-10">
        <div className="flex-1 flex flex-col justify-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-center space-y-2">
            <div className="text-5xl">🐾</div>
            <h1 className="text-2xl font-bold text-[#3B2F2A]">尚未綁定</h1>
            <p className="text-sm text-gray-500">
              {displayName ? `${displayName}，您好！` : ''}
              您的 LINE 帳號尚未與本店帳號連結。
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">如何綁定？</p>
            <ol className="space-y-1 list-decimal list-inside text-xs leading-relaxed">
              <li>到店完成第一次預約報到</li>
              <li>提供手機號碼給店家建立帳號</li>
              <li>在 LINE OA 輸入您的手機號碼完成綁定</li>
            </ol>
          </div>
          <a
            href="/"
            className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#78573A] text-white font-semibold text-base"
          >
            返回首頁
          </a>
        </div>
      </main>
    )
  }

  // ── 發生錯誤 ────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <main className="flex flex-col min-h-screen px-6 py-10">
        <div className="flex-1 flex flex-col justify-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-center space-y-2">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-[#3B2F2A]">
              {errorMsg || '登入發生錯誤'}
            </h1>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#78573A] text-white font-semibold"
          >
            重新嘗試
          </button>
        </div>
      </main>
    )
  }

  // ── 非 LINE 環境 — 顯示登入選項 ──────────────────────────────────────────────
  return (
    <main className="flex flex-col min-h-screen px-6 py-10">
      <div className="flex-1 flex flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <div className="text-center space-y-2">
          <div className="text-5xl">🐾</div>
          <h1 className="text-2xl font-bold text-[#3B2F2A]">寵物美容預約</h1>
          <p className="text-sm text-gray-500">登入以查看預約紀錄及會員資訊</p>
        </div>

        <div className="space-y-3">
          {liffId ? (
            <button
              type="button"
              onClick={() => {
                import('@line/liff').then(({ default: liff }) => {
                  liff.init({ liffId: liffId! }).then(() => {
                    if (!liff.isLoggedIn()) liff.login()
                  })
                })
              }}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#00B900] text-white font-semibold py-4 text-base active:opacity-80 transition-opacity"
            >
              <LineIcon />以 LINE 登入
            </button>
          ) : null}

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#78573A] text-[#78573A] font-semibold py-4 text-base active:bg-[#FAF7F2] transition-colors"
          >
            手機號碼驗證登入
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed">
          登入即表示您同意我們的服務條款與隱私政策
        </p>
      </div>
    </main>
  )
}

function LineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6 fill-current"
      aria-hidden="true"
    >
      <path d="M19.365 9.89c.365 0 .659.295.659.659s-.294.659-.659.659h-1.753v1.094h1.753c.365 0 .659.295.659.659s-.294.659-.659.659h-2.412a.659.659 0 0 1-.659-.659V9.89c0-.364.295-.659.659-.659zm-8.177 0c.364 0 .659.295.659.659v3.071a.659.659 0 1 1-1.318 0V9.89c0-.364.295-.659.659-.659zm-3.371 0c.364 0 .659.295.659.659v1.841l1.706-2.23a.66.66 0 0 1 1.165.389v3.071a.659.659 0 1 1-1.318 0v-1.841l-1.706 2.23a.659.659 0 0 1-1.165-.389V9.89c0-.364.295-.659.659-.659zm-3.988 0h2.412c.364 0 .659.295.659.659v3.071a.659.659 0 1 1-1.318 0v-2.412H3.829a.659.659 0 0 1 0-1.318zM12 2C6.477 2 2 6.12 2 11.199c0 4.533 3.293 8.326 7.747 9.055.301.065.712.2.816.458.094.235.062.602.03.84l-.131.782c-.04.235-.186.919.805.501.991-.418 5.348-3.149 7.294-5.39C19.632 15.586 22 13.543 22 11.2 22 6.12 17.523 2 12 2z" />
    </svg>
  )
}
