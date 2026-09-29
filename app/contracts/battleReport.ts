/**
 * 《终焉的世界》Agent 对战战报契约。
 *
 * 战报不是第二套结算器：它只读取已完成的事件流和观赏集锦，先生成
 * 事实提纲，再交给叙事模型润色。任何心理活动都必须绑定证据或明确标为推断。
 */
import type { MatchEvent, MatchStartEvent, StrategyTraceEvent } from "./matchLog";
import type { MatchMode } from "./matchMode";
import type { Highlight } from "./spectacle";

export const BATTLE_REPORT_VERSION = 1 as const;

export type ReportMomentKind =
  | "opening"
  | "commitment"
  | "tactic"
  | "reveal"
  | "ruling"
  | "ending";

export interface ReportParticipant {
  seat: number;
  name: string;
  kind: MatchStartEvent["seats"][number]["kind"];
  echoId?: string;
}

export interface ReportMoment {
  seq: number;
  round: number;
  kind: ReportMomentKind;
  headline: string;
  facts: readonly string[];
  evidenceSeqs: readonly number[];
  seats: readonly number[];
}

export interface ReportInference {
  text: string;
  confidence: number;
  evidenceSeqs: readonly number[];
  source: "strategy-trace" | "event-derived";
}

export interface StrategyProfile {
  seat: number;
  confirmedSignals: readonly string[];
  inferredSignals: readonly ReportInference[];
}

export interface BattleReportBrief {
  version: typeof BATTLE_REPORT_VERSION;
  matchId: number | null;
  mode: MatchMode;
  rulebookId: string | null;
  participants: readonly ReportParticipant[];
  opening: string;
  moments: readonly ReportMoment[];
  turningPoints: readonly ReportMoment[];
  strategyProfiles: readonly StrategyProfile[];
  highlights: readonly Highlight[];
  rankings: readonly number[];
  winnerSeat: number | null;
  evidenceEventCount: number;
}

function participantMap(events: readonly MatchEvent[]): Map<number, ReportParticipant> {
  const start = events.find((event): event is MatchStartEvent => event.t === "matchStart");
  return new Map(
    (start?.seats ?? []).map(seat => [seat.index, {
      seat: seat.index,
      name: seat.name,
      kind: seat.kind,
      echoId: seat.echoId,
    } satisfies ReportParticipant]),
  );
}

function nameOf(seats: Map<number, ReportParticipant>, seat: number): string {
  return seats.get(seat)?.name ?? `第 ${seat + 1} 席`;
}

function eventRefs(events: readonly MatchEvent[]): number[] {
  return events.map(event => event.seq);
}

function traceToInference(trace: StrategyTraceEvent): ReportInference {
  const confidence = trace.risk === "low" ? 0.78 : trace.risk === "medium" ? 0.62 : 0.46;
  return {
    text: `${trace.hypothesis}；选择「${trace.chosenLabel}」时承担${trace.risk === "high" ? "高" : trace.risk === "medium" ? "中" : "低"}风险。`,
    confidence,
    evidenceSeqs: trace.evidenceSeqs,
    source: "strategy-trace",
  };
}

function buildMoment(
  event: MatchEvent,
  seats: Map<number, ReportParticipant>,
): ReportMoment | null {
  switch (event.t) {
    case "matchStart":
      return {
        seq: event.seq,
        round: event.round,
        kind: "opening",
        headline: "牌局落门",
        facts: [`规则书 ${event.rulebookId} 锁定，${event.seats.length} 个席位进入同一终焉域。`],
        evidenceSeqs: [event.seq],
        seats: event.seats.map(seat => seat.index),
      };
    case "action":
      return {
        seq: event.seq,
        round: event.round,
        kind: "commitment",
        headline: `${nameOf(seats, event.seat)} 落下选择`,
        facts: [`动作类型：${event.kind}${event.value === null ? "" : `，公开数值：${event.value}`}。`],
        evidenceSeqs: [event.seq],
        seats: [event.seat],
      };
    case "tactic":
      return {
        seq: event.seq,
        round: event.round,
        kind: "tactic",
        headline: `${nameOf(seats, event.seat)} 祭出盘外招「${event.cardId}」`,
        facts: [
          `规则钩子：${event.ruleHook}。`,
          `结果：${event.resolution}${event.counteredBySeat === null ? "" : `，由 ${nameOf(seats, event.counteredBySeat)} 反制`}。`,
          event.reason,
        ],
        evidenceSeqs: [event.seq],
        seats: [event.seat, ...(event.targetSeat === null ? [] : [event.targetSeat]), ...(event.counteredBySeat === null ? [] : [event.counteredBySeat])],
      };
    case "reveal":
      return {
        seq: event.seq,
        round: event.round,
        kind: "reveal",
        headline: event.winnerSeats.length ? `第 ${event.round} 轮揭晓` : `第 ${event.round} 轮没有赢家`,
        facts: [
          event.winnerSeats.length
            ? `本轮获胜席位：${event.winnerSeats.map(seat => nameOf(seats, seat)).join("、")}。`
            : "本轮未产生获胜席位。",
        ],
        evidenceSeqs: [event.seq],
        seats: event.winnerSeats,
      };
    case "ruling":
      return {
        seq: event.seq,
        round: event.round,
        kind: "ruling",
        headline: event.upheld ? "判例落印" : "质询被驳回",
        facts: [`条款 ${event.clauseId} 的质询${event.upheld ? "成立" : "未成立"}，裁判票：${event.judgeVotes.map(vote => vote ? "赞成" : "反对").join(" / ")}。`],
        evidenceSeqs: [event.seq],
        seats: [event.appellantSeat],
      };
    case "matchEnd":
      return {
        seq: event.seq,
        round: event.round,
        kind: "ending",
        headline: event.winnerSeat === null ? "终局无单一胜者" : `${nameOf(seats, event.winnerSeat)} 收下终局`,
        facts: [`最终排名：${event.rankings.map(seat => nameOf(seats, seat)).join(" → ")}。`],
        evidenceSeqs: [event.seq],
        seats: event.rankings,
      };
    default:
      return null;
  }
}

function confirmedSignals(events: readonly MatchEvent[], seat: number): string[] {
  const own = events.filter(event => "seat" in event && event.seat === seat);
  const signals: string[] = [];
  const tacticCount = own.filter(event => event.t === "tactic").length;
  const appealCount = own.filter(event => event.t === "appeal").length;
  const speechCount = own.filter(event => event.t === "speech").length;
  if (tacticCount >= 2) signals.push("频繁使用盘外招");
  if (appealCount > 0) signals.push("主动质询规则");
  if (speechCount >= 2) signals.push("依靠公开话语施压");
  if (own.some(event => event.t === "strategyTrace")) signals.push("留下结构化策略摘要");
  return signals;
}

/** 由真实事件流构建战报事实提纲。 */
export function buildBattleReportBrief(input: {
  events: readonly MatchEvent[];
  mode: MatchMode;
  matchId?: number | null;
  highlights?: readonly Highlight[];
}): BattleReportBrief {
  const seats = participantMap(input.events);
  const moments = input.events
    .map(event => buildMoment(event, seats))
    .filter((moment): moment is ReportMoment => moment !== null);
  const end = input.events.find((event): event is Extract<MatchEvent, { t: "matchEnd" }> => event.t === "matchEnd");
  const traces = input.events.filter((event): event is StrategyTraceEvent => event.t === "strategyTrace");
  const seatIds = [...seats.keys()];
  const profiles = seatIds.map(seat => ({
    seat,
    confirmedSignals: confirmedSignals(input.events, seat),
    inferredSignals: traces.filter(trace => trace.seat === seat).map(traceToInference),
  }));
  const turningPoints = moments.filter(moment =>
    moment.kind === "tactic" || moment.kind === "ruling" || moment.kind === "ending",
  );
  const start = input.events.find((event): event is MatchStartEvent => event.t === "matchStart");

  return {
    version: BATTLE_REPORT_VERSION,
    matchId: input.matchId ?? null,
    mode: input.mode,
    rulebookId: start?.rulebookId ?? null,
    participants: [...seats.values()],
    opening: `${start?.seats.length ?? seats.size} 个席位在规则书 ${start?.rulebookId ?? "未命名"} 下同时入局。`,
    moments,
    turningPoints,
    strategyProfiles: profiles,
    highlights: [...(input.highlights ?? [])],
    rankings: end?.rankings ?? [],
    winnerSeat: end?.winnerSeat ?? null,
    evidenceEventCount: input.events.length,
  };
}

/**
 * 生成给叙事模型的约束提示词。模型只负责文风和段落组织，不能补写事实。
 */
export function buildBattleReportPrompt(brief: BattleReportBrief): string {
  const evidence = brief.moments
    .map(moment => `[${moment.evidenceSeqs.map(seq => `E${seq}`).join(",")}] ${moment.headline}：${moment.facts.join(" ")}`)
    .join("\n");
  const inferences = brief.strategyProfiles
    .flatMap(profile => profile.inferredSignals.map(signal => `席位 ${profile.seat} [${signal.evidenceSeqs.map(seq => `E${seq}`).join(",")}] ${signal.text}`))
    .join("\n") || "暂无 Agent 策略摘要，只能根据公开动作做有限推断。";

  return [
    "你是《终焉的世界》的观战解说者。请把下面的事实提纲写成原创的智斗纪实战报。",
    "文风要有压迫感、节奏和心理博弈，但不能模仿任何具体作家或作品的句式。",
    "只使用事实提纲中的动作、策略卡、裁决和结果；心理活动只能写成‘推断’，并在句末标注证据编号。",
    "不要输出模型思维链，不要补写不存在的身份、秘密对话、动机、台词或数值。",
    "结构固定：标题；开局局势；按轮次推进的关键交锋；盘外招与反制；转折；终局；战后策略评语。",
    `对局模式：${brief.mode}；规则书：${brief.rulebookId ?? "未知"}；事件数：${brief.evidenceEventCount}。`,
    "\n【已确认事件】\n" + (evidence || "无"),
    "\n【允许使用的策略推断】\n" + inferences,
    "\n每一段尽量绑定 [E数字] 证据编号，最后附‘事实 / 推断’标记。",
  ].join("\n");
}

/**
 * 不依赖外部模型的证据绑定战报。它是线上兜底输出，也是把提纲交给
 * 叙事模型前的可审计版本；模型不可用时玩家仍然能拿到完整战报。
 */
export function renderBattleReportText(brief: BattleReportBrief): string {
  const names = new Map(brief.participants.map(participant => [participant.seat, participant.name]));
  const nameOfSeat = (seat: number) => names.get(seat) ?? `第 ${seat + 1} 席`;
  const title = `《终焉战报》· ${brief.mode} · ${brief.rulebookId ?? "未命名规则书"}`;
  const moments = brief.moments
    .filter(moment => moment.kind !== "opening" && moment.kind !== "ending")
    .map(moment => {
      const evidence = moment.evidenceSeqs.map(seq => `[E${seq}]`).join("");
      const facts = moment.facts.join(" ");
      if (moment.kind === "tactic") {
        return `第${moment.round}轮，${moment.headline}。${facts} ${evidence}【事实】`;
      }
      return `第${moment.round}轮，${moment.headline}：${facts} ${evidence}【事实】`;
    });
  const inferences = brief.strategyProfiles
    .flatMap(profile => profile.inferredSignals.map(signal =>
      `席位 ${nameOfSeat(profile.seat)} 的策略摘要显示：${signal.text} ${signal.evidenceSeqs.map(seq => `[E${seq}]`).join("")}【推断】`,
    ));
  const ending = brief.winnerSeat == null
    ? "终局没有留下唯一胜者，所有席位都把一部分答案带回了黑暗。"
    : `${nameOfSeat(brief.winnerSeat)} 收下终局，排名依次为 ${brief.rankings.map(nameOfSeat).join(" → ")}。`;

  return [
    title,
    "",
    `开局：${brief.opening}`,
    "",
    ...(moments.length > 0 ? moments : ["对局没有产生可供叙述的中段事件。"]),
    "",
    ...(inferences.length > 0 ? ["战术侧写：", ...inferences, ""] : ["战术侧写：本局没有提交可公开的策略摘要。", ""]),
    `终局：${ending} [E${brief.moments.at(-1)?.seq ?? 0}]【事实】`,
    "",
    "注：战报中的【事实】来自对局事件流；【推断】只来自 Agent 主动提交的策略摘要，不还原隐藏思维链。",
  ].join("\n");
}
