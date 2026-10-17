import type { WorldKnowledgeData } from './world.types'

export type PublicWorldState = {
  worldId: string
  epoch: number
  direction: 'law' | 'voice' | 'trust' | 'rupture' | 'memory' | null
  directionTallies: Array<{
    direction: 'law' | 'voice' | 'trust' | 'rupture' | 'memory'
    score: number
    contributions: number
    participants: number
    share: number
  }>
  contributionsAccepted: number
  uniqueParticipants: number
  truthShards: Array<{
    clueId: string
    supportingEvents: string[]
    supportingGames: string[]
    independentParticipants: number
    confidence: number
    status: 'rumor' | 'confirmed'
  }>
  publicAnchors: string[]
  checksum: string | null
  status: string
}

const DIRECTION_META: Record<Exclude<PublicWorldState['direction'], null>, { label: string; hint: string; accent: string }> = {
  law: { label: '律之向', hint: '规则、裁判与可验证事实正在获得更多权重。', accent: '#E3C27C' },
  voice: { label: '声之向', hint: '发言、叙事与社会共识正在改变世界的可见边界。', accent: '#EE6A72' },
  trust: { label: '契之向', hint: '协作、承诺与互惠正在成为跨局的公共锚点。', accent: '#4ECB9C' },
  rupture: { label: '裂之向', hint: '背叛、异常与小概率转折正在积累成新的路径。', accent: '#F08A5D' },
  memory: { label: '忆之向', hint: '残卷、轮回与跨局连续性正在重新连接。', accent: '#8B93F8' },
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'anchor'
}

function directionNode(state: PublicWorldState) {
  if (!state.direction) {
    return {
      id: 'world-direction-undecided',
      eyebrow: `第 ${state.epoch || 0} 纪元 / 未定`,
      title: '世界尚未选边',
      summary: '公开结算已经留下脚印，但独立参与者与有效贡献还不足以改变世界方向。',
      detail: `当前有 ${state.uniqueParticipants} 名独立参与者、${state.contributionsAccepted} 条公开贡献。方向必须由服务端聚合事实决定。`,
      kind: 'lore' as const,
      status: 'unstable' as const,
      tags: ['公共聚合', '未定', '世界规则'],
      linkedNodeIds: ['world-clock'],
      accent: '#E3C27C',
    }
  }
  const meta = DIRECTION_META[state.direction]
  return {
    id: `world-direction-${state.direction}`,
    eyebrow: `第 ${state.epoch} 纪元 / 公共方向`,
    title: meta.label,
    summary: meta.hint,
    detail: `方向由 ${state.directionTallies.find((item) => item.direction === state.direction)?.participants ?? 0} 名参与者的公开贡献共同推定，模型与前端都不能直接改写它。`,
    kind: 'faction' as const,
    status: 'known' as const,
    tags: ['世界方向', state.direction, '服务端事实'],
    linkedNodeIds: ['world-clock'],
    accent: meta.accent,
  }
}

export function projectPublicWorldKnowledge(state: PublicWorldState | null): WorldKnowledgeData {
  if (!state) return { nodes: [], events: [], clues: [] }

  const clockNode = {
    id: 'world-clock',
    eyebrow: '公共锚点 / WORLD EPOCH',
    title: `第 ${state.epoch || 0} 纪元`,
    summary: '世界只承认已经完成结算、可以回放并通过公开聚合的事实。',
    detail: `这是 ${state.worldId} 的公开纪元投影。当前接受 ${state.contributionsAccepted} 条贡献，来自 ${state.uniqueParticipants} 名独立参与者。`,
    kind: 'lore' as const,
    status: state.status === 'live-aggregated-world' ? 'known' as const : 'unstable' as const,
    tags: ['纪元', '事件账本', 'stateHash'],
    linkedNodeIds: state.direction ? [`world-direction-${state.direction}`] : ['world-direction-undecided'],
    accent: '#E3C27C',
  }

  const anchorNodes = state.publicAnchors.map((anchor) => ({
    id: `anchor-${slug(anchor)}`,
    eyebrow: '公开锚点 / PUBLIC ANCHOR',
    title: anchor.startsWith('direction:') ? `方向锚点 · ${anchor.slice('direction:'.length)}` : anchor,
    summary: '该锚点由已发布世界快照继承，能够成为后续纪元与服务器接轨的公共依据。',
    detail: `锚点值为 ${anchor}。它只来自公开世界快照，不包含隐藏身份、私有记忆或未公开战报。`,
    kind: 'place' as const,
    status: 'known' as const,
    tags: ['快照', '跨服务器', '公开'],
    linkedNodeIds: ['world-clock'],
    accent: '#4ECB9C',
  }))

  const shards = state.truthShards.map((shard) => {
    const nodeId = `truth-${slug(shard.clueId)}`
    return {
      node: {
        id: nodeId,
        eyebrow: `真相碎片 / ${shard.status === 'confirmed' ? '已确认' : '传闻'}`,
        title: shard.status === 'confirmed' ? `已确认：${shard.clueId}` : `传闻：${shard.clueId}`,
        summary: `来自 ${shard.independentParticipants} 名独立参与者、${shard.supportingGames.length} 个游戏的公开证据。`,
        detail: `置信度 ${(shard.confidence * 100).toFixed(0)}%。证据事件：${shard.supportingEvents.join('、') || '暂无'}。只有事件链能推动它从传闻进入确认。`,
        kind: 'relic' as const,
        status: shard.status === 'confirmed' ? 'known' as const : 'unstable' as const,
        tags: ['真相', shard.status, ...shard.supportingGames.slice(0, 3)],
        linkedNodeIds: ['world-clock', ...(state.direction ? [`world-direction-${state.direction}`] : [])],
        clueIds: [shard.clueId],
        accent: shard.status === 'confirmed' ? '#E3C27C' : '#8B93F8',
      },
      event: {
        id: `truth-event-${slug(shard.clueId)}`,
        title: shard.status === 'confirmed' ? `碎片 ${shard.clueId} 完成确认` : `碎片 ${shard.clueId} 仍在回响`,
        summary: `跨 ${shard.supportingGames.length} 个游戏形成 ${shard.independentParticipants} 名独立参与者的交叉证据。`,
        occurredAt: `第 ${state.epoch} 纪元`,
        severity: shard.status === 'confirmed' ? 'critical' as const : 'warning' as const,
        nodeIds: [nodeId, 'world-clock'],
        detail: `证据引用：${shard.supportingEvents.join('、') || '暂无'}。`,
        isUnread: shard.status !== 'confirmed',
      },
      clue: {
        id: shard.clueId,
        label: `TRUTH-${slug(shard.clueId).toUpperCase()}`,
        title: shard.status === 'confirmed' ? `已确认的记忆：${shard.clueId}` : `待验证的记忆：${shard.clueId}`,
        body: `这条碎片的公开证据来自 ${shard.supportingGames.length} 个游戏和 ${shard.independentParticipants} 名独立参与者。它不会直接揭示终焉真相，只能作为下一次探索的方向。`,
        nodeIds: [nodeId, 'world-clock'],
        quote: '真相不是宣布出来的，是在不同的牌局里反复撞见同一件事。',
        state: shard.status === 'confirmed' ? 'verified' as const : 'open' as const,
      },
    }
  })

  const directionEvent = state.direction ? {
    id: `direction-event-${state.direction}-${state.epoch}`,
    title: `世界偏向${DIRECTION_META[state.direction].label}`,
    summary: DIRECTION_META[state.direction].hint,
    occurredAt: `第 ${state.epoch} 纪元`,
    severity: 'signal' as const,
    nodeIds: [`world-direction-${state.direction}`, 'world-clock'],
    detail: `当前方向得分由服务端从公开贡献中聚合，前端只负责展示。`,
  } : null

  return {
    nodes: [clockNode, directionNode(state), ...anchorNodes, ...shards.map((item) => item.node)],
    events: [
      {
        id: `epoch-event-${state.epoch}`,
        title: `第 ${state.epoch || 0} 纪元公开快照形成`,
        summary: `${state.contributionsAccepted} 条贡献进入世界账本，快照校验值 ${state.checksum?.slice(0, 12) ?? '待生成'}。`,
        occurredAt: '当前纪元',
        severity: 'signal',
        nodeIds: ['world-clock'],
      },
      ...(directionEvent ? [directionEvent] : []),
      ...shards.map((item) => item.event),
    ],
    clues: shards.map((item) => item.clue),
  }
}

