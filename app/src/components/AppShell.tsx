/**
 * <AppShell> 应用页布局壳 —— 含 TopHUD，内容区 pt-16。
 * 使用 <Outlet/> 嵌套路由模式（App.tsx 中作为 layout route）。
 * 页面代理：不要在页面内再加顶栏高度的 padding/margin。
 */
import { Outlet } from 'react-router-dom'
import TopHUD from '@/components/TopHUD'
import { useCloudProfile } from '@/hooks/useCloudProfile'

export default function AppShell() {
  /* 档案云同步：Kimi 登录后云端 ⇄ 本地 useProfile 双向桥（hook 内部自判定） */
  useCloudProfile()
  return (
    <div className="min-h-[100dvh]">
      <TopHUD />
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  )
}
