/**
 * <TopHUD> 顶栏（design.md §10.1）—— 登录后所有应用页使用（首页不用）。
 * 高 64px，fixed，z-50，背景 rgba(12,10,19,.72) + backdrop-blur(16px)，底边 1px --line-subtle。
 * 左：logo + 终焉；中：导航（大厅/世界/影从/残章/天梯/图鉴）；
 * 右：CountdownRing mini + 四花色碎片计数（>2 折叠悬浮展开）+ 玩家芯片（点击弹用户抽屉）。
 */
import { useEffect, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogOut, BookOpen, Dices, Cloud, CloudUpload } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { useAuth } from '@/hooks/useAuth'
import { useCloudSync } from '@/hooks/useCloudProfile'
import { LOGIN_PATH } from '@/const'
import { SUITS, getEcho } from '@/data/echoes'
import CountdownRing from '@/components/CountdownRing'
import FragmentChip from '@/components/FragmentChip'
import TierSeal from '@/components/TierSeal'
import MaskIcon from '@/components/MaskIcon'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/lobby', label: '大厅' },
  { to: '/world', label: '世界' },
  { to: '/agent', label: '影从' },
  { to: '/lore', label: '残章' },
  { to: '/leaderboard', label: '天梯' },
  { to: '/codex', label: '图鉴' },
]

export default function TopHUD() {
  const navigate = useNavigate()
  const session = useProfile((s) => s.session)
  const fragments = useProfile((s) => s.fragments)
  const tier = useProfile((s) => s.tier)
  const companion = useProfile((s) => s.companion)
  const logout = useProfile((s) => s.logout)
  const rename = useProfile((s) => s.rename)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [scrolled, setScrolled] = useState(false)

  /* 云同步区（Kimi 登录态 + 档案同步状态） */
  const { user: cloudUser, isAuthenticated: cloudAuthed, isLoading: cloudAuthLoading, logout: cloudLogout } = useAuth()
  const syncStatus = useCloudSync((s) => s.status)
  const lastSyncedAt = useCloudSync((s) => s.lastSyncedAt)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!session) return null
  const companionEcho = companion ? getEcho(companion.echoId) : undefined

  const startRename = () => {
    setNameDraft(session.nickname)
    setEditing(true)
  }
  const commitRename = () => {
    const n = nameDraft.trim()
    if (n.length >= 2 && n.length <= 12) rename(n)
    setEditing(false)
  }

  return (
    <>
      <motion.header
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[rgba(227,194,124,.10)] backdrop-blur-[16px] transition-colors duration-300"
        style={{ backgroundColor: scrolled ? 'rgba(12,10,19,.92)' : 'rgba(12,10,19,.72)' }}
      >
        <div className="mx-auto max-w-[1440px] h-full px-6 flex items-center gap-6">
          {/* 左：logo */}
          <Link to="/lobby" className="flex items-center gap-2.5 shrink-0 group">
            <MaskIcon src="/logo-mark.svg" size={36} color="#E3C27C" className="transition-transform duration-500 group-hover:rotate-[36deg]" />
            <span className="flex flex-col leading-none">
              <span className="gold-text font-serifsc font-black text-[18px] tracking-wider">终焉</span>
              <span className="text-faint text-[9px] tracking-[.3em] font-cinzel mt-0.5">THE ENDGAME WORLD</span>
            </span>
          </Link>

          {/* 中：导航 */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative px-4 py-2 text-[14px] font-sanssc tracking-[.15em] transition-colors duration-200',
                    isActive ? 'text-gold-300' : 'text-dim hover:text-gold-100',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      className={cn(
                        'absolute left-4 right-4 -bottom-0.5 h-[2px] bg-gold-300 origin-left transition-transform duration-300 ease-ink',
                        isActive ? 'scale-x-100' : 'scale-x-0',
                      )}
                      style={{ boxShadow: '0 0 8px rgba(227,194,124,.6)' }}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* 右：倒计时 + 碎片 + 玩家 */}
          <div className="flex items-center gap-4 shrink-0 ml-auto md:ml-0">
            <CountdownRing variant="mini" size={30} />
            {/* 碎片：桌面全显，窄屏 2 枚 + 悬浮展开 */}
            <div className="relative group">
              <div className="hidden lg:flex items-center gap-2">
                {SUITS.map((s) => (
                  <FragmentChip key={s} suit={s} count={fragments[s]} size="sm" />
                ))}
              </div>
              <div className="flex lg:hidden items-center gap-2">
                <FragmentChip suit="spade" count={fragments.spade} size="sm" />
                <FragmentChip suit="club" count={fragments.club} size="sm" />
                <span className="text-faint text-[11px] font-mono">+2</span>
              </div>
              <div className="lg:hidden absolute right-0 top-full pt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-50">
                <div className="panel-bg rounded-xl p-3 flex flex-col gap-2">
                  <FragmentChip suit="heart" count={fragments.heart} size="sm" />
                  <FragmentChip suit="diamond" count={fragments.diamond} size="sm" />
                </div>
              </div>
            </div>

            {/* 玩家芯片 */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2.5 rounded-full border border-[rgba(227,194,124,.2)] bg-ink/70 pl-1 pr-3 py-1 hover:border-[rgba(246,227,180,.55)] transition-colors"
            >
              <img src="/avatar-traveler.png" alt={session.nickname} width={32} height={32} className="rounded-full object-cover border border-gold-300/40" />
              <span className="text-[13px] text-bone font-medium max-w-[96px] truncate">{session.nickname}</span>
              <TierSeal tier={tier} size={24} glow />
            </button>
          </div>
        </div>
      </motion.header>

      {/* 用户抽屉（§10.14 Drawer：右滑入 380px） */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-0 z-[70] bg-abyss/70 backdrop-blur-[8px]"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 z-[71] w-[380px] max-w-[90vw] bg-panel border-l border-[rgba(227,194,124,.15)] p-6 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serifsc text-lg text-gold-300 tracking-widest">旅人档案</h3>
                <button type="button" onClick={() => setDrawerOpen(false)} className="text-faint hover:text-gold-300 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <img src="/avatar-traveler.png" alt="旅人" width={64} height={64} className="rounded-full object-cover border border-gold-300/40" />
                <div className="flex flex-col gap-1">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        maxLength={12}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                        className="bg-ink border-b border-gold-300/60 outline-none text-bone text-sm px-1 py-0.5 w-32"
                      />
                      <GoldButton size="sm" variant="ghost" onClick={commitRename}>确定</GoldButton>
                    </div>
                  ) : (
                    <button type="button" onClick={startRename} className="text-bone text-lg font-serifsc hover:text-gold-300 transition-colors text-left" title="点击改名">
                      {session.nickname}
                    </button>
                  )}
                  <span className="flex items-center gap-2 text-faint text-xs">
                    <TierSeal tier={tier} size={20} />
                    位阶 · {tier === 'huang' ? '黄阶' : tier === 'xuan' ? '玄阶' : tier === 'di' ? '地阶' : '天阶'}
                  </span>
                </div>
              </div>

              {companionEcho && (
                <div className="panel-bg rounded-xl p-4 flex items-center gap-4">
                  <img src={companionEcho.portrait} alt={companionEcho.name} width={48} height={48} className="rounded-full object-cover object-top border border-gold-300/40" />
                  <div className="text-sm">
                    <div className="text-gold-300 font-serifsc">{companion?.customName} <span className="text-faint text-xs">（{companionEcho.name}）</span></div>
                    <div className="text-dim text-xs mt-1">契约影从 · 羁绊 Lv.{companion?.bond ?? 1}</div>
                  </div>
                </div>
              )}

              {/* 云端档案 · Kimi 登录态 */}
              <div className="panel-bg rounded-xl p-4 flex flex-col gap-2.5">
                <span className="text-[11px] tracking-[.25em] text-faint">云端档案</span>
                {cloudAuthed ? (
                  <>
                    <div className="flex items-center gap-2 text-[13px] text-bone">
                      <CloudUpload size={15} className="text-suit-club shrink-0" />
                      <span className="truncate">{cloudUser?.name ?? 'Kimi 旅人'}</span>
                    </div>
                    <span className="text-[11px] text-dim">
                      {syncStatus === 'syncing' && '同步中…'}
                      {syncStatus === 'synced' &&
                        `已同步${lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : ''}`}
                      {syncStatus === 'error' && <span className="text-cinnabar-hi">同步失败 · 待下次变更重试</span>}
                      {syncStatus === 'logged-out' && '读取云端档案中…'}
                    </span>
                    <GoldButton
                      variant="ghost"
                      size="sm"
                      disabled={cloudAuthLoading}
                      onClick={() => {
                        setDrawerOpen(false)
                        cloudLogout()
                      }}
                    >
                      退出云登录
                    </GoldButton>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] text-dim leading-relaxed">未登录 · 存档仅留存于此间灯火（本地）</p>
                    <GoldButton
                      size="sm"
                      disabled={cloudAuthLoading}
                      onClick={() => {
                        setDrawerOpen(false)
                        navigate(LOGIN_PATH)
                      }}
                    >
                      <Cloud size={14} /> 云登录 · 同步存档
                    </GoldButton>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-auto">
                <GoldButton variant="ghost" onClick={() => { setDrawerOpen(false); navigate('/codex') }}>
                  <BookOpen size={16} /> 规则图鉴
                </GoldButton>
                <GoldButton
                  variant="danger"
                  onClick={() => {
                    logout()
                    setDrawerOpen(false)
                    navigate('/')
                  }}
                >
                  <LogOut size={16} /> 退出登录
                </GoldButton>
              </div>

              <div className="flex items-center gap-2 text-faint text-[11px] tracking-wider">
                <Dices size={12} />
                世界每十日终结一次，胜者携带记忆前行
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
