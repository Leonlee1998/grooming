import { redirect } from 'next/navigation'

// 根路由：尚未實作多店入口，暫時導向登入頁
export default function HomePage() {
  redirect('/login')
}
