import { TRPCError } from "@trpc/server";
import type { GameAction } from "@contracts/room";
import type {
  BilliardsAbilityDecision,
  BilliardsAbilityId,
  BilliardsReveal,
  GameDefinition,
  SuperpowerBilliardsParams,
} from "@contracts/gameSdk";
import {
  BILLIARDS_ABILITIES,
  BILLIARDS_BALL_IDS,
  cloneBalls,
  round2,
  type BilliardsAbilityPayload,
  type BilliardsBallState,
  type BilliardsMatchState,
  type BilliardsPayload,
  type BilliardsStrikePayload,
} from "@contracts/superpowerBilliards";
import type { NormalizedSubmission, RoundEntry, SubmissionResult, TemplateModule } from "./templates";

const TABLE_W = 100;
const TABLE_H = 50;
const BALL_R = 2;
const POCKET_R = 4;
const STEPS = 40;
const DT = 0.16;
const FRICTION = 0.94;
const SPEED_THRESHOLD = 1.2;
const POCKETS = [
  { x: 0, y: 0 },
  { x: TABLE_W, y: 0 },
  { x: 0, y: TABLE_H },
  { x: TABLE_W, y: TABLE_H },
];

function paramsOf(def: GameDefinition): SuperpowerBilliardsParams {
  return def.params as SuperpowerBilliardsParams;
}

function ownBall(st: BilliardsMatchState, seat: number, ballId?: string): BilliardsBallState | undefined {
  const candidate = st.balls.find((ball) => ball.id === ballId);
  if (candidate?.ownerSeat === seat && candidate.lives > 0) return candidate;
  return st.balls.find((ball) => ball.ownerSeat === seat && ball.lives > 0);
}

function payloadResult(payload: BilliardsPayload): NormalizedSubmission {
  return { value: 0, payload };
}

function parsePayload(entry: RoundEntry): BilliardsPayload | null {
  const payload = entry.payload as Partial<BilliardsPayload> | undefined;
  if (!payload || (payload.kind !== "strike" && payload.kind !== "ability")) return null;
  return payload as BilliardsPayload;
}

function initialBalls(seats: number, lives: number): BilliardsBallState[] {
  return BILLIARDS_BALL_IDS.map((id, index) => ({
    id,
    ownerSeat: index % seats,
    x: 16 + (index % 3) * 30,
    y: 15 + Math.floor(index / 3) * 20,
    vx: 0,
    vy: 0,
    lives,
    pocketed: false,
    abilityId: (["return-soul", "right-angle", "phase-walk"] as BilliardsAbilityId[])[index % 3],
    lastHitBy: null,
    abilityUsedThisRound: false,
  }));
}

function aliveSeats(st: BilliardsMatchState): number[] {
  return st.alive.map((alive, seat) => (alive ? seat : -1)).filter((seat) => seat >= 0);
}

function resetForRound(st: BilliardsMatchState): void {
  for (const ball of st.balls) {
    ball.abilityUsedThisRound = false;
    ball.lastHitBy = null;
    ball.vx = 0;
    ball.vy = 0;
    if (ball.pocketed) {
      ball.pocketed = false;
      ball.x = 50 + (ball.ownerSeat % 3) * 4;
      ball.y = 25 + (Math.floor(ball.ownerSeat / 3) - 0.5) * 5;
    }
  }
}

export const superpowerBilliardsModule: TemplateModule = {
  template: "superpowerBilliards",
  gameKind: "billiards",
  recordKey: "superpowerBilliards",

  initMatchState(def, seatCount): BilliardsMatchState {
    const p = paramsOf(def);
    return {
      balls: initialBalls(seatCount, p.lives),
      abilityUses: Object.fromEntries(Array.from({ length: seatCount }, (_, seat) => [seat, {}])),
      combo: Object.fromEntries(Array.from({ length: seatCount }, (_, seat) => [seat, 0])),
      alive: Array.from({ length: seatCount }, () => true),
      lastStrikeSeat: null,
    };
  },

  normalizeSubmission(_def, _action: GameAction): number | null {
    return null;
  },

  normalizeStructuredSubmission(def, action: GameAction): SubmissionResult {
    if (action.type === "strike") {
      if (def.template !== "superpowerBilliards") return null;
      if (!Number.isFinite(action.angle) || !Number.isFinite(action.power) || action.power <= 0 || action.power > 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "击杆角度或力度不合法" });
      }
      const payload: BilliardsStrikePayload = {
        kind: "strike",
        phase: "strike",
        ballId: action.ballId,
        angle: action.angle,
        power: action.power,
      };
      return payloadResult(payload);
    }
    if (action.type === "ability") {
      if (def.template !== "superpowerBilliards" || !BILLIARDS_ABILITIES[action.abilityId]) return null;
      const payload: BilliardsAbilityPayload = {
        kind: "ability",
        phase: "ability",
        abilityId: action.abilityId,
        decision: action.decision,
        targetBall: action.targetBall,
      };
      return payloadResult(payload);
    }
    return null;
  },

  timeoutFallback(_def, _seatIndex): number {
    return 0;
  },

  timeoutFallbackStructured(def, seatIndex, phaseName): SubmissionResult {
    void def;
    if (phaseName === "ability") {
      return {
        value: 0,
        payload: {
          kind: "ability",
          phase: "ability",
          abilityId: "return-soul",
          decision: "ignore",
          targetBall: BILLIARDS_BALL_IDS[seatIndex % BILLIARDS_BALL_IDS.length],
        } satisfies BilliardsAbilityPayload,
      };
    }
    void def;
    return {
      value: 0,
      payload: {
        kind: "strike",
        phase: "strike",
        ballId: BILLIARDS_BALL_IDS[seatIndex % BILLIARDS_BALL_IDS.length],
        angle: 0,
        power: 0.45,
      } satisfies BilliardsStrikePayload,
    };
  },

  botPick(_def, _seatIndex, _levelK): number {
    return 0;
  },

  botPickStructured(def, seatIndex, levelK, _history, phaseName, matchState): SubmissionResult {
    void def;
    const st = matchState as BilliardsMatchState | null;
    if (phaseName === "ability") {
      const ball = st?.balls.find((candidate) => candidate.ownerSeat === seatIndex && candidate.lives > 0);
      const abilityId = ball?.abilityId ?? "return-soul";
      const decision: BilliardsAbilityDecision = abilityId === "return-soul" ? "reflect" : abilityId === "right-angle" ? "right_angle" : "phase_walk";
      return payloadResult({ kind: "ability", phase: "ability", abilityId, decision, targetBall: ball?.id ?? BILLIARDS_BALL_IDS[seatIndex % 6] });
    }
    const ball = st?.balls.find((candidate) => candidate.ownerSeat === seatIndex && candidate.lives > 0);
    return payloadResult({
      kind: "strike",
      phase: "strike",
      ballId: ball?.id ?? BILLIARDS_BALL_IDS[seatIndex % 6],
      angle: (seatIndex % 2 === 0 ? 0.14 : Math.PI - 0.14) + (levelK % 1) * 0.18,
      power: Math.min(0.92, 0.5 + levelK * 0.09),
    });
  },

  phasesForRound(_def, _round, matchState) {
    const st = matchState as BilliardsMatchState;
    const eligible = aliveSeats(st);
    return [
      { name: "strike", eligibleSeats: eligible },
      { name: "ability", eligibleSeats: eligible },
    ];
  },

  resolveRound(def, round, entries, matchState) {
    const p = paramsOf(def);
    const st = matchState as BilliardsMatchState;
    resetForRound(st);
    const strikes = entries.filter((entry) => entry.phase === "strike").map(parsePayload).filter((payload): payload is BilliardsStrikePayload => payload?.kind === "strike");
    const abilities = entries.filter((entry) => entry.phase === "ability").map(parsePayload).filter((payload): payload is BilliardsAbilityPayload => payload?.kind === "ability");
    const collisions: { a: string; b: string; step: number }[] = [];
    const pockets: BilliardsReveal["pockets"] = [];
    const wallHits = new Set<string>();
    const scoreDeltas: Record<number, number> = {};
    const comboBySeat: Record<number, number> = {};

    for (const strike of strikes) {
      const entry = entries.find((candidate) => candidate.payload === strike);
      const seat = entry?.seat ?? 0;
      const ball = ownBall(st, seat, strike.ballId);
      if (!ball) continue;
      st.lastStrikeSeat = seat;
      ball.vx = Math.cos(strike.angle) * strike.power * 4.8;
      ball.vy = Math.sin(strike.angle) * strike.power * 4.8;
      for (let step = 0; step < STEPS; step += 1) {
        for (const moving of st.balls) {
          if (moving.pocketed || (moving.vx === 0 && moving.vy === 0)) continue;
          moving.x += moving.vx * DT;
          moving.y += moving.vy * DT;
          if (moving.x <= BALL_R || moving.x >= TABLE_W - BALL_R) {
            moving.vx *= -1;
            moving.x = Math.max(BALL_R, Math.min(TABLE_W - BALL_R, moving.x));
            wallHits.add(moving.id);
          }
          if (moving.y <= BALL_R || moving.y >= TABLE_H - BALL_R) {
            moving.vy *= -1;
            moving.y = Math.max(BALL_R, Math.min(TABLE_H - BALL_R, moving.y));
            wallHits.add(moving.id);
          }
          const pocket = POCKETS.findIndex((point) => Math.hypot(moving.x - point.x, moving.y - point.y) <= POCKET_R);
          if (pocket >= 0) {
            moving.pocketed = true;
            moving.lives = Math.max(0, moving.lives - 1);
            const bySeat = moving.lastHitBy ?? seat;
            pockets.push({ ballId: moving.id, ownerSeat: moving.ownerSeat, bySeat, pocket });
            moving.vx = 0;
            moving.vy = 0;
          }
          moving.vx *= FRICTION;
          moving.vy *= FRICTION;
        }
        for (let i = 0; i < st.balls.length; i += 1) {
          const a = st.balls[i];
          if (a.pocketed) continue;
          for (let j = i + 1; j < st.balls.length; j += 1) {
            const b = st.balls[j];
            if (b.pocketed) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 0 && distance <= BALL_R * 2) {
              const nx = dx / distance;
              const ny = dy / distance;
              const impulse = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              a.vx -= impulse * nx;
              a.vy -= impulse * ny;
              b.vx += impulse * nx;
              b.vy += impulse * ny;
              b.lastHitBy = seat;
              collisions.push({ a: a.id, b: b.id, step });
            }
          }
        }
      }
    }

    for (const pocket of pockets) {
      scoreDeltas[pocket.ownerSeat] = (scoreDeltas[pocket.ownerSeat] ?? 0) - p.pocketPenalty;
      if (pocket.bySeat !== pocket.ownerSeat) {
        const combo = (st.combo[pocket.bySeat] ?? 0) + 1;
        st.combo[pocket.bySeat] = combo;
        comboBySeat[pocket.bySeat] = combo;
        scoreDeltas[pocket.bySeat] = (scoreDeltas[pocket.bySeat] ?? 0) + p.hitScore + (combo > 1 ? p.comboBonus : 0);
      }
    }

    const abilityResolutions: BilliardsReveal["abilities"] = [];
    for (const ability of abilities) {
      const entry = entries.find((candidate) => candidate.payload === ability);
      const seat = entry?.seat ?? -1;
      const target = st.balls.find((ball) => ball.id === ability.targetBall);
      const targetStrike = strikes.find((strike) => strike.ballId === ability.targetBall);
      const uses = seat >= 0 ? (st.abilityUses[seat]?.[ability.abilityId] ?? 0) : 1;
      let accepted = false;
      let reason = "能力提案不符合当前触发条件";
      if (!target) reason = "目标球不存在";
      else if (target.ownerSeat !== seat) reason = "只能操控自己的巫蛊娃娃";
      else if (target.abilityId !== ability.abilityId) reason = "目标球没有该能力";
      else if (uses >= 1) reason = "本局能力已使用";
      else if (ability.decision === "ignore") reason = "Agent 选择无视";
      else if (ability.abilityId === "return-soul" && target.lastHitBy !== null && ability.decision === "reflect") {
        target.vx *= -1;
        target.vy *= -1;
        accepted = true;
      } else if (ability.abilityId === "right-angle" && wallHits.has(target.id) && ability.decision === "right_angle") {
        const vx = target.vx;
        target.vx = -target.vy;
        target.vy = vx;
        accepted = true;
      } else if (
        ability.abilityId === "phase-walk" &&
        targetStrike &&
        targetStrike.power * 4.8 >= SPEED_THRESHOLD &&
        ability.decision === "phase_walk"
      ) {
        target.x = Math.max(BALL_R + 0.5, Math.min(TABLE_W - BALL_R - 0.5, target.x + target.vx * 2));
        target.y = Math.max(BALL_R + 0.5, Math.min(TABLE_H - BALL_R - 0.5, target.y + target.vy * 2));
        accepted = true;
      }
      if (accepted && seat >= 0) {
        st.abilityUses[seat] ??= {};
        st.abilityUses[seat][ability.abilityId] = 1;
        target!.abilityUsedThisRound = true;
        reason = `${BILLIARDS_ABILITIES[ability.abilityId].label} 已由内核执行`;
      }
      abilityResolutions.push({ seat, abilityId: ability.abilityId, decision: ability.decision, targetBall: ability.targetBall, accepted, reason });
    }

    for (const ball of st.balls) st.alive[ball.ownerSeat] = st.balls.some((candidate) => candidate.ownerSeat === ball.ownerSeat && candidate.lives > 0);
    const reveal: BilliardsReveal = {
      round,
      strikes: strikes.map((strike) => ({ seat: entries.find((entry) => entry.payload === strike)?.seat ?? -1, ballId: strike.ballId, angle: round2(strike.angle), power: round2(strike.power) })),
      collisions,
      pockets,
      abilities: abilityResolutions,
      comboBySeat,
      balls: cloneBalls(st.balls),
      scoreDeltas,
      aliveSeats: aliveSeats(st),
    };
    return { reveal, scoreDeltas, finished: aliveSeats(st).length <= 1 };
  },

  roundWinners(reveal: unknown): number[] {
    const result = reveal as BilliardsReveal;
    return Object.keys(result.comboBySeat).map(Number).filter((seat) => (result.scoreDeltas[seat] ?? 0) > 0);
  },
};
