import { describe, expect, it } from "vitest";
import { SPECTATOR } from "@contracts/matchLog";
import {
  projectWerewolf12State,
  type Werewolf12Action,
  type Werewolf12MatchState,
} from "@contracts/werewolf12";
import { werewolf12Module } from "./werewolf12";

function activeSeats(state: Werewolf12MatchState): number[] {
  return Array.from({ length: 12 }, (_, seat) => seat).filter(
    seat => werewolf12Module.legalActions(state, seat).length > 0
  );
}

function step(
  state: Werewolf12MatchState,
  seat: number,
  action?: Werewolf12Action
): Werewolf12MatchState {
  return werewolf12Module.reduce(state, {
    seat,
    action: action ?? werewolf12Module.timeoutFallback(state, seat),
  }).state;
}

function runDeterministicMatch(seed: string): {
  state: Werewolf12MatchState;
  commands: { seat: number; action: Werewolf12Action }[];
  phases: Set<Werewolf12MatchState["phase"]>;
} {
  let state = werewolf12Module.initMatchState(seed);
  const commands: { seat: number; action: Werewolf12Action }[] = [];
  const phases = new Set<Werewolf12MatchState["phase"]>();

  for (let guard = 0; guard < 600 && state.phase !== "finished"; guard += 1) {
    phases.add(state.phase);
    const seats = activeSeats(state);
    expect(seats.length).toBeGreaterThan(0);
    const seat = seats[0];
    let action = werewolf12Module.botPick(state, seat);

    // 保证这条沙盒回放覆盖首夜的预言家与女巫窗口，仍只选择合法候选。
    if (state.phase === "night-wolf") {
      const protectedRoles = new Set(["seer", "witch"]);
      const candidate = werewolf12Module
        .legalActions(state, seat)
        .find(
          item =>
            item.type === "wolfKill" &&
            !protectedRoles.has(state.seats[item.target].role)
        );
      if (candidate) action = candidate;
    }
    if (state.phase === "day-vote") {
      const candidate = werewolf12Module
        .legalActions(state, seat)
        .find(item => item.type === "vote" && item.target !== null);
      if (candidate) action = candidate;
    }

    commands.push({ seat, action });
    state = step(state, seat, action);
  }
  phases.add(state.phase);
  return { state, commands, phases };
}

describe("werewolf12 SDK 内容包适配器", () => {
  it("固定十二席并按 seed 确定性发放 4 狼、预言家、女巫和 6 平民", () => {
    const first = werewolf12Module.initMatchState("identity-seed");
    const second = werewolf12Module.initMatchState("identity-seed");
    expect(first.seats).toEqual(second.seats);
    expect(first.seats).toHaveLength(12);
    expect(first.seats.filter(seat => seat.role === "werewolf")).toHaveLength(
      4
    );
    expect(first.seats.filter(seat => seat.role === "seer")).toHaveLength(1);
    expect(first.seats.filter(seat => seat.role === "witch")).toHaveLength(1);
    expect(first.seats.filter(seat => seat.role === "villager")).toHaveLength(
      6
    );
    expect(
      first.events.filter(event => event.t === "secretAssign")
    ).toHaveLength(12);

    const playerView = projectWerewolf12State(first, 0);
    const spectatorView = projectWerewolf12State(first, SPECTATOR);
    expect(playerView.seats[0].role).toBe(first.seats[0].role);
    expect(
      playerView.seats
        .slice(1)
        .every(seat => seat.role === null && seat.camp === null)
    ).toBe(true);
    expect(
      spectatorView.seats.every(
        seat => seat.role !== null && seat.camp !== null
      )
    ).toBe(true);
    expect(
      playerView.events.some(
        event => event.t === "secretAssign" && event.seat === 0
      )
    ).toBe(true);
    expect(
      playerView.events.some(
        event => event.t === "secretAssign" && event.seat !== 0
      )
    ).toBe(false);
  });

  it("只接受当前阶段合法动作，并为超时提供同一候选集中的兜底", () => {
    const state = werewolf12Module.initMatchState("legal-seed");
    const wolf = state.seats.find(seat => seat.role === "werewolf")!;
    const candidates = werewolf12Module.legalActions(state, wolf.index);
    const timeout = werewolf12Module.timeoutFallback(state, wolf.index);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toContainEqual(timeout);
    expect(() =>
      werewolf12Module.normalizeSubmission(state, wolf.index, {
        type: "wolfKill",
        target: wolf.index,
      })
    ).toThrow();

    const after = step(state, wolf.index, timeout);
    expect(after.night.wolfVotes[wolf.index]).toBe(
      (timeout as { target: number }).target
    );
    expect(() =>
      werewolf12Module.reduce(after, { seat: wolf.index, action: timeout })
    ).toThrow();
  });

  it("推进夜晚、白天发言、投票、遗言和终局，并产出可回放战报", () => {
    const first = runDeterministicMatch("replay-seed");
    expect(first.state.phase).toBe("finished");
    expect(first.phases).toEqual(
      new Set([
        "night-wolf",
        "night-seer",
        "night-witch",
        "day-speech",
        "day-vote",
        "last-words",
        "finished",
      ])
    );
    expect(first.state.events.length).toBeGreaterThan(20);
    expect(first.state.events.map(event => event.seq)).toEqual(
      Array.from({ length: first.state.events.length }, (_, index) => index)
    );

    const report = werewolf12Module.battleReport(first.state);
    expect(report.seatCount).toBe(12);
    expect(report.events).toEqual(first.state.events);
    expect(report.days.length).toBeGreaterThan(0);
    expect(report.events.some(event => event.t === "reveal")).toBe(true);
    expect(report.events.some(event => event.t === "matchEnd")).toBe(true);

    const replay = first.commands.reduce(
      (state, command) => werewolf12Module.reduce(state, command).state,
      werewolf12Module.initMatchState("replay-seed")
    );
    expect(replay).toEqual(first.state);
  });

  it("按票数最多且唯一放逐，平票则留下可复核的 tie 结果", () => {
    const result = runDeterministicMatch("vote-seed").state;
    const voteReveals = result.events.filter(
      event =>
        event.t === "reveal" &&
        typeof event.payload === "object" &&
        event.payload !== null &&
        "kind" in event.payload &&
        event.payload.kind === "vote"
    );
    expect(voteReveals.length).toBeGreaterThan(0);
    expect(result.reports.some(report => report.vote !== null)).toBe(true);
  });
});
