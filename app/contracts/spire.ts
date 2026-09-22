/**
 * ============================================================================
 * 智斗爬塔 · 层门契约（contracts/spire.ts）
 * ----------------------------------------------------------------------------
 * 塔不是难度阶梯，是谜题链：每层的门由一条「真相」守着，真相由残章卡拼出。
 * 卡在 A 层掉落、在 B 层才有用 —— 玩家必须回头刷低层凑碎片，
 * 由此产生留存，且完全不需要数值膨胀。
 *
 * 四个位阶段各 12 层，与十二生肖对齐（src/data/zodiac.ts）：
 *   1–12  黄阶  学会看      单花色残章组
 *   13–24 玄阶  学会骗      跨花色残章组
 *   25–36 地阶  学会读规则  判例卡（须质询成功过一次）
 *   37–48 天阶  学会改规则  自己创造的游戏通过审核
 *
 * 第 37–48 层把 UGC 从「附加编辑器」变成「主线终关」：
 * 玩家从解密者变成出题者，这是「世界观构筑平台」真正成立的地方。
 * ============================================================================
 */
import type { Suit } from "./gameSdk";
import type { Tier } from "./cards";

/** 每个位阶段的层数（= 十二生肖） */
export const FLOORS_PER_TIER = 12;
/** 主塔总层数 */
export const TOTAL_FLOORS = 48;

/* ------------------------------------------------------------------ */
/* 门禁条件                                                            */
/* ------------------------------------------------------------------ */

export type GateRequirement =
  /** 开放层：无门禁 */
  | { kind: "open" }
  /** 需集齐指定残章组（拼出真相） */
  | { kind: "relicSet"; setId: string }
  /** 需持有任意判例卡（即质询成功过） */
  | { kind: "anyRuling" }
  /** 需有一个通过审核并被收录的自创游戏 */
  | { kind: "authoredGame" }
  /** 需碎片（花色 → 数量） */
  | { kind: "fragments"; cost: Partial<Record<Suit, number>> };

export interface FloorDef {
  /** 层号 1–48 */
  floor: number;
  /** 所属位阶 */
  tier: Tier;
  /** 对应生肖索引 0–11 */
  zodiacIndex: number;
  /** 层名 */
  name: string;
  /** 主场花色（决定本层游戏与掉落花色） */
  suit: Suit;
  /** 进入门禁 */
  gate: GateRequirement;
  /** 本层使用的规则书 id */
  rulebookId: string;
  /** 是否层主层（每 12 层最后一层） */
  isBoss: boolean;
}

/** 层号 → 位阶 */
export function tierOfFloor(floor: number): Tier {
  const idx = Math.floor((floor - 1) / FLOORS_PER_TIER);
  const order: Tier[] = ["huang", "xuan", "di", "tian"];
  return order[Math.min(Math.max(idx, 0), order.length - 1)];
}

/** 层号 → 生肖索引 0–11 */
export function zodiacOfFloor(floor: number): number {
  return (floor - 1) % FLOORS_PER_TIER;
}

/** 是否层主层 */
export function isBossFloor(floor: number): boolean {
  return floor % FLOORS_PER_TIER === 0;
}

/* ------------------------------------------------------------------ */
/* 门禁判定                                                            */
/* ------------------------------------------------------------------ */

/** 判定门禁所需的玩家状态快照（只读） */
export interface GateContext {
  /** 已集齐的残章组 id */
  completedRelicSetIds: string[];
  /** 是否持有任意判例卡 */
  hasAnyRuling: boolean;
  /** 是否有被收录的自创游戏 */
  hasAuthoredGame: boolean;
  /** 当前碎片存量 */
  fragments: Record<Suit, number>;
}

export interface GateCheck {
  passed: boolean;
  /** 未通过时的提示（展示给玩家，带世界观语气） */
  hint: string;
}

export function checkGate(
  gate: GateRequirement,
  ctx: GateContext
): GateCheck {
  switch (gate.kind) {
    case "open":
      return { passed: true, hint: "" };

    case "relicSet": {
      const passed = ctx.completedRelicSetIds.includes(gate.setId);
      return {
        passed,
        hint: passed ? "" : "残章未齐，门上的字还读不通。",
      };
    }

    case "anyRuling":
      return {
        passed: ctx.hasAnyRuling,
        hint: ctx.hasAnyRuling
          ? ""
          : "此门只认判例。你须先在牌桌上驳倒一条规则。",
      };

    case "authoredGame":
      return {
        passed: ctx.hasAuthoredGame,
        hint: ctx.hasAuthoredGame
          ? ""
          : "门后是执笔之人的席位。你须先写出一局，并让它被世界收录。",
      };

    case "fragments": {
      const lacking = Object.entries(gate.cost).filter(
        ([suit, n]) => (ctx.fragments[suit as Suit] ?? 0) < (n ?? 0)
      );
      return {
        passed: lacking.length === 0,
        hint: lacking.length === 0 ? "" : "碎片不足，门环纹丝不动。",
      };
    }
  }
}
