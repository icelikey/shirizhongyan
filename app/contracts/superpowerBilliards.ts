/**
 * 超能力桌球共享数据。物理只使用整数步长与固定小数精度，保证服务端、
 * 回放和观战投影在同一份输入下得到相同结果。
 */
import type {
  BilliardsAbilityId,
  BilliardsAbilityDecision,
  BilliardsBallView,
  BilliardsReveal,
} from "./gameSdk";

export const BILLIARDS_TEMPLATE = "superpowerBilliards" as const;
export const BILLIARDS_BALL_IDS = ["doll-01", "doll-02", "doll-03", "doll-04", "doll-05", "doll-06"] as const;
export const BILLIARDS_ABILITIES: Record<BilliardsAbilityId, { label: string; trigger: string; description: string }> = {
  "return-soul": { label: "返魂", trigger: "首次被对方球碰撞", description: "将一次受击速度反向，保持速度总量。" },
  "right-angle": { label: "直角", trigger: "边界碰撞", description: "把运动方向旋转 90°，不增加速度。" },
  "phase-walk": { label: "穿界", trigger: "被击打且速度达到阈值", description: "沿当前运动方向跃迁到下一个合法轨迹点。" },
};

export interface BilliardsBallState extends BilliardsBallView {
  lastHitBy: number | null;
  abilityUsedThisRound: boolean;
}

export interface BilliardsMatchState {
  balls: BilliardsBallState[];
  abilityUses: Record<number, Partial<Record<BilliardsAbilityId, number>>>;
  combo: Record<number, number>;
  alive: boolean[];
  lastStrikeSeat: number | null;
}

export interface BilliardsStrikePayload {
  kind: "strike";
  phase: "strike";
  ballId: string;
  angle: number;
  power: number;
}

export interface BilliardsAbilityPayload {
  kind: "ability";
  phase: "ability";
  abilityId: BilliardsAbilityId;
  decision: BilliardsAbilityDecision;
  targetBall: string;
}

export type BilliardsPayload = BilliardsStrikePayload | BilliardsAbilityPayload;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function cloneBalls(balls: BilliardsBallState[]): BilliardsBallView[] {
  return balls.map(({ lastHitBy: _lastHitBy, abilityUsedThisRound: _abilityUsedThisRound, ...ball }) => ({
    ...ball,
    x: round2(ball.x),
    y: round2(ball.y),
    vx: round2(ball.vx),
    vy: round2(ball.vy),
  }));
}

export type { BilliardsAbilityId, BilliardsAbilityDecision, BilliardsBallView, BilliardsReveal };
