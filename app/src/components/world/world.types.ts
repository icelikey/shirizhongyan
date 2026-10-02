import type { ComponentType } from 'react'

export type WorldKnowledgeNodeKind = 'lore' | 'place' | 'faction' | 'relic'
export type WorldKnowledgeNodeStatus = 'known' | 'unstable' | 'sealed'
export type WorldKnowledgeEventSeverity = 'signal' | 'warning' | 'critical'
export type WorldKnowledgeClueState = 'unread' | 'open' | 'verified'

export interface WorldKnowledgeNode {
  id: string
  title: string
  eyebrow: string
  summary: string
  detail: string
  kind: WorldKnowledgeNodeKind
  status?: WorldKnowledgeNodeStatus
  tags?: string[]
  linkedNodeIds?: string[]
  clueIds?: string[]
  accent?: string
  icon?: ComponentType<{ size?: number; className?: string }>
}

export interface WorldKnowledgeEvent {
  id: string
  title: string
  summary: string
  occurredAt: string
  severity: WorldKnowledgeEventSeverity
  nodeIds: string[]
  detail?: string
  isUnread?: boolean
}

export interface WorldKnowledgeClue {
  id: string
  label: string
  title: string
  body: string
  nodeIds: string[]
  quote?: string
  state?: WorldKnowledgeClueState
}

export interface WorldKnowledgeData {
  nodes: WorldKnowledgeNode[]
  events: WorldKnowledgeEvent[]
  clues: WorldKnowledgeClue[]
}
