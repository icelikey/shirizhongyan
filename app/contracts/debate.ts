/**
 * 玄渊 · 下一步规则辩论：最小可玩的内容包契约。
 *
 * 本文件只描述纯结构化状态与校验，不写数据库副作用。规则辩论的
 * 胜负条款仍属于规则书本身；裁判采纳的候选规则只从下一回合生效。
 */
import type { GameAction } from "./room";
import { findClause, isAppealable, type Clause, type RuleBook } from "./rulebook";

export const DEBATE_TEMPLATE = "ruleDebate" as const;
export const DEBATE_RULEBOOK_ID = "rb-rule-debate";
export const DEBATE_RECORD_KEY = "ruleDebate";
export const DEBATE_QUORUM_SIZES = [3, 5, 7] as const;
export type DebateQuorumSize = (typeof DEBATE_QUORUM_SIZES)[number];

export type DebatePhase = "proposal" | "challenge" | "response" | "ruling" | "settled";
export type DebatePosition = "support" | "oppose" | "amend";
export type DebateOperation = "clarify" | "amend";
export type RulingDecision = "accept" | "reject" | "partial";

export interface DebateParams {
  rounds: number;
  quorumSize: DebateQuorumSize;
  maxArgumentLength: number;
  scoreAccepted: number;
  scoreParticipated: number;
}

export interface DebateProposal {
  id: string;
  seat: number;
  clauseId: string;
  position: DebatePosition;
  operation: DebateOperation;
  argument: string;
  round: number;
  order: number;
}

export interface DebateChallenge {
  id: string;
  seat: number;
  proposalId: string;
  clauseId: string;
  assertion: string;
  order: number;
}

export interface DebateResponse {
  challengeId: string;
  seat: number;
  argument: string;
  order: number;
}

export interface DebateJudge {
  index: number;
  name: string;
  kind: "local" | "external";
}

export interface DebateBallot {
  judgeIndex: number;
  decision: RulingDecision;
  reason: string;
}

export interface DebateRuling {
  proposalId: string;
  clauseId: string;
  round: number;
  decision: RulingDecision;
  ballots: DebateBallot[];
  appliesFromRound: number;
  summary: string;
}

export interface DebateCandidateResult {
  proposalId: string;
  clauseId: string;
  position: DebatePosition;
  supportCount: number;
  challengeCount: number;
  ruling: DebateRuling;
}

export interface DebateRoundResult {
  round: number;
  candidates: DebateCandidateResult[];
  scores: Record<number, number>;
  nextRulebookVersion: number;
  settled: boolean;
}

export interface DebateState {
  rulebook: RuleBook;
  round: number;
  phase: DebatePhase;
  seats: number[];
  proposals: DebateProposal[];
  challenges: DebateChallenge[];
  responses: DebateResponse[];
  rulings: DebateRuling[];
  scores: Record<number, number>;
  nextOrder: number;
}

export type DebateAction =
  | { type: "proposal"; proposal: Omit<DebateProposal, "id" | "round" | "order"> }
  | { type: "challenge"; challenge: Omit<DebateChallenge, "id" | "order"> }
  | { type: "response"; response: DebateResponse };

export interface DebateValidationError {
  code:
    | "invalid-seat"
    | "invalid-phase"
    | "invalid-clause"
    | "core-clause"
    | "invalid-proposal"
    | "invalid-challenge"
    | "duplicate-submission"
    | "unknown-proposal"
    | "unknown-challenge";
  message: string;
}

export function isDebateQuorumSize(value: number): value is DebateQuorumSize {
  return (DEBATE_QUORUM_SIZES as readonly number[]).includes(value);
}

function error(code: DebateValidationError["code"], message: string): DebateValidationError {
  return { code, message };
}

function validText(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

export function validateDebateProposal(params: {
  book: RuleBook;
  seats: readonly number[];
  phase: DebatePhase;
  proposal: DebateAction & { type: "proposal" };
  existing: readonly DebateProposal[];
  round: number;
  maxArgumentLength: number;
}): DebateValidationError | null {
  const p = params.proposal.proposal;
  const clause = findClause(params.book, p.clauseId);
  if (params.phase !== "proposal") return error("invalid-phase", "当前不在提案阶段。");
  if (!params.seats.includes(p.seat)) return error("invalid-seat", "该席位不属于本局。");
  if (!clause) return error("invalid-clause", "条款不存在于本局规则书。");
  if (!isAppealable(clause)) return error("core-clause", "胜负与计分条款不可修改。");
  if (!validText(p.argument, 10, params.maxArgumentLength)) {
    return error("invalid-proposal", "论据长度必须在 10–" + params.maxArgumentLength + " 字之间。");
  }
  if (params.existing.some(x => x.seat === p.seat && x.round === params.round)) {
    return error("duplicate-submission", "每席每回合只能提交一份提案。");
  }
  return null;
}

export function validateDebateChallenge(params: {
  book: RuleBook;
  seats: readonly number[];
  phase: DebatePhase;
  challenge: DebateAction & { type: "challenge" };
  proposals: readonly DebateProposal[];
}): DebateValidationError | null {
  const c = params.challenge.challenge;
  const proposal = params.proposals.find(p => p.id === c.proposalId);
  if (params.phase !== "challenge") return error("invalid-phase", "当前不在质询阶段。");
  if (!params.seats.includes(c.seat)) return error("invalid-seat", "该席位不属于本局。");
  if (!proposal) return error("unknown-proposal", "被质询的提案不存在。");
  if (proposal.clauseId !== c.clauseId) return error("invalid-clause", "质询条款必须与提案一致。");
  if (!findClause(params.book, c.clauseId)) return error("invalid-clause", "条款不存在于本局规则书。");
  if (!validText(c.assertion, 10, 500)) return error("invalid-challenge", "质询论据必须在 10–500 字之间。");
  if (c.seat === proposal.seat) return error("invalid-challenge", "提案者不能质询自己的提案。");
  return null;
}

export function createDebateState(book: RuleBook, seats: readonly number[]): DebateState {
  return {
    rulebook: book,
    round: 1,
    phase: "proposal",
    seats: [...seats],
    proposals: [],
    challenges: [],
    responses: [],
    rulings: [],
    scores: Object.fromEntries(seats.map(seat => [seat, 0])),
    nextOrder: 0,
  };
}

export function debateId(kind: string, round: number, order: number): string {
  return "debate-" + kind + "-" + round + "-" + order;
}

export function getClause(book: RuleBook, clauseId: string): Clause | undefined {
  return findClause(book, clauseId);
}
