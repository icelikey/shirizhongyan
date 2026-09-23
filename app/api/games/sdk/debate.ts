/**
 * 规则辩论服务端模板（纯函数/内存状态）。
 *
 * 公共 GameTemplate/GameDefinition 尚未包含 ruleDebate，本模块不写
 * registry/runtime。接线时应把 DebateAction 加入公共动作联合类型，并把
 * DebateTemplateModule 映射为 TemplateModule。
 */
import type { GameAction } from "@contracts/room";
import type {
  DebateAction,
  DebateBallot,
  DebateCandidateResult,
  DebateChallenge,
  DebateJudge,
  DebateParams,
  DebateProposal,
  DebateResponse,
  DebateRoundResult,
  DebateRuling,
  DebateState,
  RulingDecision,
} from "@contracts/debate";
import {
  debateId,
  isDebateQuorumSize,
  validateDebateChallenge,
  validateDebateProposal,
} from "@contracts/debate";

export interface DebateJudgeInput {
  judge: DebateJudge;
  proposal: DebateProposal;
  challenges: DebateChallenge[];
  responses: DebateResponse[];
  round: number;
}

export type DebateJudgeEvaluator = (
  input: DebateJudgeInput,
) => RulingDecision | Promise<RulingDecision>;

export interface DebateTemplateModule {
  template: "ruleDebate";
  gameKind: "rule-debate";
  recordKey: "ruleDebate";
  initMatchState: (seats: readonly number[]) => DebateState;
  submit: (state: DebateState, action: DebateAction, params: DebateParams) => DebateState;
  finishRound: (
    state: DebateState,
    params: DebateParams,
    evaluator?: DebateJudgeEvaluator,
  ) => Promise<DebateRoundResult>;
}

export class DebateActionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DebateActionError";
    this.code = code;
  }
}

function cloneState(state: DebateState): DebateState {
  return {
    ...state,
    proposals: [...state.proposals],
    challenges: [...state.challenges],
    responses: [...state.responses],
    rulings: [...state.rulings],
    scores: { ...state.scores },
    seats: [...state.seats],
    rulebook: { ...state.rulebook, clauses: [...state.rulebook.clauses] },
  };
}

function requireQuorum(size: number): asserts size is DebateParams["quorumSize"] {
  if (!isDebateQuorumSize(size)) {
    throw new DebateActionError("invalid-quorum", "裁判团人数必须是 3、5 或 7。");
  }
}

function makeJudges(size: DebateParams["quorumSize"]): DebateJudge[] {
  return Array.from({ length: size }, (_, index) => ({
    index,
    name: index === 0 ? "算律" : "本地裁判" + index,
    kind: "local" as const,
  }));
}

function localDecision(input: DebateJudgeInput): RulingDecision {
  const substantive = input.proposal.argument.trim().length >= 40;
  const challenged = input.challenges.length > 0;
  const answered = input.responses.length > 0;
  if (substantive && (!challenged || answered)) return "accept";
  if (substantive || challenged) return "partial";
  return "reject";
}

function decisionLabel(decision: RulingDecision): string {
  return decision === "accept" ? "采纳" : decision === "partial" ? "部分成立" : "驳回";
}

export function submitDebateAction(
  state: DebateState,
  action: DebateAction,
  params: DebateParams,
): DebateState {
  const next = cloneState(state);
  if (action.type === "proposal") {
    const validation = validateDebateProposal({
      book: state.rulebook,
      seats: state.seats,
      phase: state.phase,
      proposal: action,
      existing: state.proposals,
      round: state.round,
      maxArgumentLength: params.maxArgumentLength,
    });
    if (validation) throw new DebateActionError(validation.code, validation.message);
    next.proposals.push({
      ...action.proposal,
      id: debateId("proposal", state.round, state.nextOrder),
      round: state.round,
      order: state.nextOrder,
    });
    next.nextOrder += 1;
    return next;
  }
  if (action.type === "challenge") {
    const validation = validateDebateChallenge({
      book: state.rulebook,
      seats: state.seats,
      phase: state.phase,
      challenge: action,
      proposals: state.proposals,
    });
    if (validation) throw new DebateActionError(validation.code, validation.message);
    next.challenges.push({
      ...action.challenge,
      id: debateId("challenge", state.round, state.nextOrder),
      order: state.nextOrder,
    });
    next.nextOrder += 1;
    return next;
  }
  if (state.phase !== "response") {
    throw new DebateActionError("invalid-phase", "当前不在回应阶段。");
  }
  const challenge = state.challenges.find(c => c.id === action.response.challengeId);
  if (!challenge) throw new DebateActionError("unknown-challenge", "被回应的质询不存在。");
  const owner = state.proposals.find(p => p.id === challenge.proposalId)?.seat;
  if (action.response.seat !== owner) {
    throw new DebateActionError("invalid-seat", "只有提案者可以回应质询。");
  }
  if (
    action.response.argument.trim().length < 10 ||
    action.response.argument.trim().length > params.maxArgumentLength
  ) {
    throw new DebateActionError(
      "invalid-response",
      "回应长度必须在 10–" + params.maxArgumentLength + " 字之间。",
    );
  }
  if (state.responses.some(r => r.challengeId === action.response.challengeId)) {
    throw new DebateActionError("duplicate-submission", "同一质询只能回应一次。");
  }
  next.responses.push(action.response);
  return next;
}

export async function finishDebateRound(
  state: DebateState,
  params: DebateParams,
  evaluator?: DebateJudgeEvaluator,
): Promise<DebateRoundResult> {
  requireQuorum(params.quorumSize);
  if (state.phase !== "ruling" && state.phase !== "response" && state.phase !== "challenge") {
    throw new DebateActionError("invalid-phase", "当前回合尚未进入裁判阶段。");
  }
  const currentRound = state.round;
  const proposals = state.proposals.filter(p => p.round === currentRound);
  const judges = makeJudges(params.quorumSize);
  const candidates: DebateCandidateResult[] = [];
  const nextScores = { ...state.scores };
  const nextRulings: DebateRuling[] = [];

  for (const proposal of proposals) {
    const challenges = state.challenges.filter(c => c.proposalId === proposal.id);
    const responses = state.responses.filter(r =>
      challenges.some(c => c.id === r.challengeId),
    );
    const ballots: DebateBallot[] = [];
    for (const judge of judges) {
      const decision = evaluator
        ? await evaluator({ judge, proposal, challenges, responses, round: currentRound })
        : localDecision({ judge, proposal, challenges, responses, round: currentRound });
      ballots.push({
        judgeIndex: judge.index,
        decision,
        reason: "依据结构化论据作出" + decisionLabel(decision) + "判定。",
      });
    }
    const counts = new Map<RulingDecision, number>();
    for (const ballot of ballots) {
      counts.set(ballot.decision, (counts.get(ballot.decision) ?? 0) + 1);
    }
    const rulingPriority: readonly RulingDecision[] = [
      "accept",
      "partial",
      "reject",
    ];
    const decision = [...rulingPriority].sort(
      (a: RulingDecision, b: RulingDecision) =>
        (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
    )[0];
    const ruling: DebateRuling = {
      proposalId: proposal.id,
      clauseId: proposal.clauseId,
      round: currentRound,
      decision,
      ballots,
      appliesFromRound: currentRound + 1,
      summary:
        "提案 " +
        proposal.id +
        "：" +
        decisionLabel(decision) +
        "；新规则自第 " +
        (currentRound + 1) +
        " 回合起生效。",
    };
    nextRulings.push(ruling);
    nextScores[proposal.seat] =
      (nextScores[proposal.seat] ?? 0) +
      (decision === "accept" ? params.scoreAccepted : params.scoreParticipated);
    candidates.push({
      proposalId: proposal.id,
      clauseId: proposal.clauseId,
      position: proposal.position,
      supportCount: ballots.filter(b => b.decision === "accept").length,
      challengeCount: challenges.length,
      ruling,
    });
  }

  const settled = currentRound >= params.rounds;
  Object.assign(state.scores, nextScores);
  state.rulings.push(...nextRulings);
  state.phase = settled ? "settled" : "proposal";
  if (!settled) state.round += 1;
  return {
    round: currentRound,
    candidates,
    scores: nextScores,
    nextRulebookVersion:
      state.rulebook.version +
      nextRulings.filter(r => r.decision !== "reject").length,
    settled,
  };
}

/**
 * 现有公共动作没有 debate 专用联合分支。此适配器只接受 JSON 结构化
 * speak，不把任意自然语言直接当作合法提案；未来应扩展 GameAction 并删除
 * 此适配器，改由 runtime 的 normalizeSubmission 直接接收 DebateAction。
 */
export function adaptPublicGameAction(action: GameAction): DebateAction | null {
  if (action.type !== "speak") return null;
  try {
    const parsed: unknown = JSON.parse(action.text);
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    return parsed as DebateAction;
  } catch {
    return null;
  }
}

export const debateModule: DebateTemplateModule = {
  template: "ruleDebate",
  gameKind: "rule-debate",
  recordKey: "ruleDebate",
  initMatchState: seats => {
    void seats;
    throw new DebateActionError(
      "missing-rulebook",
      "请使用 debate.data.ts 的规则书调用 createDebateState；公共 registry 接线尚未完成。",
    );
  },
  submit: submitDebateAction,
  finishRound: finishDebateRound,
};
