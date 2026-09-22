/**
 * ============================================================================
 * 彩蛋判定器（api/world/eggs.ts）
 * ----------------------------------------------------------------------------
 * 纯函数：吃 MatchEvent[] 事件流，吐出触发的彩蛋。零额外算法——
 * 全部条件都能由事件流直接判定，这也是为什么 match_logs 必须先落地。
 *
 * 彩蛋卡是「不可刷」的稀有度来源：常规获胜给常见残章，彩蛋给珍稀卡，
 * 规则质询成功给判例卡（唯一）。三种途径对应三种玩家动机。
 *
 * 判定在全知事件流上进行（服务端结算时机），因此可以读 secret 事件。
 * ============================================================================
 */
import type {
  MatchEvent,
  MatchStartEvent,
  MatchEndEvent,
  SecretAssignEvent,
  SpeechEvent,
  ActionEvent,
  RulingEvent,
} from "@contracts/matchLog";

/** 一次彩蛋触发 */
export interface EggHit {
  eggId: string;
  /** 触发者座位 */
  seat: number;
  /** 奖励的卡牌 id */
  cardId: string;
  /** 积分加成 */
  score: number;
  /** 展示文案（结算浮层） */
  label: string;
}

export interface EggDef {
  id: string;
  name: string;
  cardId: string;
  score: number;
  /** 判定：返回触发的座位列表（空 = 未触发） */
  detect(ctx: EggContext): number[];
}

/* ------------------------------------------------------------------ */
/* 判定上下文：把事件流预先索引，避免每个彩蛋重复遍历                      */
/* ------------------------------------------------------------------ */

export interface EggContext {
  events: readonly MatchEvent[];
  start: MatchStartEvent | null;
  end: MatchEndEvent | null;
  /** 座位 → 密态身份值 */
  secretBySeat: Map<number, string>;
  /** 座位 → 该座位的发言 */
  speechesBySeat: Map<number, SpeechEvent[]>;
  /** 座位 → 该座位的动作 */
  actionsBySeat: Map<number, ActionEvent[]>;
  rulings: RulingEvent[];
  /** 名次第一的座位（无则 null） */
  winnerSeat: number | null;
  /** 座位 → 碎片净收益 */
  fragmentsDelta: Record<number, number>;
}

export function buildEggContext(events: readonly MatchEvent[]): EggContext {
  const ctx: EggContext = {
    events,
    start: null,
    end: null,
    secretBySeat: new Map(),
    speechesBySeat: new Map(),
    actionsBySeat: new Map(),
    rulings: [],
    winnerSeat: null,
    fragmentsDelta: {},
  };

  for (const e of events) {
    switch (e.t) {
      case "matchStart":
        ctx.start = e;
        break;
      case "matchEnd":
        ctx.end = e;
        ctx.winnerSeat = e.winnerSeat;
        ctx.fragmentsDelta = e.fragmentsDelta;
        break;
      case "secretAssign":
        ctx.secretBySeat.set((e as SecretAssignEvent).seat, e.value);
        break;
      case "speech": {
        const list = ctx.speechesBySeat.get(e.seat) ?? [];
        list.push(e);
        ctx.speechesBySeat.set(e.seat, list);
        break;
      }
      case "action": {
        const list = ctx.actionsBySeat.get(e.seat) ?? [];
        list.push(e);
        ctx.actionsBySeat.set(e.seat, list);
        break;
      }
      case "ruling":
        ctx.rulings.push(e);
        break;
      default:
        break;
    }
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* 彩蛋定义                                                            */
/* ------------------------------------------------------------------ */

/** 有实质内容的发言（划水与过麦不计） */
function isSubstantive(s: SpeechEvent): boolean {
  return s.intent !== "pass";
}

export const EGGS: EggDef[] = [
  {
    /** 守拙之证：全场零实质发言仍然获胜（呼应老龟人设） */
    id: "egg-silent-victory",
    name: "守拙之证",
    cardId: "r-club-06",
    score: 40,
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const mine = ctx.speechesBySeat.get(ctx.winnerSeat) ?? [];
      if (mine.some(isSubstantive)) return [];
      // 必须确实存在发言环节，否则纯数字游戏人人都中
      const anySpeech = [...ctx.speechesBySeat.values()].some(list =>
        list.some(isSubstantive)
      );
      return anySpeech ? [ctx.winnerSeat] : [];
    },
  },
  {
    /** 讹兽之舌：悍跳神职且从未被投出，且己方获胜 */
    id: "egg-unpunished-bluff",
    name: "讹兽之舌",
    cardId: "r-spade-03",
    score: 60,
    detect(ctx) {
      const hits: number[] = [];
      for (const [seat, speeches] of ctx.speechesBySeat) {
        const realRole = ctx.secretBySeat.get(seat);
        if (!realRole) continue;
        // 声称了一个与真实身份不符的角色 = 悍跳
        const bluffed = speeches.some(
          s => s.claimedRole !== null && s.claimedRole !== realRole
        );
        if (!bluffed) continue;
        const votedOut = ctx.events.some(
          e => e.t === "eliminate" && e.seat === seat && e.reason === "vote"
        );
        if (votedOut) continue;
        if (ctx.winnerSeat === seat) hits.push(seat);
      }
      return hits;
    },
  },
  {
    /** 璇玑算珠：每一轮提交都落在 level-3 锚点附近（50×(2/3)^3 ≈ 14.8） */
    id: "egg-level3-precision",
    name: "璇玑算珠",
    cardId: "r-club-04",
    score: 50,
    detect(ctx) {
      const ANCHOR = 50 * Math.pow(2 / 3, 3);
      const hits: number[] = [];
      for (const [seat, actions] of ctx.actionsBySeat) {
        const submits = actions.filter(
          a => a.kind === "submit" && a.value !== null
        );
        if (submits.length < 5) continue;
        const allNear = submits.every(
          a => Math.abs((a.value as number) - ANCHOR) <= 1.5
        );
        if (allNear) hits.push(seat);
      }
      return hits;
    },
  },
  {
    /** 以贱破贵：E-card 用奴隶牌击败皇帝 */
    id: "egg-slave-beats-emperor",
    name: "以贱破贵",
    cardId: "r-heart-03",
    score: 70,
    detect(ctx) {
      const hits = new Set<number>();
      for (const e of ctx.events) {
        if (e.t !== "reveal") continue;
        const p = e.payload as
          | { slaveSeat?: number; emperorSeat?: number; winnerSeat?: number }
          | undefined;
        if (!p || p.slaveSeat === undefined || p.emperorSeat === undefined) {
          continue;
        }
        if (p.winnerSeat === p.slaveSeat) hits.add(p.slaveSeat);
      }
      return [...hits];
    },
  },
  {
    /** 烛阴账本：输掉对局但碎片净收益为正 */
    id: "egg-profit-in-defeat",
    name: "烛阴账本",
    cardId: "r-diamond-03",
    score: 45,
    detect(ctx) {
      if (!ctx.end) return [];
      const hits: number[] = [];
      for (const [seatStr, delta] of Object.entries(ctx.fragmentsDelta)) {
        const seat = Number(seatStr);
        if (seat === ctx.winnerSeat) continue;
        if (delta > 0) hits.push(seat);
      }
      return hits;
    },
  },
  {
    /** 环环皆锁：规则质询被采纳（最高稀有度，另铸判例卡） */
    id: "egg-appeal-upheld",
    name: "驳律者",
    cardId: "r-diamond-07",
    score: 120,
    detect(ctx) {
      return ctx.rulings.filter(r => r.upheld).map(r => r.appellantSeat);
    },
  },
];

/* ------------------------------------------------------------------ */
/* 入口                                                               */
/* ------------------------------------------------------------------ */

const eggById = new Map(EGGS.map(e => [e.id, e]));

export function getEgg(id: string): EggDef | undefined {
  return eggById.get(id);
}

/**
 * 判定一局的全部彩蛋。传入全知事件流（服务端结算时机）。
 * 同一彩蛋可命中多座（如「烛阴账本」），返回逐座位的命中列表。
 */
export function detectEggs(events: readonly MatchEvent[]): EggHit[] {
  const ctx = buildEggContext(events);
  if (!ctx.start) return [];
  const hits: EggHit[] = [];
  for (const egg of EGGS) {
    for (const seat of egg.detect(ctx)) {
      hits.push({
        eggId: egg.id,
        seat,
        cardId: egg.cardId,
        score: egg.score,
        label: egg.name,
      });
    }
  }
  return hits;
}
