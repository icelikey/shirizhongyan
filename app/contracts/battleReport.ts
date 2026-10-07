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

function actionLabel(kind: string): string {
  return ({
    pass: "停手",
    choose: "作出选择",
    submit: "提交方案",
    target: "指定目标",
    play: "出牌",
    fold: "弃权",
    raise: "加注",
  } satisfies Record<string, string>)[kind] ?? kind;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 把赛马模板的真实揭示载荷展开成可叙述的镜头事实。 */
function raceRevealFacts(payload: unknown, seats: Map<number, ReportParticipant>): string[] {
  const reveal = asRecord(payload);
  if (!reveal) return [];
  const facts: string[] = [];
  const effects = asArray(reveal.effects);
  for (const item of effects) {
    const effect = asRecord(item);
    if (!effect || typeof effect.seat !== "number") continue;
    const actor = nameOf(seats, effect.seat);
    const cardName = typeof effect.cardName === "string" ? effect.cardName : "未知牌面";
    const target = typeof effect.targetSeat === "number" ? `，目标是${nameOf(seats, effect.targetSeat)}` : "";
    const delta = typeof effect.delta === "number" ? effect.delta : 0;
    if (effect.applied === true) {
      const motion = delta > 0 ? `反推前进${delta}格` : delta < 0 ? `逼退${Math.abs(delta)}格` : "改变了局面的节奏";
      facts.push(`${actor}亮出「${cardName}」${target}，${motion}。`);
    } else {
      const blockedBy = typeof effect.blockedBy === "string" ? effect.blockedBy : "被规则边界截停";
      facts.push(`${actor}亮出「${cardName}」${target}，${blockedBy}。`);
    }
  }
  for (const item of asArray(reveal.tiles)) {
    const tile = asRecord(item);
    if (!tile || typeof tile.seat !== "number") continue;
    const note = typeof tile.note === "string" ? tile.note : "险地触发";
    facts.push(`${nameOf(seats, tile.seat)}踏入落点：${note}。`);
  }
  const highlights = asArray(reveal.highlights);
  for (const item of highlights) {
    const highlight = asRecord(item);
    if (!highlight) continue;
    const title = typeof highlight.title === "string" ? highlight.title : "局势异动";
    const note = typeof highlight.note === "string" ? highlight.note : "公开事件被标记为高光";
    facts.push(`高光镜头「${title}」：${note}。`);
  }
  const positions = asRecord(reveal.positions);
  if (positions) {
    const order = Object.entries(positions)
      .map(([seat, position]) => ({ seat: Number(seat), position: typeof position === "number" ? position : 0 }))
      .filter(item => Number.isInteger(item.seat))
      .sort((a, b) => b.position - a.position || a.seat - b.seat)
      .slice(0, 3)
      .map(item => `${nameOf(seats, item.seat)} ${item.position}格`);
    if (order.length) facts.push(`镜头拉高，前三位暂列：${order.join("、")}。`);
  }
  return facts.slice(0, 12);
}

/**
 * 赛马的兜底战报也要像一段可观看的镜头，而不是把事件逐条拼起来。
 * 这里的修辞只改变事实的呈现方式，实际牌名、位移、险地和排名仍来自同一份揭示。
 */
function raceCinematicLine(moment: ReportMoment): string {
  const facts = moment.facts.join(" ");
  const evidence = moment.evidenceSeqs.map(seq => `[E${seq}]`).join("");
  const roundImage = [
    "金壤的风从断碑之间切过，尘光把每一张牌的边缘照成冷刃；",
    "远处的符环骤然收紧，赛道像一条被惊醒的巨兽，连落脚点都开始改变；",
    "灰烬在半空停了一息，所有席位都在这短得不能撤回的停顿里押上下一步；",
    "终焉的光沿着赛道向前推，领先者的影子被拉长，落后者的退路也被照亮；",
  ][Math.max(0, (moment.round - 1) % 4)];
  let consequence = "局面没有立刻给出答案，真正的代价被推迟到下一轮。";
  if (facts.includes("反照") || facts.includes("反弹")) {
    consequence = "被瞄准的席位没有后退，反而借着来势把锋芒折回出牌者身上。";
  } else if (facts.includes("挡下") || facts.includes("御守")) {
    consequence = "这不是空过一招，而是把一次本该发生的损失压进了对手的记忆里。";
  } else if (facts.includes("逼退") || facts.includes("后退") || facts.includes("退")) {
    consequence = "一席被迫把已经赢来的距离交还给黑暗，前方的终点因此重新变得拥挤。";
  } else if (facts.includes("前进") || facts.includes("冲线")) {
    consequence = "短暂的领先被公开写进赛道，所有仍在握牌的席位都必须重新估算它。";
  }
  return `${roundImage}${facts} ${consequence} ${evidence}【事实】`;
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
        facts: [`动作：${actionLabel(event.kind)}${event.value === null ? "" : `，公开数值：${event.value}`}。`],
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
          ...raceRevealFacts(event.payload, seats),
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
    "文风要有压迫感、节奏和心理博弈，写出可被想象的光线、声音、距离变化和动作后果，但不能模仿任何具体作家或作品的句式。",
    "只使用事实提纲中的动作、策略卡、裁决和结果；心理活动只能写成‘推断’，并在句末标注证据编号。",
    "不要输出模型思维链，不要补写不存在的身份、秘密对话、动机、台词或数值。",
    "结构固定：标题；开局局势；按轮次推进的关键交锋；盘外招与反制；转折；终局；战后策略评语。每轮至少保留一个具体动作和一个可视化后果，避免流水账。",
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
  const isRace = brief.rulebookId?.includes("beast") ?? false;
  const title = `《终焉战报》· ${brief.mode} · ${brief.rulebookId ?? "未命名规则书"}`;
  const moments = brief.moments
    // 赛马的 action 事件只有通用 SDK 包装值，真正有观赏信息的牌名、目标、
    // 位移与险地都在同轮 reveal 中；去掉六席重复的包装行，战报才能保持小说节奏。
    .filter(moment => moment.kind !== "opening" && moment.kind !== "ending" && !(isRace && moment.kind === "commitment"))
    .map(moment => {
      const evidence = moment.evidenceSeqs.map(seq => `[E${seq}]`).join("");
      const facts = moment.facts.join(" ");
      const prefix = moment.kind === "reveal"
        ? `第${moment.round}轮揭晓时，`
        : moment.kind === "tactic"
          ? `第${moment.round}轮的盘外招中，`
          : `第${moment.round}轮，`;
      const image = moment.kind === "reveal"
        ? (brief.rulebookId?.includes("beast") ? raceCinematicLine(moment) : "赛道上的尘光、牌面与落点同时显形；")
        : moment.kind === "tactic"
          ? "真正的交锋从牌面之外切入，沉默本身也成为一种施压；"
          : "所有迟疑在这一刻失去退路，选择开始反过来定义选择者；";
      return moment.kind === "reveal"
        ? `${prefix}${image}`
        : `${prefix}${image}${moment.headline}。${facts} ${evidence}【事实】`;
    });
  const inferences = brief.strategyProfiles
    .flatMap(profile => profile.inferredSignals.map(signal =>
      `席位 ${nameOfSeat(profile.seat)} 的策略摘要显示：${signal.text} ${signal.evidenceSeqs.map(seq => `[E${seq}]`).join("")}【推断】`,
    ));
  const ending = brief.winnerSeat == null
    ? "终局没有留下唯一胜者，所有席位都把一部分答案带回了黑暗。"
    : `${nameOfSeat(brief.winnerSeat)} 收下终局，排名依次为 ${brief.rankings.map(nameOfSeat).join(" → ")}。`;

  const openingImage = brief.rulebookId?.includes("beast")
    ? "金壤边界没有观众席，只有被风削亮的石柱、尚未熄灭的符火，以及六道彼此试探的蹄声。起跑线像一道没有门扇的审判门，谁先踏过它，谁就先把自己暴露给所有对手。"
    : "终焉的灯影从牌桌边缘退开，留下规则、沉默和每一个不能撤回的选择。";
  const turning = brief.turningPoints
    .filter(moment => moment.kind === "tactic" || moment.kind === "ruling")
    .map(moment => `· ${moment.headline}：${moment.kind === "tactic" ? "牌面之外的手落下，局势先听见了声音，随后才看见结果。" : "规则像冷印一样压过争辩，所有人只能接受它留下的方向。"} ${moment.facts.join(" ")} ${moment.evidenceSeqs.map(seq => `[E${seq}]`).join("")}【事实】`);
  const strategySection = inferences.length > 0
    ? ["战后侧写：", ...inferences]
    : ["战后侧写：本局没有提交可公开的策略摘要，只能依据落牌、落点与结算结果复盘。"];

  return [
    title,
    "",
    "【入场】",
    openingImage,
    `规则门已经合拢。${brief.opening} 先手不代表领先，沉默也不代表没有下注。【事实】`,
    "",
    "【轮次推进】",
    ...(moments.length > 0 ? moments : ["事件流没有产生足够的中段镜头。"]),
    "",
    ...(turning.length > 0 ? ["【转折与反制】", ...turning, ""] : []),
    "【战术侧写】",
    ...strategySection,
    "",
    "【终局】",
    `当终点的光穿过尘幕，${ending} [E${brief.moments.at(-1)?.seq ?? 0}]【事实】`,
    "胜负在这里结束，选择却没有。每一张被打出的牌，都会成为下一层世界判断你的依据。",
    "",
    "注：战报中的【事实】来自已落库事件；【推断】只来自 Agent 主动提交的策略摘要，不还原隐藏思维链。",
  ].join("\n");
}
