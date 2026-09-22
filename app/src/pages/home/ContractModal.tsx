/**
 * §L · 登录仪式浮层「契约仪式」（home.md §L）
 * 三步仪式：① 报上名来（昵称 2-12 字 + 骰子随机）→ ② 选择影从（新手三选一 / 纵观八位）
 * → ③ 契成（契约阵展开 + 朱砂印章落定 + 影从命名 2-8 字）。
 * 完成回调 onComplete(nickname, echoId, customName) —— 由 Home 写入 store 并跳转 /lobby。
 *
 * 动效隔离：本组件仅使用 framer-motion（UI 交互），不与 GSAP 混用。
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dices, X, ChevronRight } from 'lucide-react'
import type { Echo } from '@/data/echoes'
import { ECHOES, BEGINNER_ECHOES, SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'

/** 旅人词库 */
const TRAVELER_NAMES = ['夜航星', '借火人', '拾忆人', '听潮客', '无名氏', '渡鸦', '走马灯', '拾荒者', '执灯人', '迟归人']

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** 契约阵 SVG：双环 + 天干地支字符沿圆周排布（外环 8s，内环反向 5s） */
function ContractCircle() {
  return (
    <div className="relative w-[240px] h-[240px]">
      <motion.svg viewBox="0 0 240 240" className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 8, ease: 'linear', repeat: Infinity }}>
        <circle cx="120" cy="120" r="110" fill="none" stroke="rgba(227,194,124,.5)" strokeWidth="1" strokeDasharray="6 8" />
        {HEAVENLY_STEMS.map((ch, i) => {
          const a = (i * 2 * Math.PI) / 10 - Math.PI / 2
          return (
            <text
              key={ch}
              x={120 + 96 * Math.cos(a)}
              y={120 + 96 * Math.sin(a)}
              fill="#E3C27C"
              fontSize="13"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: '"Ma Shan Zheng", cursive' }}
            >
              {ch}
            </text>
          )
        })}
      </motion.svg>
      <motion.svg viewBox="0 0 240 240" className="absolute inset-0" animate={{ rotate: -360 }} transition={{ duration: 5, ease: 'linear', repeat: Infinity }}>
        <circle cx="120" cy="120" r="72" fill="none" stroke="rgba(216,68,60,.55)" strokeWidth="1" strokeDasharray="3 6" />
        {EARTHLY_BRANCHES.map((ch, i) => {
          const a = (i * 2 * Math.PI) / 12 - Math.PI / 2
          return (
            <text
              key={ch}
              x={120 + 60 * Math.cos(a)}
              y={120 + 60 * Math.sin(a)}
              fill="rgba(240,101,90,.85)"
              fontSize="11"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: '"Ma Shan Zheng", cursive' }}
            >
              {ch}
            </text>
          )
        })}
      </motion.svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[88px] h-[88px] rounded-full border border-gold-300/40 bg-abyss/60" />
      </div>
    </div>
  )
}

/** 金色粒子飞散（≤12） */
function GoldParticles({ burstKey }: { burstKey: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        angle: (i / 12) * 2 * Math.PI + Math.random() * 0.4,
        dist: 60 + Math.random() * 50,
        size: 3 + Math.random() * 3,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey],
  )
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {parts.map((p, i) => (
        <motion.span
          key={`${burstKey}-${i}`}
          className="absolute rounded-full bg-gold-300"
          style={{ width: p.size, height: p.size, boxShadow: '0 0 6px rgba(227,194,124,.9)' }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        />
      ))}
    </div>
  )
}

export interface ContractModalProps {
  open: boolean
  onClose: () => void
  onComplete: (nickname: string, echoId: string, customName: string) => void
}

export default function ContractModal({ open, onClose, onComplete }: ContractModalProps) {
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [nameError, setNameError] = useState('')
  const [echoId, setEchoId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [customName, setCustomName] = useState('')
  const [sealStamped, setSealStamped] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const selectedEcho: Echo | undefined = ECHOES.find((e) => e.id === echoId)

  /* 重置（关闭/完成时调用；open 由父级控制） */
  const reset = () => {
    setStep(1)
    setNickname('')
    setNameError('')
    setEchoId(null)
    setShowAll(false)
    setCustomName('')
    setSealStamped(false)
  }
  const handleClose = () => {
    reset()
    onClose()
  }

  /* Step3：契约阵展开 → 1100ms 后印章落定（+微震） */
  useEffect(() => {
    if (step !== 3 || !selectedEcho) return
    const t = setTimeout(() => {
      setSealStamped(true)
      setShakeKey((k) => k + 1)
    }, 1100)
    return () => clearTimeout(t)
  }, [step, selectedEcho])

  const validateName = (v: string) => {
    const n = v.trim()
    if (n.length < 2) return '名号不可为空（至少 2 字）'
    if (n.length > 12) return '名号至多 12 字'
    return ''
  }

  const nextFromStep1 = () => {
    const err = validateName(nickname)
    setNameError(err)
    if (err) return
    setStep(2)
  }

  const finish = () => {
    if (!selectedEcho) return
    const cn = customName.trim()
    const finalName = cn.length >= 2 && cn.length <= 8 ? cn : selectedEcho.name
    reset()
    onComplete(nickname.trim(), selectedEcho.id, finalName)
  }

  const echoList = showAll ? ECHOES : BEGINNER_ECHOES

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="contract-veil"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute inset-0 bg-abyss/85 backdrop-blur-[12px]" onClick={handleClose} />

          {/* 仪式卡（印章微震作用于整卡） */}
          <motion.div
            key={shakeKey}
            className="relative w-[560px] max-w-full max-h-[92dvh] overflow-y-auto rounded-[18px] bg-panel border border-[rgba(227,194,124,.35)] shadow-card"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={shakeKey > 0 ? { scale: 1, opacity: 1, y: [0, 2, 0] } : { scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={shakeKey > 0 ? { duration: 0.12 } : { duration: 0.24 }}
          >
            {/* 顶部竖排「契约之间」+ 进度日轮 */}
            <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur px-8 pt-6 pb-4 border-b border-[rgba(227,194,124,.10)] flex items-center justify-between">
              <span className="vertical-rl font-mashan text-gold-300 text-[18px] h-[88px]">契约之间</span>
              <div className="flex items-center gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-3">
                    <motion.span
                      className={cn('w-3.5 h-3.5 rounded-full border', step >= n ? 'bg-gold-300 border-gold-300' : 'border-gold-300/30')}
                      animate={step >= n ? { boxShadow: '0 0 10px rgba(227,194,124,.8)' } : { boxShadow: 'none' }}
                    />
                    {n < 3 && <span className="w-6 h-px bg-gold-300/25" />}
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleClose} className="text-faint hover:text-gold-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-8 py-8">
              <AnimatePresence mode="wait">
                {/* ============ Step 1 · 报上名来 ============ */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: 60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -60, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col gap-8"
                  >
                    <h2 className="font-mashan text-[34px] gold-text">旅人，报上名来。</h2>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          value={nickname}
                          onChange={(e) => { setNickname(e.target.value); setNameError('') }}
                          onKeyDown={(e) => e.key === 'Enter' && nextFromStep1()}
                          maxLength={12}
                          autoFocus
                          placeholder="你的名号（2-12 字）"
                          className={cn(
                            'flex-1 bg-transparent outline-none text-[22px] font-serifsc text-bone placeholder:text-faint px-1 py-2 border-b-2 transition-colors',
                            nameError ? 'border-cinnabar-hi' : 'border-gold-300/40 focus:border-gold-300',
                          )}
                        />
                        <button
                          type="button"
                          title="随机名号"
                          onClick={() => {
                            setNickname(TRAVELER_NAMES[Math.floor(Math.random() * TRAVELER_NAMES.length)])
                            setNameError('')
                          }}
                          className="text-gold-500 hover:text-gold-300 hover:rotate-6 transition-all"
                        >
                          <Dices size={22} />
                        </button>
                      </div>
                      <AnimatePresence>
                        {nameError && (
                          <motion.p
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-cinnabar-hi text-[13px]"
                          >
                            {nameError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex justify-end">
                      <GoldButton variant="gold" size="lg" disabled={nickname.trim().length < 2} onClick={nextFromStep1}>
                        下一步 <ChevronRight size={16} />
                      </GoldButton>
                    </div>
                  </motion.div>
                )}

                {/* ============ Step 2 · 选择你的影从 ============ */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ x: 60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -60, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex items-end justify-between">
                      <h2 className="font-mashan text-[30px] gold-text">选择你的影从。</h2>
                      <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] text-dim hover:text-gold-300 tracking-wider transition-colors">
                        {showAll ? '只看新手推荐' : '不甘于此？纵观八位 →'}
                      </button>
                    </div>

                    <div className={cn('gap-4', showAll ? 'flex overflow-x-auto pb-2' : 'grid grid-cols-3')}>
                      {echoList.map((e) => {
                        const meta = SUIT_META[e.suit]
                        const active = echoId === e.id
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setEchoId(e.id)}
                            className={cn(
                              'group relative rounded-[14px] overflow-hidden border transition-all duration-300 ease-ink shrink-0',
                              showAll ? 'w-[140px] h-[210px]' : 'w-full aspect-[2/3]',
                              active ? '-translate-y-2' : 'hover:-translate-y-1',
                            )}
                            style={{
                              borderColor: active ? '#F6E3B4' : 'rgba(227,194,124,.2)',
                              boxShadow: active ? `0 16px 40px rgba(0,0,0,.6), 0 0 28px ${meta.glow}` : undefined,
                            }}
                          >
                            <img src={e.portrait} alt={e.name} draggable={false} className="absolute inset-0 w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/20 to-transparent" />
                            <div className="absolute bottom-0 inset-x-0 p-2.5 text-left">
                              <div className="flex items-center justify-between">
                                <span className="font-serifsc font-semibold text-[16px] text-bone">{e.name}</span>
                                <span style={{ color: meta.color }}>
                                  <SuitIcon suit={e.suit} size={14} />
                                </span>
                              </div>
                              <span className="text-[10px] tracking-[.2em]" style={{ color: meta.color }}>
                                {e.persona}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="min-h-[40px] text-center">
                      {selectedEcho && (
                        <p className="text-gold-300 font-serifsc text-[15px]">「{selectedEcho.quote}」</p>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <GoldButton variant="ghost" size="md" onClick={() => setStep(1)}>上一步</GoldButton>
                      <GoldButton
                        variant="gold"
                        size="lg"
                        disabled={!echoId}
                        onClick={() => {
                          if (selectedEcho) setCustomName(selectedEcho.name)
                          setStep(3)
                        }}
                      >
                        缔结契约 <ChevronRight size={16} />
                      </GoldButton>
                    </div>
                  </motion.div>
                )}

                {/* ============ Step 3 · 契成 ============ */}
                {step === 3 && selectedEcho && (
                  <motion.div
                    key="step3"
                    initial={{ x: 60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -60, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center gap-6"
                  >
                    <h2 className="font-mashan text-[30px] gold-text">契 成</h2>

                    {/* 契约阵 + 飞入双卡 + 印章 */}
                    <div className="relative flex items-center justify-center py-2">
                      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                        <ContractCircle />
                      </motion.div>

                      {/* 影从卡（右飞入） */}
                      <motion.img
                        src={selectedEcho.portrait}
                        alt={selectedEcho.name}
                        draggable={false}
                        className="absolute w-[84px] h-[126px] object-cover object-top rounded-lg border border-gold-300/60"
                        initial={{ x: 200, y: -30, opacity: 0, rotate: 12 }}
                        animate={{ x: 52, y: 0, opacity: 1, rotate: 6 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                      {/* 旅人剪影卡（左飞入） */}
                      <motion.img
                        src="/avatar-traveler.png"
                        alt="旅人"
                        draggable={false}
                        className="absolute w-[84px] h-[126px] object-cover rounded-lg border border-gold-300/60"
                        initial={{ x: -200, y: 30, opacity: 0, rotate: -12 }}
                        animate={{ x: -52, y: 0, opacity: 1, rotate: -6 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      />

                      {/* 朱砂印章「契」砸落 */}
                      <AnimatePresence>
                        {sealStamped && (
                          <motion.div
                            className="absolute z-10 seal-stamp w-[72px] h-[72px] flex items-center justify-center text-[42px]"
                            initial={{ scale: 1.4, rotate: 14, opacity: 0 }}
                            animate={{ scale: 1, rotate: -3, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                          >
                            契
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {sealStamped && <GoldParticles burstKey={shakeKey} />}
                    </div>

                    {/* 影从命名 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      className="w-full flex flex-col gap-2"
                    >
                      <label className="text-[13px] text-dim tracking-[.2em]">为影从赐名（2-8 字，可沿用原名）</label>
                      <input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        maxLength={8}
                        className="bg-transparent outline-none text-[18px] font-serifsc text-bone px-1 py-2 border-b-2 border-gold-300/40 focus:border-gold-300 transition-colors"
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 }}
                      className="w-full flex justify-end"
                    >
                      <GoldButton variant="gold" size="xl" className="gold-sweep tracking-[.3em]" onClick={finish}>
                        踏入牌局之间
                      </GoldButton>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
