import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 建立 server-side supabase client（透過 cookie 取得 session）
async function getSession() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  })
  const { data } = await client.auth.getSession()
  return data.session
}

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-20">{children}</main>

      {/* 底部導覽列 */}
      <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-mobile bg-white border-t border-gray-100 flex">
        <NavLink href="/appointments" icon="📅" label="我的預約" />
        <NavLink href="/pets" icon="🐶" label="我的寵物" />
        <NavLink href="/member" icon="👤" label="會員" />
      </nav>
    </div>
  )
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-gray-500 hover:text-brand-700 transition-colors"
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[11px]">{label}</span>
    </Link>
  )
}
