/**
 * 碎境爬塔 · 卡牌战斗页（spire-combat.md §2）
 * - 100dvh 战斗壳（覆盖 TopHUD）：背景按层切换 + 顶部细栏 + 敌方区 + 玩家区 + 手牌扇形区。
 * - 战斗状态为页面局部 state（引擎纯 TS 驱动），结束回写 useSpire / useProfile。
 * - 胜利 → 奖励屏（金币/♦碎片/三选一卡牌/遗物）；失败 → 终焉结算屏。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Flag, Layers } from 'lucide-react'
import { getEcho } from '@/data/echoes'
import type { NodeType } from '@/data/spire/types'
import { getPotion, potionNeedsTarget } from '@/data/spire/potions'
import {
  canPlayCard,
  cardNeedsTarget,
  createBattle,
  endPlayerTurn,
  getIntentDisplay,
  playCard,
  startPlayerTurn,
  applyPotion,
} from '@/engine/spire/engine'
import { rngFromSeed } from '@/engine/spire/rng'
import { rollRewards, type RewardBundle } from '@/engine/spire/rewards'
import type { BattleEvent, BattleState } from '@/engine/spire/types'
import { useProfile } from '@/store/profile'
import { useSpire } from '@/store/spire'
import FragmentChip from '@/components/FragmentChip'
import GoldButton from '@/components/GoldButton'
import DefeatScreen from '@/components/spire/combat/DefeatScreen'
import EnemyUnit from '@/components/spire/combat/EnemyUnit'
import HandArea from '@/components/spire/combat/HandArea'
import PlayerPanel, { EnergyOrb } from '@/components/spire/combat/PlayerPanel'
import PotionBar from '@/components/spire/combat/PotionBar'
import RewardScreen from '@/components/spire/combat/RewardScreen'
import { STATUS_META } from '@/components/spire/combat/cardMeta'
import type { Floater } from '@/components/spire/combat/floaters'
import { cn } from '@/lib/utils'

const NODE_LABEL: Record<string, string> = { battle: '战斗', elite: '精英战', boss: 'BOSS 战' }

interface InitSnapshot {
  enemyIds: string[]
  nodeType: NodeType
  floor: number
  deck: string[]
  relics: string[]
  potions: string[]
  hp: number
  maxHp: number
}

export default function SpireCombat() {
  const navigate = useNavigate()

  // 进入战斗的一次性快照（无 combat 状态 → 重定向）
  const [init] = useState<InitSnapshot | null>(() => {
    const sp = useSpire.getState()
    if (!sp.combat || sp.combat.enemyIds.length === 0) return null
    return {
      enemyIds: sp.combat.enemyIds,
      nodeType: sp.combat.nodeType,
      floor: sp.floor,
      deck: sp.deck,
      relics: sp.relics,
      potions: sp.potions,
      hp: sp.hp,
      maxHp: sp.maxHp,
    }
  })

  const battleRef = useRef<BattleState | null>(null)
  if (init && !battleRef.current) {
    battleRef.current = createBattle({
      enemyIds: init.enemyIds,
      deck: init.deck,
      relics: init.relics,
      potions: init.potions,
      hp: init.hp,
      maxHp: init.maxHp,
      nodeType: init.nodeType,
      floor: init.floor,
    })
  }
  const [, setVersion] = useState(0)
  const commit = useCallback((s: BattleState) => {
    battleRef.current = s
    setVersion((v) => v + 1)
  }, [])

  const [busy, setBusy] = useState(false)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [selectedPotion, setSelectedPotion] = useState<string | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [shakes, setShakes] = useState<Record<string, number>>({})
  const [turnBanner, setTurnBanner] = useState<number | null>(null)
  const [quote, setQuote] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reward, setReward] = useState<RewardBundle | null>(null)
  const [defeated, setDefeated] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)

  const floaterId = useRef(0)
  const timers = useRef<number[]>([])
  const rewardedRef = useRef(false)
  const defeatedRef = useRef(false)

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const gold = useSpire((s) => s.gold)
  const diamond = useProfile((s) => s.fragments.diamond)
  const companion = useProfile((s) => s.companion)
  const echo = companion ? getEcho(companion.echoId) : undefined
  const portrait = echo?.portrait ?? '/avatar-traveler.png'
  const companionName = companion?.customName ?? '旅人'

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }, [])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // ---------------------------------------------------------- 飘字 / 抖动
  const addFloater = useCallback((target: string, text: string, cls: Floater['cls']) => {
    const id = ++floaterId.current
    setFloaters((fs) => [...fs.slice(-11), { id, target, text, cls }])
    later(950, () => setFloaters((fs) => fs.filter((f) => f.id !== id)))
  }, [later])

  const addShake = useCallback((target: string) => {
    setShakes((sh) => ({ ...sh, [target]: (sh[target] ?? 0) + 1 }))
  }, [])

  // ---------------------------------------------------------- 胜负
  const handleVictory = useCallback((s: BattleState) => {
    if (rewardedRef.current) return
    rewardedRef.current = true
    const bundle = rollRewards(rngFromSeed((Date.now() % 2147483647) | 1), s.nodeType, s.relics)
    const prof = useProfile.getState()
    prof.addFragments('diamond', bundle.fragments)
    if (bundle.isBoss) prof.addWin('diamond')
    later(reducedMotion ? 200 : 800, () => setReward(bundle))
  }, [later, reducedMotion])

  const handleDefeat = useCallback((s: BattleState) => {
    if (defeatedRef.current) return
    defeatedRef.current = true
    const sp = useSpire.getState()
    sp.endCombat({ win: false, hp: 0, gold: 0, kills: s.kills })
    sp.endRun(false)
    later(reducedMotion ? 200 : 900, () => setDefeated(true))
  }, [later, reducedMotion])

  // ---------------------------------------------------------- 事件 → 演出
  const processEvents = useCallback(
    (events: BattleEvent[], s: BattleState) => {
      for (const ev of events) {
        switch (ev.kind) {
          case 'damage': {
            addShake(ev.target)
            if (ev.amount > 0) addFloater(ev.target, `-${ev.amount}`, 'dmg')
            else if (ev.attack && ev.target === 'player' && s.counters.invulnerable) addFloater(ev.target, '无敌', 'info')
            else if (ev.blocked > 0) addFloater(ev.target, '格挡', 'block')
            break
          }
          case 'block':
            if (ev.amount > 0) addFloater(ev.target, `+${ev.amount} 格挡`, 'block')
            break
          case 'heal':
            addFloater('player', `+${ev.amount}`, 'heal')
            break
          case 'status': {
            const meta = STATUS_META[ev.status]
            addFloater(ev.target, `${meta.name}${ev.amount > 0 ? '+' : ''}${ev.amount}`, 'status')
            break
          }
          case 'turn':
            setTurnBanner(ev.turn)
            later(reducedMotion ? 400 : 1000, () => setTurnBanner(null))
            break
          case 'phase':
            setQuote(ev.quote)
            later(reducedMotion ? 800 : 2000, () => setQuote(null))
            break
          case 'summon':
            addFloater(ev.enemy, `${ev.name} 现身`, 'label')
            break
          case 'enemyAction':
            addFloater(ev.enemy, ev.label, 'label')
            break
          case 'relic':
            setNotice(ev.text)
            later(1600, () => setNotice(null))
            break
          case 'deathSave':
            setNotice(ev.text)
            later(2200, () => setNotice(null))
            break
          case 'death':
            break
          case 'win':
            handleVictory(s)
            break
          case 'lose':
            handleDefeat(s)
            break
          default:
            break
        }
      }
    },
    [addFloater, addShake, handleDefeat, handleVictory, later, reducedMotion],
  )

  // ---------------------------------------------------------- 回合初始化
  useEffect(() => {
    const s = battleRef.current
    if (!s) return
    const events = startPlayerTurn(s)
    commit(s)
    processEvents(events, s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc / 右键取消选择
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUid(null)
        setSelectedPotion(null)
      }
    }
    const onCtx = (e: MouseEvent) => {
      if (selectedUid !== null || selectedPotion !== null) {
        e.preventDefault()
        setSelectedUid(null)
        setSelectedPotion(null)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('contextmenu', onCtx)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('contextmenu', onCtx)
    }
  }, [selectedUid, selectedPotion])

  // ---------------------------------------------------------- 出牌 / 药水 / 目标
  const onCardSelect = (uid: number) => {
    const s = battleRef.current
    if (!s || busy || s.phase !== 'player') return
    if (selectedUid === uid) {
      setSelectedUid(null)
      return
    }
    if (!canPlayCard(s, uid).ok) return
    if (cardNeedsTarget(s, uid)) {
      setSelectedUid(uid)
      setSelectedPotion(null)
      return
    }
    const next = structuredClone(s)
    try {
      const events = playCard(next, uid)
      commit(next)
      processEvents(events, next)
    } catch {
      /* 非法出牌忽略 */
    }
    setSelectedUid(null)
  }

  const onPotionClick = (pid: string) => {
    const s = battleRef.current
    if (!s || busy || s.phase !== 'player') return
    if (selectedPotion === pid) {
      setSelectedPotion(null)
      return
    }
    if (potionNeedsTarget(pid)) {
      setSelectedPotion(pid)
      setSelectedUid(null)
      return
    }
    const next = structuredClone(s)
    try {
      const events = applyPotion(next, pid)
      commit(next)
      processEvents(events, next)
    } catch {
      /* 忽略 */
    }
  }

  const onEnemyClick = (key: string) => {
    const s = battleRef.current
    if (!s || busy || s.phase !== 'player') return
    if (selectedUid !== null) {
      const next = structuredClone(s)
      try {
        const events = playCard(next, selectedUid, key)
        commit(next)
        processEvents(events, next)
      } catch {
        /* 忽略 */
      }
      setSelectedUid(null)
    } else if (selectedPotion !== null) {
      const next = structuredClone(s)
      try {
        const events = applyPotion(next, selectedPotion, key)
        commit(next)
        processEvents(events, next)
      } catch {
        /* 忽略 */
      }
      setSelectedPotion(null)
    }
  }

  // ---------------------------------------------------------- 结束回合（敌人行动演出）
  const onEndTurn = () => {
    const s = battleRef.current
    if (!s || busy || s.phase !== 'player') return
    setBusy(true)
    setSelectedUid(null)
    setSelectedPotion(null)
    const work = structuredClone(s)
    const steps = endPlayerTurn(work)
    const delay = reducedMotion ? 260 : 720

    let i = 0
    const playNext = () => {
      if (i >= steps.length) {
        if (work.phase === 'won' || work.phase === 'lost') {
          commit(work)
          setBusy(false)
          return
        }
        const events = startPlayerTurn(work)
        commit(work)
        processEvents(events, work)
        setBusy(false)
        return
      }
      const step = steps[i++]
      commit(step.state)
      processEvents(step.events, step.state)
      later(delay, playNext)
    }
    if (steps.length === 0) {
      setBusy(false)
      return
    }
    playNext()
  }

  // ---------------------------------------------------------- 奖励确认 / 放弃
  const confirmReward = ({ cardId, relicId }: { cardId?: string; relicId?: string }) => {
    const s = battleRef.current
    if (!s || !reward) return
    const sp = useSpire.getState()
    if (cardId) sp.addCard(cardId)
    if (relicId) sp.addRelic(relicId)
    // 药水消耗回写（按差量）
    const before = new Map<string, number>()
    for (const p of init?.potions ?? []) before.set(p, (before.get(p) ?? 0) + 1)
    const after = new Map<string, number>()
    for (const p of s.potions) after.set(p, (after.get(p) ?? 0) + 1)
    for (const [pid, n0] of before) {
      const used = n0 - (after.get(pid) ?? 0)
      for (let i = 0; i < used; i++) sp.consumePotion(pid)
    }
    sp.endCombat({ win: true, hp: s.player.hp, gold: reward.gold, kills: s.kills })
    navigate('/game/spire/map')
  }

  const giveUp = () => {
    useSpire.getState().abandonRun()
    navigate('/lobby')
  }

  const backToLobby = () => {
    useSpire.getState().abandonRun()
    navigate('/lobby')
  }

  // ---------------------------------------------------------- 渲染
  if (!init) return <Navigate to="/game/spire" replace />
  const battle = battleRef.current
  if (!battle) return <Navigate to="/game/spire" replace />

  const targeting = selectedUid !== null || selectedPotion !== null
  const selectedPotionDef = selectedPotion ? getPotion(selectedPotion) : null
  const bgSrc = `/combat-bg-${Math.min(3, Math.max(1, init.floor))}.png`
  const isBossFight = init.nodeType === 'boss'

  return (
    <div className="relative z-[55] -mt-16 flex h-[100dvh] flex-col overflow-hidden bg-abyss text-bone">
      {/* 背景（低透明度缓慢视差） */}
      <div className="absolute inset-0">
        <motion.div
          className="h-[106%] w-full"
          animate={reducedMotion ? undefined : { y: [0, -14, 0] }}
          transition={reducedMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src={bgSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        </motion.div>
        <div
          className={cn(
            'absolute inset-0',
            isBossFight
              ? 'bg-[radial-gradient(120%_90%_at_50%_8%,rgba(216,68,60,.10),rgba(7,6,11,.86)_78%)]'
              : 'bg-[radial-gradient(120%_90%_at_50%_8%,rgba(242,169,59,.07),rgba(7,6,11,.84)_78%)]',
          )}
        />
      </div>

      {/* 顶部细栏 */}
      <div className="relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-[rgba(227,194,124,.12)] bg-[rgba(12,10,19,.62)] px-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-sanssc text-[12px] text-dim">
          <Layers size={13} className="text-suit-diamond" />
          <span>
            第 <span className="font-cinzel text-gold-300">{init.floor}</span> 层 · {NODE_LABEL[init.nodeType] ?? '战斗'}
          </span>
          <span className="text-faint">｜回合 {battle.turn}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-mono text-[13px] text-gold-300">
            <Coins size={13} /> {gold}
          </span>
          <FragmentChip suit="diamond" count={diamond} size="sm" />
          {confirmGiveUp ? (
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={giveUp} className="font-sanssc text-[12px] text-cinnabar-hi hover:underline">
                确认放弃
              </button>
              <button type="button" onClick={() => setConfirmGiveUp(false)} className="font-sanssc text-[12px] text-dim hover:text-bone">
                取消
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmGiveUp(true)}
              className="flex items-center gap-1 font-sanssc text-[12px] text-faint transition-colors hover:text-cinnabar-hi"
              title="放弃本局，返回大厅"
            >
              <Flag size={12} /> 放弃
            </button>
          )}
        </div>
      </div>

      {/* 敌方区（上方 2/5） */}
      <div className={cn('relative z-10 flex min-h-0 flex-[2] items-center justify-center gap-8 px-6 pt-2', targeting && 'cursor-crosshair')}>
        <AnimatePresence>
          {battle.enemies.map((c) => (
            <EnemyUnit
              key={c.key}
              c={c}
              intent={getIntentDisplay(battle, c)}
              selectable={targeting && c.alive}
              shake={shakes[c.key] ?? 0}
              floaters={floaters.filter((f) => f.target === c.key)}
              onClick={() => onEnemyClick(c.key)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* 选目标提示 */}
      <div className="relative z-10 flex h-6 shrink-0 items-center justify-center">
        {targeting && (
          <span className="rounded-full border border-gold-300/40 bg-ink/80 px-3 py-0.5 font-sanssc text-[11px] tracking-[.2em] text-gold-300">
            {selectedPotionDef ? `使用 ${selectedPotionDef.name}：选择一名敌人` : '选择目标'}（Esc / 右键取消）
          </span>
        )}
      </div>

      {/* 玩家区 */}
      <div className="relative z-10 flex shrink-0 items-end justify-between px-6 pb-1">
        <PlayerPanel
          state={battle}
          portrait={portrait}
          name={companionName}
          floaters={floaters.filter((f) => f.target === 'player')}
          shake={shakes.player ?? 0}
        />
        <div className="flex items-end gap-4">
          <PotionBar potions={battle.potions} selectedPotion={selectedPotion} disabled={busy || battle.phase !== 'player'} onClick={onPotionClick} />
          <EnergyOrb energy={battle.player.energy} maxEnergy={battle.player.maxEnergy} />
        </div>
      </div>

      {/* 手牌 + 牌堆 + 结束回合 */}
      <div className="relative z-10 flex shrink-0 items-end justify-between gap-3 px-4 pb-3">
        {/* 抽牌堆 */}
        <div className="flex w-[110px] flex-col items-center gap-1" title="抽牌堆">
          <div className="relative h-[74px] w-[52px]">
            <img src="/card-back.png" alt="抽牌堆" className="absolute inset-0 h-full w-full rounded-[6px] border border-[rgba(227,194,124,.35)] object-cover shadow-card" draggable={false} />
            <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-[6px] border border-[rgba(227,194,124,.18)] bg-ink -z-10" />
            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-gold-500/60 bg-ink px-1 font-mono text-[11px] text-gold-300">
              {battle.drawPile.length}
            </span>
          </div>
          <span className="font-sanssc text-[10px] text-faint">抽牌堆</span>
        </div>

        {/* 手牌扇形区 */}
        <div className="min-w-0 flex-1">
          <HandArea state={battle} selectedUid={selectedUid} onSelect={onCardSelect} busy={busy} />
        </div>

        {/* 弃牌堆 / 消耗堆 / 结束回合 */}
        <div className="flex w-[150px] flex-col items-end gap-2">
          <div className="flex items-center gap-3 font-mono text-[11px] text-dim">
            <span title="弃牌堆">弃 {battle.discardPile.length}</span>
            <span title="消耗堆">耗 {battle.exhaustPile.length}</span>
          </div>
          <GoldButton variant="gold" size="md" disabled={busy || battle.phase !== 'player'} onClick={onEndTurn} className="w-full">
            {busy ? '敌方行动…' : '结束回合'}
          </GoldButton>
        </div>
      </div>

      {/* 回合横幅 */}
      <AnimatePresence>
        {turnBanner !== null && (
          <motion.div
            key={`turn-${turnBanner}`}
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center"
          >
            <span
              className="font-mashan text-[56px] leading-none tracking-[.2em]"
              style={{
                background: 'linear-gradient(180deg,#F8E9C0 20%,#E3C27C 60%,#A87F3D 95%)',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                textShadow: '0 4px 24px rgba(7,6,11,.9)',
              }}
            >
              第 {turnBanner} 回合
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Boss 转阶段 / 换面 全屏台词 */}
      <AnimatePresence>
        {quote !== null && (
          <motion.div
            key={quote}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[rgba(7,6,11,.55)]"
          >
            <motion.p
              initial={{ scale: 0.92, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[720px] px-6 text-center font-serifsc text-[30px] font-semibold leading-relaxed text-cinnabar-hi"
              style={{ textShadow: '0 0 30px rgba(216,68,60,.55), 0 2px 10px rgba(0,0,0,.9)' }}
            >
              「{quote}」
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 中央提示（遗物触发 / 免死） */}
      <AnimatePresence>
        {notice !== null && (
          <motion.div
            key={notice}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center"
          >
            <span className="rounded-full border border-gold-500/50 bg-ink/90 px-4 py-1.5 font-sanssc text-[13px] text-gold-100 shadow-gold-glow">
              {notice}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 奖励屏 / 终焉结算屏 */}
      {reward && <RewardScreen bundle={reward} onConfirm={confirmReward} />}
      {defeated && <DefeatScreen floor={init.floor} kills={useSpire.getState().kills} diamondFragments={diamond} onLobby={backToLobby} />}
    </div>
  )
}
