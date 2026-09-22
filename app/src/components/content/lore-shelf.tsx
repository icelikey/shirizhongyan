/**
 * 十日残章 · 书架视图组件（lore.md §视图一）。
 * - VolumeCard  180×300 卷轴/牌脊：未解锁=朱砂绳捆扎+锁印+条件胶囊；已解锁=插画+金线竖排题签
 * - UnlockModal 解锁确认弹层：条件与余额、印章落定启封演出
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { LoreVolume } from '@/data/lore'
import { lockLabel } from '@/data/lore'
import type { Suit } from '@/data/echoes'
import { SUIT_META, SUITS } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import FragmentChip from '@/components/FragmentChip'
import GoldButton from '@/components/GoldButton'
import { TiltCard, SealStamp } from '@/components/content/shared'
import { cn } from '@/lib/utils'

/* ============================== VolumeCard ============================== */

export interface VolumeCardProps {
  volume: LoreVolume
  unlocked: boolean
  read: boolean
  index: number
  onClick: (v: LoreVolume) => void
}

export function VolumeCard({ volume, unlocked, read, index, onClick }: VolumeCardProps) {
  const lock = volume.lock
  const mist = lock.kind === 'mist'
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, rotate: 2 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20, delay: index * 0.06 }}
    >
      <TiltCard
        max={6}
        onClick={() => onClick(volume)}
        className={cn(
          'card-frame relative w-[168px] h-[280px] sm:w-[180px] sm:h-[300px] rounded-[14px] overflow-hidden bg-panel group',
          unlocked && 'hover:shadow-gold-glow',
        )}
      >
        {/* 卷面插画 / 素卷底 */}
        {volume.banner ? (
          <img
            src={volume.banner}
            alt={volume.title}
            draggable={false}
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-all duration-500',
              unlocked ? 'brightness-[.72] group-hover:brightness-95' : 'blur-[3px] brightness-[.38]',
            )}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(80% 60% at 50% 20%, rgba(227,194,124,.10), transparent 70%), linear-gradient(180deg, #1D1626 0%, #14101C 60%, #0C0A13 100%)',
            }}
          />
        )}
        {/* 巨型卷序水印 */}
        <span
          className={cn(
            'absolute right-2 top-1 font-mashan leading-none select-none',
            unlocked ? 'text-gold-300/25 text-[92px]' : 'text-bone/10 text-[92px]',
          )}
        >
          {volume.numeral}
        </span>
        {/* 上下压暗 */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-abyss/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-abyss/90 to-transparent" />

        {/* 金线题签（竖排卷名） */}
        <div className="absolute left-3 top-3 bottom-14 flex flex-col items-center gap-2">
          <span className={cn('w-px flex-none h-6', unlocked ? 'bg-gold-300/80' : 'bg-bone/20')} />
          <span
            className={cn(
              'vertical-rl font-serifsc font-semibold text-[17px] tracking-[.28em]',
              unlocked ? 'text-gold-100 drop-shadow-[0_0_8px_rgba(227,194,124,.45)]' : 'text-dim',
            )}
          >
            {volume.title}
          </span>
          <span className={cn('text-[10px] tracking-[.2em] font-cinzel', unlocked ? 'text-gold-300/70' : 'text-faint')}>
            VOL.{volume.id}
          </span>
        </div>

        {/* 已录小印 / 新解锁金点 */}
        {unlocked && read && (
          <span className="absolute right-2.5 bottom-14">
            <SealStamp text="已录" size={30} />
          </span>
        )}
        {unlocked && !read && (
          <>
            <span className="absolute right-3 top-3 w-2 h-2 rounded-full bg-gold-300 animate-pulse-dot shadow-gold-glow" />
            <span className="absolute right-2 bottom-14">
              <SealStamp text="新" size={28} />
            </span>
          </>
        )}

        {/* 未解锁：朱砂绳 + 锁印 */}
        {!unlocked && (
          <>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col gap-10 pointer-events-none">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="block h-[7px] w-full transition-transform duration-300 group-hover:translate-x-[2px]"
                  style={{
                    background: 'linear-gradient(90deg, rgba(176,53,46,.25), #B0352E 30%, #D8443C 50%, #B0352E 70%, rgba(176,53,46,.25))',
                    boxShadow: '0 1px 6px rgba(0,0,0,.6), inset 0 1px 0 rgba(248,233,192,.2)',
                  }}
                />
              ))}
            </div>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-ink/90 border border-cinnabar/60 flex items-center justify-center shadow-[0_0_20px_rgba(216,68,60,.3)]">
              {mist ? (
                <span className="font-mashan text-cinnabar-hi/80 text-[22px] leading-none">雾</span>
              ) : (
                <Lock size={22} className="text-cinnabar-hi/85" />
              )}
            </span>
          </>
        )}

        {/* 底部：状态胶囊 */}
        <div className="absolute inset-x-2.5 bottom-2.5 flex justify-center">
          {unlocked ? (
            <span className="text-[10px] tracking-[.3em] text-gold-300/80 font-sanssc">点击展卷</span>
          ) : lock.kind === 'fragments' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-abyss/85 border border-gold-300/25 px-2.5 h-7 group-hover:animate-pulse">
              {SUITS.filter((s) => lock.kind === 'fragments' && lock.cost[s]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 font-mono text-[11px]" style={{ color: SUIT_META[s].color }}>
                  <SuitIcon suit={s} size={12} />
                  ×{lock.kind === 'fragments' ? lock.cost[s] : 0}
                </span>
              ))}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 h-7 text-[11px] tracking-[.15em] border',
                mist ? 'text-faint border-bone/10 bg-abyss/70' : 'text-tier-xuan border-tier-xuan/40 bg-abyss/85',
              )}
            >
              {lockLabel(volume)}
            </span>
          )}
        </div>
      </TiltCard>
    </motion.div>
  )
}

/* ============================== UnlockModal ============================== */

export interface UnlockModalProps {
  volume: LoreVolume | null
  fragments: Record<Suit, number>
  tierMet: boolean
  onClose: () => void
  /** 启封演出结束、实际扣款解锁完成后回调（进入阅读） */
  onSealed: (v: LoreVolume) => void
  /** 实际执行扣款 + 解锁（由页面持有 store 操作） */
  onConfirm: (v: LoreVolume) => void
}

export function UnlockModal({ volume, fragments, tierMet, onClose, onSealed, onConfirm }: UnlockModalProps) {
  const [sealing, setSealing] = useState(false)
  const [broken, setBroken] = useState(false)
  if (!volume) return null
  const lock = volume.lock

  const costs: { suit: Suit; n: number }[] =
    lock.kind === 'fragments'
      ? SUITS.filter((s) => lock.cost[s]).map((s) => ({ suit: s, n: lock.cost[s]! }))
      : []
  const affordable = costs.every((c) => fragments[c.suit] >= c.n)
  const canSeal = lock.kind === 'fragments' ? affordable : tierMet

  const startSeal = () => {
    if (!canSeal || sealing) return
    setSealing(true)
    // 绳断 → 印落 → 落定后实际解锁
    window.setTimeout(() => setBroken(true), 450)
    window.setTimeout(() => {
      onConfirm(volume)
    }, 950)
    window.setTimeout(() => onSealed(volume), 1400)
  }

  return (
    <AnimatePresence>
      <motion.div
        key="unlock-mask"
        className="fixed inset-0 z-[70] flex items-center justify-center p-6"
        style={{ background: 'rgba(7,6,11,.72)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !sealing && onClose()}
      >
        <motion.div
          className="card-frame relative w-full max-w-[440px] rounded-[18px] bg-panel p-7 overflow-visible"
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={sealing ? { scale: 1, opacity: 1, y: [0, 2, 0] } : { scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 卷首 */}
          <div className="flex items-start gap-4">
            <div className="relative w-[64px] h-[96px] rounded-lg overflow-hidden border border-gold-300/30 shrink-0">
              {volume.banner ? (
                <img src={volume.banner} alt="" className="w-full h-full object-cover brightness-75" draggable={false} />
              ) : (
                <div className="w-full h-full bg-elevated flex items-center justify-center">
                  <span className="font-mashan text-gold-300/60 text-3xl">{volume.numeral}</span>
                </div>
              )}
              {/* 朱砂绳（演出时断裂飘落） */}
              <AnimatePresence>
                {!broken && (
                  <motion.span
                    className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2"
                    style={{ background: 'linear-gradient(90deg,#8E2A25,#D8443C,#8E2A25)' }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>
              {broken && (
                <>
                  <motion.span
                    className="absolute left-0 top-1/2 h-[6px] w-1/2"
                    style={{ background: 'linear-gradient(90deg,#8E2A25,#D8443C)' }}
                    initial={{ x: 0, y: '-50%', rotate: 0, opacity: 1 }}
                    animate={{ x: -36, y: 30, rotate: -38, opacity: 0 }}
                    transition={{ duration: 0.7, ease: 'easeIn' }}
                  />
                  <motion.span
                    className="absolute right-0 top-1/2 h-[6px] w-1/2"
                    style={{ background: 'linear-gradient(90deg,#D8443C,#8E2A25)' }}
                    initial={{ x: 0, y: '-50%', rotate: 0, opacity: 1 }}
                    animate={{ x: 36, y: 34, rotate: 34, opacity: 0 }}
                    transition={{ duration: 0.7, ease: 'easeIn' }}
                  />
                </>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] tracking-[.3em] text-faint font-cinzel">SCROLL {volume.id} / 卷{volume.numeral}</p>
              <h3 className="gold-text font-serifsc font-black text-[24px] tracking-[.1em] mt-1">{volume.title}</h3>
              <p className="text-dim text-[12px] tracking-[.1em] mt-1.5">{volume.quote}</p>
            </div>
          </div>

          {/* 条件与余额 */}
          <div className="mt-6 rounded-xl border border-[rgba(227,194,124,.14)] bg-ink/70 p-4">
            <p className="text-[11px] tracking-[.25em] text-faint mb-3">启封条件</p>
            {lock.kind === 'fragments' ? (
              <div className="flex flex-col gap-2.5">
                {costs.map((c) => {
                  const enough = fragments[c.suit] >= c.n
                  return (
                    <div key={c.suit} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: SUIT_META[c.suit].color }}>
                        <SuitIcon suit={c.suit} size={16} />
                        {SUIT_META[c.suit].realm}碎片 ×{c.n}
                      </span>
                      <span className="flex items-center gap-2">
                        <FragmentChip suit={c.suit} count={fragments[c.suit]} size="sm" />
                        <span className={cn('text-[11px] font-mono', enough ? 'text-ok' : 'text-cinnabar-hi')}>
                          {enough ? '足够' : `尚缺 ${c.n - fragments[c.suit]}`}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[13px] text-dim leading-relaxed">
                {lock.kind === 'tier'
                  ? `位阶达${lock.tier === 'xuan' ? '玄阶' : '天阶'}方可启封。${tierMet ? '玉玺已验，可启。' : '位阶未至，玺门不开。'}`
                  : '迷雾未散，暂不可启。'}
              </p>
            )}
          </div>

          {/* 操作 */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <GoldButton variant="ghost" size="sm" onClick={onClose} disabled={sealing}>
              暂且搁卷
            </GoldButton>
            <div className="flex flex-col items-end gap-1.5">
              <GoldButton variant="gold" size="md" onClick={startSeal} disabled={!canSeal || sealing}>
                {sealing ? '启封中…' : lock.kind === 'tier' ? '以玺启封' : '以碎片启封'}
              </GoldButton>
              {!canSeal && !sealing && (
                <span className="text-[11px] text-cinnabar-hi tracking-wider">
                  {lock.kind === 'tier' ? '位阶未至' : '碎片不足'}
                </span>
              )}
            </div>
          </div>

          {/* 印章落定演出 */}
          <AnimatePresence>
            {sealing && (
              <motion.div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-abyss/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="seal-stamp flex items-center justify-center w-[104px] h-[104px] text-[44px] font-mashan"
                  initial={{ scale: 1.5, rotate: -18, opacity: 0 }}
                  animate={{ scale: 1, rotate: -4, opacity: 1 }}
                  transition={{ delay: 0.55, type: 'spring', stiffness: 300, damping: 14 }}
                >
                  启封
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
