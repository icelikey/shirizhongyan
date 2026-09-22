/**
 * 契约影从立绘主卡（agent.md §A1）。
 * 320×480 2:3 大卡 + 卡背两层错位（±4°）营造一叠卡牌感；入场三层洗开；
 * 悬停 3D 倾斜 + 立绘亮度提升 + 花色光晕；立绘每 12s 微侧目（translate/scale 2%）。
 * 底部信息带：赐名（铅笔内联改名 2-8 字，写回 store）+ 花色/生肖徽章 + 人设胶囊 + 契约日。
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { SUIT_META, getEcho } from '@/data/echoes'
import { ZODIAC } from '@/data/zodiac'
import MaskIcon from '@/components/MaskIcon'
import SuitIcon from '@/components/SuitIcon'
import TiltCard from '@/components/meta/TiltCard'
import { getStyle } from '@/components/meta/agent/styles'

export interface CompanionPortraitCardProps {
  /** 任一代打授权开启时显示「可代打」 */
  delegateOn: boolean
}

export default function CompanionPortraitCard({ delegateOn }: CompanionPortraitCardProps) {
  const companion = useProfile((s) => s.companion)
  const updateCompanion = useProfile((s) => s.updateCompanion)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!companion) return null
  const echo = getEcho(companion.echoId)
  if (!echo) return null
  const suit = SUIT_META[echo.suit]
  const zodiac = ZODIAC[echo.zodiacIndex]
  const style = getStyle(companion.style as string)

  const commit = () => {
    const name = draft.trim()
    if (name.length >= 2 && name.length <= 8 && name !== companion.customName) {
      updateCompanion({ customName: name })
      toast.success('影从记住了这个新名字', { description: `赐名「${name}」` })
    }
    setEditing(false)
  }

  return (
    <div className="relative mx-auto" style={{ width: 320, height: 480 }}>
      <style>{`@keyframes meta-portrait-idle { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(1.5%, -1%) scale(1.02); } }`}</style>

      {/* 卡背两层（一叠卡牌） */}
      {[-4, 4].map((deg, i) => (
        <motion.img
          key={deg}
          src="/card-back.png"
          alt=""
          aria-hidden
          initial={{ rotate: deg * 5, x: deg * 6, opacity: 0 }}
          animate={{ rotate: deg, x: deg * 1.5, opacity: 1 }}
          transition={{ delay: 0.12 * (i + 1), type: 'spring', stiffness: 120, damping: 14 }}
          draggable={false}
          className="card-frame absolute inset-0 h-full w-full rounded-[18px] object-cover"
        />
      ))}

      {/* 主卡 */}
      <motion.div
        initial={{ rotate: 0, y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 15 }}
        className="absolute inset-0"
      >
        <TiltCard max={8} glow={suit.glow} className="card-frame h-full w-full overflow-hidden rounded-[18px] bg-panel">
          <div className="group relative h-full w-full">
            <img
              src={echo.portrait}
              alt={echo.name}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-top transition-[filter] duration-300 group-hover:brightness-110"
              style={{ animation: 'meta-portrait-idle 12s ease-in-out infinite' }}
            />
            {/* 可代打徽章 */}
            {delegateOn && (
              <span className="absolute right-3 top-3 z-10 rounded-full border border-gold-300/60 bg-ink/85 px-2.5 py-1 text-[10px] tracking-[.2em] text-gold-300 shadow-gold-glow">
                可代打
              </span>
            )}
            {/* 底部信息带 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss via-abyss/85 to-transparent px-5 pb-5 pt-16">
              <div className="flex items-center gap-2">
                {editing ? (
                  <span className="flex items-center gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => e.key === 'Enter' && commit()}
                      maxLength={8}
                      autoFocus
                      className="w-36 border-b border-gold-300/60 bg-transparent font-serifsc text-[24px] font-black text-gold-100 outline-none"
                    />
                    <button type="button" onClick={commit} className="text-gold-300" aria-label="确认改名">
                      <Check size={16} />
                    </button>
                  </span>
                ) : (
                  <>
                    <h3 className="gold-text font-serifsc text-[26px] font-black tracking-[.06em]">{companion.customName}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(companion.customName)
                        setEditing(true)
                      }}
                      className="text-faint opacity-0 transition-opacity duration-200 hover:text-gold-300 group-hover:opacity-100"
                      aria-label="赐名"
                      title="赐名（2-8 字）"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] tracking-wider"
                  style={{ color: suit.color, background: `${suit.color}1A`, border: `1px solid ${suit.color}44` }}
                >
                  <SuitIcon suit={echo.suit} size={11} />
                  {suit.realm}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-[rgba(227,194,124,.3)] bg-gold-300/10 px-2 py-0.5 text-[10px] tracking-wider text-gold-300">
                  {zodiac && <MaskIcon src={zodiac.seal} size={11} color="#E3C27C" alt={zodiac.name} />}
                  {zodiac?.branch}
                  {zodiac?.name}
                </span>
                <span className="rounded-full border border-[rgba(227,194,124,.2)] px-2 py-0.5 text-[10px] tracking-wider text-dim">
                  {style.name}
                </span>
                <span className="ml-auto text-[10px] tracking-[.2em] text-faint">契于第 1 日</span>
              </div>
            </div>
          </div>
        </TiltCard>
      </motion.div>
    </div>
  )
}
