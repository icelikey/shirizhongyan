/**
 * useInviteEcho —— 「邀战」流程（lobby.md §R2 / agent.md 详情 Modal）。
 * Toast 两段演出（发出邀请 → 接受并创建牌桌）→ 墨染过渡进对局路由。
 * ♦ 金壤影从（大陆未开启）与对局中/离线影从不可邀战。
 */
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Echo } from '@/data/echoes'
import { ECHO_STATUS, STATUS_LABEL, gameForEcho, gameRoute } from '@/components/meta/data'

export interface InviteDeps {
  /** 墨染过渡跳转（来自 useInkTransition 的 go） */
  go: (to: string) => void
}

export function useInviteEcho({ go }: InviteDeps) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return useCallback(
    (echo: Echo) => {
      const status = ECHO_STATUS[echo.id] ?? 'offline'
      const game = gameForEcho(echo)
      if (!game) {
        toast.error('金壤大陆尚未开启', { description: `${echo.name} 的牌桌藏在迷雾之后。` })
        return
      }
      if (status !== 'online') {
        toast.error(`TA ${STATUS_LABEL[status]}，暂不可邀战`, { description: echo.name })
        return
      }
      toast(`已向 ${echo.name} 发出对局邀请`, { description: '静候回音……' })
      timers.current.push(
        setTimeout(() => {
          toast.success(`${echo.name} 接受了邀请，正在创建牌桌…`)
          timers.current.push(setTimeout(() => go(gameRoute(game)), 600))
        }, 1200),
      )
    },
    [go],
  )
}
