import { describe, expect, it } from 'vitest'
import { projectPublicWorldKnowledge, type PublicWorldState } from '../src/components/world/world.projection'

const state: PublicWorldState = {
  worldId: 'tdg-world',
  epoch: 3,
  direction: 'memory',
  directionTallies: [
    { direction: 'memory', score: 4, contributions: 2, participants: 3, share: 1 },
    { direction: 'law', score: 0, contributions: 0, participants: 0, share: 0 },
    { direction: 'voice', score: 0, contributions: 0, participants: 0, share: 0 },
    { direction: 'trust', score: 0, contributions: 0, participants: 0, share: 0 },
    { direction: 'rupture', score: 0, contributions: 0, participants: 0, share: 0 },
  ],
  contributionsAccepted: 4,
  uniqueParticipants: 3,
  truthShards: [{
    clueId: 'last-sun',
    supportingEvents: ['match-1:world:0'],
    supportingGames: ['superpower-billiards/v1', 'beast-race/v1'],
    independentParticipants: 3,
    confidence: 0.9,
    status: 'confirmed',
  }],
  publicAnchors: ['direction:memory'],
  checksum: 'a'.repeat(64),
  status: 'live-aggregated-world',
}

describe('projectPublicWorldKnowledge', () => {
  it('projects only public world state into the knowledge board model', () => {
    const result = projectPublicWorldKnowledge(state)
    expect(result.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'world-clock',
      'world-direction-memory',
      'anchor-direction-memory',
      'truth-last-sun',
    ]))
    expect(result.events.some((event) => event.title.includes('第 3 纪元'))).toBe(true)
    expect(result.clues[0]).toMatchObject({ id: 'last-sun', state: 'verified' })
    expect(result.nodes.find((node) => node.id === 'truth-last-sun')?.detail).toContain('match-1:world:0')
  })

  it('returns an empty projection until the server provides a public state', () => {
    expect(projectPublicWorldKnowledge(null)).toEqual({ nodes: [], events: [], clues: [] })
  })
})

