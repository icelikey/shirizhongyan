/**
 * ============================================================================
 * useCloudProfile —— 档案云同步（AppShell 内挂载一次）
 * ----------------------------------------------------------------------------
 * - Kimi 已登录（useAuth）：进入时 `profile.get`
 *     · 云端有档案 → 与本地 useProfile 合并（云端为准覆盖：碎片/位阶/生肖/
 *       战绩/残章/影从记忆；昵称保留本地仪式名；契约影从云端有则从云）。
 *     · 云端无档案 → 以本地全量 `profile.save` 初始化云端。
 * - 此后订阅 useProfile 任意变更，防抖 2s 全量写回 `profile.save`。
 * - 未登录不动作（status='logged-out'，TopHUD 抽屉显示「未登录仅本地」）。
 *
 * 同步状态经 `useCloudSync`（模块级 zustand）暴露给 TopHUD 等 UI 消费。
 * ============================================================================
 */
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/store/profile'
import type { Companion, EchoMemory, GameId, GameRecord, ProfileState } from '@/store/profile'
import type { Suit } from '@/data/echoes'
import type { Tier } from '@/data/tiers'

export type CloudSyncStatus = 'logged-out' | 'syncing' | 'synced' | 'error'

interface CloudSyncState {
  status: CloudSyncStatus
  /** 最近一次成功写回（或云端读取）的时间戳 */
  lastSyncedAt: number | null
}

/** 模块级同步状态（TopHUD 用户抽屉展示用） */
export const useCloudSync = create<CloudSyncState>(() => ({
  status: 'logged-out',
  lastSyncedAt: null,
}))

const setSync = (patch: Partial<CloudSyncState>) => useCloudSync.setState(patch)

const TIERS: Tier[] = ['huang', 'xuan', 'di', 'tian']
const SUIT_KEYS: Suit[] = ['spade', 'heart', 'club', 'diamond']

/* ------------------------- 本地 → 云端载荷 ------------------------- */
function toPayload(s: ProfileState) {
  return {
    nickname: s.session?.nickname ?? '旅人',
    fragSpade: s.fragments.spade,
    fragHeart: s.fragments.heart,
    fragClub: s.fragments.club,
    fragDiamond: s.fragments.diamond,
    tier: s.tier,
    zodiacJson: { ...s.zodiac, winsToward: s.winsTowardZodiac },
    companionJson: s.companion,
    recordsJson: { ...s.records, mvps: s.mvps },
    echoMemoriesJson: s.echoMemories,
    unlockedLoreJson: s.unlockedLore,
  }
}

/* ------------------------- 云端行的防御性解析 ------------------------- */
interface CloudRow {
  nickname: string
  fragSpade: number
  fragHeart: number
  fragClub: number
  fragDiamond: number
  tier: string
  zodiacJson: unknown
  companionJson: unknown
  recordsJson: unknown
  echoMemoriesJson: unknown
  unlockedLoreJson: unknown
  updatedAt: Date
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function parseZodiac(v: unknown, fallback: ProfileState['zodiac']): ProfileState['zodiac'] {
  if (!isObj(v)) return fallback
  const out = { ...fallback }
  for (const s of SUIT_KEYS) {
    const arr = v[s]
    if (Array.isArray(arr) && arr.every((n) => typeof n === 'number')) out[s] = arr as number[]
  }
  return out
}

function parseWins(v: unknown, fallback: ProfileState['winsTowardZodiac']): ProfileState['winsTowardZodiac'] {
  if (!isObj(v)) return fallback
  const out = { ...fallback }
  for (const s of SUIT_KEYS) {
    const n = v[s]
    if (typeof n === 'number' && Number.isFinite(n)) out[s] = n
  }
  return out
}

function parseGameRecord(v: unknown, fallback: GameRecord): GameRecord {
  if (!isObj(v)) return fallback
  const played = typeof v.played === 'number' ? v.played : fallback.played
  const won = typeof v.won === 'number' ? v.won : fallback.won
  return { played, won }
}

function parseCompanion(v: unknown, fallback: Companion | null): Companion | null {
  if (!isObj(v) || typeof v.echoId !== 'string') return fallback
  return {
    echoId: v.echoId,
    customName: typeof v.customName === 'string' ? v.customName : '影从',
    style:
      v.style === 'calm' || v.style === 'sharp' || v.style === 'warm' || v.style === 'balanced'
        ? v.style
        : 'balanced',
    memorySlots: typeof v.memorySlots === 'number' ? v.memorySlots : 3,
    bond: typeof v.bond === 'number' ? v.bond : 1,
  }
}

function parseEchoMemories(v: unknown, fallback: ProfileState['echoMemories']): ProfileState['echoMemories'] {
  if (!isObj(v)) return fallback
  const out: Record<string, EchoMemory> = {}
  for (const [k, raw] of Object.entries(v)) {
    if (!isObj(raw)) continue
    out[k] = {
      met: raw.met === true,
      wonAgainst: typeof raw.wonAgainst === 'number' ? raw.wonAgainst : 0,
      lostTo: typeof raw.lostTo === 'number' ? raw.lostTo : 0,
      note: Array.isArray(raw.note) ? raw.note.filter((n): n is string => typeof n === 'string') : [],
    }
  }
  return out
}

/** 云端为准合并进本地（昵称保留本地仪式名，不动 session） */
function applyCloud(row: CloudRow) {
  const local = useProfile.getState()
  const rec = isObj(row.recordsJson) ? row.recordsJson : {}
  const records: Record<GameId, GameRecord> = {
    guess: parseGameRecord(rec.guess, local.records.guess),
    werewolf: parseGameRecord(rec.werewolf, local.records.werewolf),
  }
  const mvpsRaw = isObj(rec.mvps) ? rec.mvps : {}
  const mvps: Record<GameId, number> = {
    guess: typeof mvpsRaw.guess === 'number' ? mvpsRaw.guess : local.mvps.guess,
    werewolf: typeof mvpsRaw.werewolf === 'number' ? mvpsRaw.werewolf : local.mvps.werewolf,
  }
  useProfile.setState({
    fragments: {
      spade: row.fragSpade,
      heart: row.fragHeart,
      club: row.fragClub,
      diamond: row.fragDiamond,
    },
    tier: (TIERS as string[]).includes(row.tier) ? (row.tier as Tier) : local.tier,
    zodiac: parseZodiac(row.zodiacJson, local.zodiac),
    winsTowardZodiac: parseWins(
      isObj(row.zodiacJson) ? row.zodiacJson.winsToward : undefined,
      local.winsTowardZodiac,
    ),
    records,
    mvps,
    companion: parseCompanion(row.companionJson, local.companion),
    echoMemories: parseEchoMemories(row.echoMemoriesJson, local.echoMemories),
    unlockedLore: Array.isArray(row.unlockedLoreJson)
      ? row.unlockedLoreJson.filter((n): n is number => typeof n === 'number')
      : local.unlockedLore,
  })
}

/* ------------------------- 主 Hook ------------------------- */
const SAVE_DEBOUNCE_MS = 2000

export function useCloudProfile() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const saveMutation = trpc.profile.save.useMutation({
    onSuccess: () => setSync({ status: 'synced', lastSyncedAt: Date.now() }),
    onError: () => setSync({ status: 'error' }),
  })

  /** 合并/初始化期间屏蔽订阅回写，避免抖动循环 */
  const applyingRef = useRef(false)
  /** 首同步完成后才开始订阅回写 */
  const readyRef = useRef(false)
  const saveRef = useRef(saveMutation)
  saveRef.current = saveMutation

  /* 首同步：云端有 → 合并（云端为准）；无 → 本地全量初始化 */
  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    if (profileQuery.data === undefined || readyRef.current) return
    readyRef.current = true
    applyingRef.current = true
    const row = profileQuery.data
    if (row) {
      applyCloud(row)
      applyingRef.current = false
      setSync({ status: 'synced', lastSyncedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now() })
    } else {
      applyingRef.current = false
      setSync({ status: 'syncing' })
      saveRef.current.mutate(toPayload(useProfile.getState()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, profileQuery.data])

  /* 订阅本地档案变更 → 防抖 2s 全量写回 */
  useEffect(() => {
    if (!isAuthenticated) {
      readyRef.current = false
      setSync({ status: 'logged-out', lastSyncedAt: null })
      return
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useProfile.subscribe(() => {
      if (applyingRef.current || !readyRef.current) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setSync({ status: 'syncing' })
        saveRef.current.mutate(toPayload(useProfile.getState()))
      }, SAVE_DEBOUNCE_MS)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [isAuthenticated])
}
