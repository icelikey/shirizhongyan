/**
 * <LoginGuard> 路由守卫（design.md §10.14 / §11）。
 * 无 localStorage 会话时重定向 `/`；登录后默认落 `/lobby`。
 * 用法：<Route element={<LoginGuard><AppShell /></LoginGuard>}> … </Route>
 */
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '@/store/profile'

export default function LoginGuard({ children }: { children: ReactNode }) {
  const session = useProfile((s) => s.session)
  if (!session) return <Navigate to="/" replace />
  return <>{children}</>
}
