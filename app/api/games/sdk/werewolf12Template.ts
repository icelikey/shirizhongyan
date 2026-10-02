/**
 * 月影村十二席狼人杀 → 通用 SdkRoom 的适配层。
 *
 * 狼人杀本体保留在 contracts/werewolf12.ts：身份、夜昼迁移、投票和
 * 战报都由确定性 reducer 决定。这里仅把通用 room action 翻译成白名单
 * 命令，并把 reducer 的新快照写回 runtime 持有的状态对象。
 */
import type { GameAction } from "@contracts/room";
import {
  legalWerewolf12Actions,
  normalizeWerewolf12Action,
  reduceWerewolf12,
  timeoutFallbackWerewolf12,
  createWerewolf12Match,
  projectWerewolf12State,
  type Werewolf12Action,
  type Werewolf12MatchState,
} from "@contracts/werewolf12";
import { SPECTATOR } from "@contracts/matchLog";
import type { RoundEntry, SubmissionResult, TemplateModule } from "./templates";

type WolfPayload = { kind: "werewolf12"; action: Werewolf12Action };

function parseTarget(value: string, prefix: string): number | null {
  if (!value.startsWith(prefix)) return null;
  const n = Number(value.slice(prefix.length));
  return Number.isInteger(n) && n >= 0 && n < 12 ? n : null;
}

function actionFromRoomAction(action: GameAction): Werewolf12Action | null {
  if (action.type === "speak") return { type: "speech", text: action.text };
  if (action.type !== "play") return null;
  const cardId = action.cardId.trim();
  const wolfKill = parseTarget(cardId, "wolf-kill-");
  if (wolfKill !== null) return { type: "wolfKill", target: wolfKill };
  const seerCheck = parseTarget(cardId, "seer-check-");
  if (seerCheck !== null) return { type: "seerCheck", target: seerCheck };
  const vote = cardId === "vote-abstain" ? null : parseTarget(cardId, "vote-");
  if (cardId === "vote-abstain" || vote !== null) return { type: "vote", target: vote };
  if (cardId === "witch-save") return { type: "witchAction", save: true, poison: null };
  const poison = parseTarget(cardId, "witch-poison-");
  if (poison !== null) return { type: "witchAction", save: false, poison };
  if (cardId === "witch-pass") return { type: "witchAction", save: false, poison: null };
  if (cardId === "pass") return { type: "pass" };
  if (cardId === "last-words") return { type: "lastWords", text: "我留下这段证言，供回放核对。" };
  return null;
}

function roomPayload(value: unknown): WolfPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WolfPayload>;
  if (candidate.kind !== "werewolf12" || !candidate.action || typeof candidate.action !== "object") return null;
  return { kind: "werewolf12", action: candidate.action as Werewolf12Action };
}

function withPhaseCompatibility(state: Werewolf12MatchState, action: Werewolf12Action): Werewolf12Action {
  // 通用 speak 没有暴露子阶段名；到了遗言阶段，按当前权威阶段转换。
  if (state.phase === "last-words" && action.type === "speech") {
    return { type: "lastWords", text: action.text };
  }
  return action;
}

function allSeats(): number[] {
  return Array.from({ length: 12 }, (_, index) => index);
}

export const werewolf12TemplateModule: TemplateModule = {
  template: "werewolf",
  gameKind: "werewolf",
  recordKey: "werewolf12",

  initMatchState(_def, seatCount, seed = "werewolf-12") {
    if (seatCount !== 12) throw new Error("werewolf 模板必须固定 12 席");
    return createWerewolf12Match(seed);
  },

  normalizeSubmission(_def, action: GameAction): number | null {
    return actionFromRoomAction(action) ? 0 : null;
  },

  normalizeStructuredSubmission(_def, action: GameAction): SubmissionResult {
    const parsed = actionFromRoomAction(action);
    if (!parsed) return null;
    return { value: 0, payload: { kind: "werewolf12", action: parsed } satisfies WolfPayload };
  },

  timeoutFallback(): number {
    return 0;
  },

  phasesForRound(_def, _round, matchState) {
    const state = matchState as Werewolf12MatchState;
    if (state.phase === "finished") return [];
    // 每个阶段都让 12 席进入窗口；无权行动者由 pass 兜底，
    // 这样夜间状态在同一轮内完成迁移，真实席位不会被客户端阶段猜测卡住。
    return [
      { name: "night-wolf", eligibleSeats: allSeats() },
      { name: "night-seer", eligibleSeats: allSeats() },
      { name: "night-witch", eligibleSeats: allSeats() },
      { name: "day-speech", eligibleSeats: allSeats() },
      { name: "day-vote", eligibleSeats: allSeats() },
      { name: "last-words", eligibleSeats: allSeats() },
    ];
  },

  botPickStructured(_def, seat, _levelK, _history, _phaseName, matchState): SubmissionResult {
    const state = matchState as Werewolf12MatchState;
    const phase = _phaseName ?? state.phase;
    // SdkRoom 在整轮揭晓前不会逐子阶段回写 matchState；用公开的
    // phaseName 生成候选，确保夜间预言家/女巫和白天发言不会全部收到 pass。
    if (phase === "day-speech") {
      const actor = state.seats[seat];
      const action: Werewolf12Action = actor?.alive
        ? { type: "speech", text: `第 ${state.day} 天，${seat + 1} 号位完成公开证言。` }
        : { type: "pass" };
      return { value: 0, payload: { kind: "werewolf12", action } satisfies WolfPayload };
    }
    const projected = { ...state, phase } as Werewolf12MatchState;
    const legal = legalWerewolf12Actions(projected, seat);
    let action = legal[0] ?? timeoutFallbackWerewolf12(projected, seat);
    if (action.type === "speech") action = { type: "speech", text: `第 ${state.day} 天，${seat + 1} 号位完成公开证言。` };
    if (action.type === "lastWords") action = { type: "lastWords", text: "我留下这段证言，供回放核对。" };
    return { value: 0, payload: { kind: "werewolf12", action } satisfies WolfPayload };
  },

  botPick(): number {
    return 0;
  },

  resolveRound(_def, _round, entries: RoundEntry[], matchState) {
    const holder = matchState as Werewolf12MatchState;
    let current = holder;
    const ordered = [...entries].sort((a, b) => a.order - b.order);
    for (const entry of ordered) {
      const payload = roomPayload(entry.payload);
      const requested = withPhaseCompatibility(current, payload?.action ?? { type: "pass" });
      let action = requested;
      try {
        action = normalizeWerewolf12Action(current, entry.seat, requested);
      } catch {
        action = timeoutFallbackWerewolf12(current, entry.seat);
      }
      try {
        current = reduceWerewolf12(current, { seat: entry.seat, action }).state;
      } catch {
        // 非当前阶段的旧窗口提交不改变事实；它只能留下 pass 结果。
      }
    }
    // 投票产生遗言席位发生在同一轮内，而通用 SdkRoom 预先生成各子阶段
    // 的 bot 动作，无法提前知道该席位。此处按 reducer 的事实状态补交一次，
    // 不增加任何分数或改写投票结果。
    if (current.phase === "last-words" && current.lastWordsSeat !== null) {
      try {
        current = reduceWerewolf12(current, {
          seat: current.lastWordsSeat,
          action: timeoutFallbackWerewolf12(current, current.lastWordsSeat),
        }).state;
      } catch {
        // 结算事实已完成时，遗言只是演出事件；失败不回滚胜负。
      }
    }
    Object.assign(holder, current);
    const report = projectWerewolf12State(current, SPECTATOR);
    const winners = current.winner
      ? current.seats.filter(seat => seat.camp === current.winner).map(seat => seat.index)
      : [];
    const scoreDeltas: Record<number, number> = {};
    for (const seat of winners) scoreDeltas[seat] = 2;
    return {
      reveal: { ...report, winningSeats: winners, events: current.events.slice(-64) },
      scoreDeltas,
      finished: current.phase === "finished",
    };
  },

  roundWinners(reveal: unknown): number[] {
    const candidate = reveal as { winningSeats?: number[] };
    return candidate.winningSeats ?? [];
  },
};
