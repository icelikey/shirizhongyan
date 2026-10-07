import { createHash } from "node:crypto";
import type { ContentProposal, WorldEventRef } from "../contracts/aiNativeWorld";

export type AgentRole = "explorer" | "narrator" | "judge" | "creator" | "auditor" | "scheduler";
export type AgentStatus = "active" | "paused";
export type HeartbeatAction = "observe" | "propose";

export interface AgentBudget {
  maxHeartbeats: number;
  maxProposals: number;
  usedHeartbeats: number;
  usedProposals: number;
}

export interface WorldAgentRegistration {
  agentId: string;
  role: AgentRole;
  capabilities: readonly string[];
  heartbeatIntervalMs: number;
  budget: AgentBudget;
  status: AgentStatus;
  nextDueAt: string;
}

export interface ObservationTask {
  kind: "observation";
  taskId: string;
  idempotencyKey: string;
  agentId: string;
  worldId: string;
  dueAt: string;
  eventRefs: readonly WorldEventRef[];
  status: "queued";
}

export interface HeartbeatProposal extends ContentProposal {
  audit: { source: "agent-heartbeat"; capabilityDecision: "publish-eligible" | "draft-only" };
}

export interface AgentHeartbeatState {
  agents: Readonly<Record<string, WorldAgentRegistration>>;
  observationQueue: readonly ObservationTask[];
  proposalQueue: readonly HeartbeatProposal[];
  processedIdempotencyKeys: readonly string[];
}

export interface HeartbeatInput {
  now: string;
  worldId: string;
  eventRefs: readonly WorldEventRef[];
  action?: HeartbeatAction;
  proposal?: { type: ContentProposal["proposalType"]; title: string; description: string };
}

export interface HeartbeatResult {
  state: AgentHeartbeatState;
  emitted: readonly (ObservationTask | HeartbeatProposal)[];
  auditSummary: string;
}

const emptyBudget = (budget: Partial<AgentBudget> = {}): AgentBudget => ({
  maxHeartbeats: budget.maxHeartbeats ?? Number.MAX_SAFE_INTEGER,
  maxProposals: budget.maxProposals ?? Number.MAX_SAFE_INTEGER,
  usedHeartbeats: budget.usedHeartbeats ?? 0,
  usedProposals: budget.usedProposals ?? 0,
});

export function createHeartbeatState(): AgentHeartbeatState {
  return { agents: {}, observationQueue: [], proposalQueue: [], processedIdempotencyKeys: [] };
}

export function registerAgent(
  state: AgentHeartbeatState,
  input: Omit<WorldAgentRegistration, "budget" | "status" | "nextDueAt"> & { budget?: Partial<AgentBudget>; now: string },
): AgentHeartbeatState {
  if (!input.agentId.trim() || input.heartbeatIntervalMs <= 0) throw new Error("agentId and heartbeatIntervalMs are required");
  const existing = state.agents[input.agentId];
  const agent: WorldAgentRegistration = existing ?? {
    agentId: input.agentId,
    role: input.role,
    capabilities: [...new Set(input.capabilities)].sort(),
    heartbeatIntervalMs: input.heartbeatIntervalMs,
    budget: emptyBudget(input.budget),
    status: "active",
    nextDueAt: new Date(new Date(input.now).getTime() + input.heartbeatIntervalMs).toISOString(),
  };
  return { ...state, agents: { ...state.agents, [input.agentId]: agent } };
}

export function pauseAgent(state: AgentHeartbeatState, agentId: string): AgentHeartbeatState {
  return updateStatus(state, agentId, "paused");
}
export function resumeAgent(state: AgentHeartbeatState, agentId: string, now: string): AgentHeartbeatState {
  const agent = requireAgent(state, agentId);
  return { ...state, agents: { ...state.agents, [agentId]: { ...agent, status: "active", nextDueAt: now } } };
}
function updateStatus(state: AgentHeartbeatState, agentId: string, status: AgentStatus): AgentHeartbeatState {
  const agent = requireAgent(state, agentId);
  return { ...state, agents: { ...state.agents, [agentId]: { ...agent, status } } };
}
function requireAgent(state: AgentHeartbeatState, agentId: string): WorldAgentRegistration {
  const agent = state.agents[agentId];
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  return agent;
}
function key(agentId: string, worldId: string, dueAt: string, action: HeartbeatAction): string {
  return `heartbeat:${agentId}:${worldId}:${dueAt}:${action}`;
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function runAgentHeartbeat(state: AgentHeartbeatState, agentId: string, input: HeartbeatInput): HeartbeatResult {
  const agent = requireAgent(state, agentId);
  const nowMs = new Date(input.now).getTime();
  if (agent.status === "paused" || new Date(agent.nextDueAt).getTime() > nowMs) {
    return { state, emitted: [], auditSummary: `${agentId}: skipped (paused or not due)` };
  }
  const action = input.action ?? "observe";
  const idempotencyKey = key(agentId, input.worldId, agent.nextDueAt, action);
  if (state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { state, emitted: [], auditSummary: `${agentId}: idempotent replay ${idempotencyKey}` };
  }
  if (agent.budget.usedHeartbeats >= agent.budget.maxHeartbeats) {
    return { state, emitted: [], auditSummary: `${agentId}: budget exhausted` };
  }
  const nextDueAt = new Date(nowMs + agent.heartbeatIntervalMs).toISOString();
  let nextState: AgentHeartbeatState = {
    ...state,
    agents: { ...state.agents, [agentId]: { ...agent, nextDueAt, budget: { ...agent.budget, usedHeartbeats: agent.budget.usedHeartbeats + 1 } } },
    processedIdempotencyKeys: [...state.processedIdempotencyKeys, idempotencyKey],
  };
  let emitted: (ObservationTask | HeartbeatProposal)[] = [];
  if (action === "propose" && input.proposal && agent.budget.usedProposals < agent.budget.maxProposals && input.eventRefs.length > 0) {
    const proposalId = `proposal-${hash(idempotencyKey).slice(0, 24)}`;
    const source = [...input.eventRefs];
    const proposal: HeartbeatProposal = {
      contractVersion: "1.0.0", proposalId, idempotencyKey, worldId: input.worldId, matchId: source[0].matchId,
      proposerId: agentId, version: "1.0.0", proposalType: input.proposal.type, title: input.proposal.title,
      description: input.proposal.description, sourceEvents: source, permissions: { visibility: "public", allowedRoles: [agent.role], approvalRequired: true },
      stateHash: source[0].stateHash, eventSeq: source[0].eventSeq, status: "draft",
      audit: { source: "agent-heartbeat", capabilityDecision: agent.capabilities.includes("publish") ? "publish-eligible" : "draft-only" },
    };
    emitted = [proposal];
    nextState = { ...nextState, proposalQueue: [...state.proposalQueue, proposal], agents: { ...nextState.agents, [agentId]: { ...nextState.agents[agentId], budget: { ...nextState.agents[agentId].budget, usedProposals: agent.budget.usedProposals + 1 } } } };
  } else {
    const task: ObservationTask = { kind: "observation", taskId: `observation-${hash(idempotencyKey).slice(0, 24)}`, idempotencyKey, agentId, worldId: input.worldId, dueAt: input.now, eventRefs: [...input.eventRefs], status: "queued" };
    emitted = [task]; nextState = { ...nextState, observationQueue: [...state.observationQueue, task] };
  }
  return { state: nextState, emitted, auditSummary: `${agentId}: ${action} emitted=${emitted.length} nextDueAt=${nextDueAt}` };
}

export const tickAgent = runAgentHeartbeat;
