/**
 * ============================================================================
 * 残章卡数据（contracts/relics.ts）
 * ----------------------------------------------------------------------------
 * 全部正文切自 src/data/lore.ts 十卷残章，一字未改，只做切片与归组。
 * 十卷长文留在 /lore 给愿意细读的人；牌桌上掉落的是单句，
 * 因为世界观要从对局里长出来，不能靠「读」来传达。
 *
 * 组织方式：
 * - 每张卡 = 一句残章 + 出处卷序 + 所属拼图组
 * - 每组 4 张，拼齐后显现 truth（塔门口令）
 * - 按花色归大陆：♠ 玄渊 / ♥ 丹丘 / ♣ 青野 / ♦ 金壤
 * ============================================================================
 */
import type { RelicCard, RelicSet } from "./cards";

/** 构造残章卡的内部辅助（减少重复字面量） */
function relic(
  id: string,
  name: string,
  suit: RelicCard["suit"],
  volumeId: number,
  setId: string,
  setIndex: number,
  text: string,
  rarity: RelicCard["rarity"] = "common"
): RelicCard {
  return {
    id,
    name,
    kind: "relic",
    rarity,
    suit,
    text,
    volumeId,
    setId,
    setIndex,
  };
}

/* ==================================================================== */
/* ♠ 玄渊 · 欺骗                                                        */
/* ==================================================================== */

/** 组一：破绽（卷肆 玄渊之夜） */
const SET_SPADE_FLAW: RelicCard[] = [
  relic(
    "r-spade-01",
    "黑桃巨月",
    "spade",
    4,
    "set-spade-flaw",
    0,
    "一轮黑桃形状的巨月低垂，把每个人的影子都照得像在说谎。"
  ),
  relic(
    "r-spade-02",
    "藏牌",
    "spade",
    4,
    "set-spade-flaw",
    1,
    "玄渊人不说「欺骗」，他们说「藏牌」——把真话藏在假话里，把刀藏在目光里，把自己藏在所有人里面。"
  ),
  relic(
    "r-spade-03",
    "演给谁看",
    "spade",
    4,
    "set-spade-flaw",
    2,
    "所有人都在演，区别在于，有人演给别人看，有人演给自己看。",
    "rare"
  ),
  relic(
    "r-spade-04",
    "第一个词",
    "spade",
    4,
    "set-spade-flaw",
    3,
    "玄渊的孩子满月时，长辈会抱着他来这里看一眼——教他认得的第一个词，是「破绽」。"
  ),
];

/** 组二：无字碑（卷肆 + 卷贰） */
const SET_SPADE_STELE: RelicCard[] = [
  relic(
    "r-spade-05",
    "无字碑",
    "spade",
    4,
    "set-spade-stele",
    0,
    "峡谷深处有一座无字碑，碑前供着一副牌。"
  ),
  relic(
    "r-spade-06",
    "第一个放逐者",
    "spade",
    4,
    "set-spade-stele",
    1,
    "传说那是第一个被放逐的狼人留下的，牌面已经被雾气浸得模糊。"
  ),
  relic(
    "r-spade-07",
    "最昂贵之物",
    "spade",
    4,
    "set-spade-stele",
    2,
    "在玄渊，最昂贵的不是胜利，是信任。"
  ),
  relic(
    "r-spade-08",
    "七日七夜",
    "spade",
    4,
    "set-spade-stele",
    3,
    "白泽曾在这里连坐七日七夜，听遍了三百种说谎的语气。",
    "rare"
  ),
];

/* ==================================================================== */
/* ♣ 青野 · 计算                                                        */
/* ==================================================================== */

/** 组一：井底之数（卷伍 青野之算） */
const SET_CLUB_WELL: RelicCard[] = [
  relic(
    "r-club-01",
    "算庭",
    "club",
    5,
    "set-club-well",
    0,
    "青野没有城墙，只有一望无际的算庭。"
  ),
  relic(
    "r-club-02",
    "低声演算",
    "club",
    5,
    "set-club-well",
    1,
    "巨石的算珠悬浮在极光下，风一吹，亿万颗珠子同时轻响，像整片大陆在低声演算。"
  ),
  relic(
    "r-club-03",
    "尚未刻度的尺",
    "club",
    5,
    "set-club-well",
    2,
    "人心看似深不可测，也不过是还没找到刻度的尺子。"
  ),
  relic(
    "r-club-04",
    "井底的答案",
    "club",
    5,
    "set-club-well",
    3,
    "每深一层，数字就低一截，而井底那个终极的答案，是零，也是人心。",
    "rare"
  ),
];

/** 组二：站得稳（卷伍 + 卷捌） */
const SET_CLUB_STEADY: RelicCard[] = [
  relic(
    "r-club-05",
    "一百日",
    "club",
    5,
    "set-club-steady",
    0,
    "璇玑曾在算庭中央坐了一百日。"
  ),
  relic(
    "r-club-06",
    "第一层",
    "club",
    5,
    "set-club-steady",
    1,
    "老龟棋师一辈子站在第一层，等那些算到第五层的人自己摔下来。"
  ),
  relic(
    "r-club-07",
    "两派争论",
    "club",
    5,
    "set-club-steady",
    2,
    "算得深，与站得稳，究竟哪一个更接近这个游戏的真相。"
  ),
  relic(
    "r-club-08",
    "输在哪里",
    "club",
    5,
    "set-club-steady",
    3,
    "升阶之后，牌局会变得容易吗？——不会。只是你输的时候，会更明白自己输在哪里。",
    "rare"
  ),
];

/* ==================================================================== */
/* ♥ 丹丘 · 心理                                                        */
/* ==================================================================== */

/** 组一：一盏茶（卷陆 丹丘之约） */
const SET_HEART_TEA: RelicCard[] = [
  relic(
    "r-heart-01",
    "有温度的雾",
    "heart",
    6,
    "set-heart-tea",
    0,
    "丹丘的雾是有温度的。"
  ),
  relic(
    "r-heart-02",
    "茶凉了还续",
    "heart",
    6,
    "set-heart-tea",
    1,
    "丹丘人结盟不用纸笔，用一盏茶：茶凉了还续，是盟约未断；茶满而不再斟，是散场的信号。"
  ),
  relic(
    "r-heart-03",
    "先动心者输",
    "heart",
    6,
    "set-heart-tea",
    2,
    "青囊的药箱里据说收着三百种「读心」的方子，最贵的一味，叫「先动心者输」。",
    "rare"
  ),
  relic(
    "r-heart-04",
    "同一件事的两面",
    "heart",
    6,
    "set-heart-tea",
    3,
    "残忍与温柔，在丹丘是同一件事的两面。"
  ),
];

/** 组二：演完最后一场（卷陆 + 卷叁） */
const SET_HEART_ENCORE: RelicCard[] = [
  relic(
    "r-heart-05",
    "心跳里的杂音",
    "heart",
    6,
    "set-heart-encore",
    0,
    "九尾的狐火能照见人心跳里的杂音，她却很少说破。"
  ),
  relic(
    "r-heart-06",
    "陪他演完",
    "heart",
    6,
    "set-heart-encore",
    1,
    "丹丘的规矩是，看穿一个人之后，要陪他演完最后一场。"
  ),
  relic(
    "r-heart-07",
    "不可以替你后悔",
    "heart",
    3,
    "set-heart-encore",
    2,
    "影从可以代你上阵，可以替你记牌，唯独不可以替你后悔。",
    "rare"
  ),
  relic(
    "r-heart-08",
    "什么都记得",
    "heart",
    3,
    "set-heart-encore",
    3,
    "十日之后世界重启，你会忘记很多事——而他们，什么都记得。"
  ),
];

/* ==================================================================== */
/* ♦ 金壤 · 资源                                                        */
/* ==================================================================== */

/** 组一：万物有价（卷柒 金壤之赌） */
const SET_DIAMOND_PRICE: RelicCard[] = [
  relic(
    "r-diamond-01",
    "金色的河",
    "diamond",
    7,
    "set-diamond-price",
    0,
    "金壤的河是金色的。连空气里都浮着细碎的金尘，吸一口，野心就重一分。"
  ),
  relic(
    "r-diamond-02",
    "同一杆秤",
    "diamond",
    7,
    "set-diamond-price",
    1,
    "金壤人衡量一切用同一杆秤：门票、筹码、情报、人心，万物有价。"
  ),
  relic(
    "r-diamond-03",
    "不得不上桌",
    "diamond",
    7,
    "set-diamond-price",
    2,
    "真正的富有不是拥有筹码，是拥有让别人不得不上桌的东西。",
    "rare"
  ),
  relic(
    "r-diamond-04",
    "第二课的价格",
    "diamond",
    7,
    "set-diamond-price",
    3,
    "金壤的第一课永远免费，第二课的价格，是你全部的家当。"
  ),
];

/** 组二：环环皆锁（卷柒 + 卷贰） */
const SET_DIAMOND_LOCK: RelicCard[] = [
  relic(
    "r-diamond-05",
    "封条",
    "diamond",
    7,
    "set-diamond-lock",
    0,
    "巨石阵上贴着封条：「金价未稳，开埠无期。」"
  ),
  relic(
    "r-diamond-06",
    "封条下的小字",
    "diamond",
    7,
    "set-diamond-lock",
    1,
    "有人在封条下发现一行小字——「等丹丘的雾散之后」。"
  ),
  relic(
    "r-diamond-07",
    "一环未开",
    "diamond",
    7,
    "set-diamond-lock",
    2,
    "原来四大陆的法则环环相扣，一环未开，环环皆锁。",
    "rare"
  ),
  relic(
    "r-diamond-08",
    "多出的那把椅子",
    "diamond",
    2,
    "set-diamond-lock",
    3,
    "椅子永远比来客多一把，那是留给「下一个十日」的座位。"
  ),
];

/* ==================================================================== */
/* 汇总                                                                 */
/* ==================================================================== */

export const RELIC_CARDS: RelicCard[] = [
  ...SET_SPADE_FLAW,
  ...SET_SPADE_STELE,
  ...SET_CLUB_WELL,
  ...SET_CLUB_STEADY,
  ...SET_HEART_TEA,
  ...SET_HEART_ENCORE,
  ...SET_DIAMOND_PRICE,
  ...SET_DIAMOND_LOCK,
];

export const RELIC_SETS: RelicSet[] = [
  {
    id: "set-spade-flaw",
    name: "破绽",
    suit: "spade",
    truth: "所有人都在演，区别只在于演给谁看。",
    cardIds: SET_SPADE_FLAW.map(c => c.id),
  },
  {
    id: "set-spade-stele",
    name: "无字碑",
    suit: "spade",
    truth: "最昂贵的从来不是胜利，是信任。",
    cardIds: SET_SPADE_STELE.map(c => c.id),
  },
  {
    id: "set-club-well",
    name: "井底之数",
    suit: "club",
    truth: "算到尽头，答案是零，也是人心。",
    cardIds: SET_CLUB_WELL.map(c => c.id),
  },
  {
    id: "set-club-steady",
    name: "站得稳",
    suit: "club",
    truth: "算得深的人会摔，站得稳的人只是慢。",
    cardIds: SET_CLUB_STEADY.map(c => c.id),
  },
  {
    id: "set-heart-tea",
    name: "一盏茶",
    suit: "heart",
    truth: "先动心者输，看穿之后仍要陪他演完。",
    cardIds: SET_HEART_TEA.map(c => c.id),
  },
  {
    id: "set-heart-encore",
    name: "最后一场",
    suit: "heart",
    truth: "谁都可以代你上阵，没有人能替你后悔。",
    cardIds: SET_HEART_ENCORE.map(c => c.id),
  },
  {
    id: "set-diamond-price",
    name: "万物有价",
    suit: "diamond",
    truth: "真正的富有，是让别人不得不上桌。",
    cardIds: SET_DIAMOND_PRICE.map(c => c.id),
  },
  {
    id: "set-diamond-lock",
    name: "环环皆锁",
    suit: "diamond",
    truth: "一环未开，环环皆锁；而椅子总比来客多一把。",
    cardIds: SET_DIAMOND_LOCK.map(c => c.id),
  },
];

/* ------------------------------------------------------------------ */
/* 查询辅助                                                            */
/* ------------------------------------------------------------------ */

const relicById = new Map(RELIC_CARDS.map(c => [c.id, c]));
const setById = new Map(RELIC_SETS.map(s => [s.id, s]));

export function getRelicCard(id: string): RelicCard | undefined {
  return relicById.get(id);
}

export function getRelicSet(id: string): RelicSet | undefined {
  return setById.get(id);
}

/** 某组是否已集齐（ownedIds 可含重复，此处只判存在性） */
export function isSetComplete(
  setId: string,
  ownedIds: readonly string[]
): boolean {
  const set = setById.get(setId);
  if (!set) return false;
  const owned = new Set(ownedIds);
  return set.cardIds.every(id => owned.has(id));
}

/** 列出已集齐的全部组 id（用于 GateContext.completedRelicSetIds） */
export function completedSetIds(ownedIds: readonly string[]): string[] {
  return RELIC_SETS.filter(s => isSetComplete(s.id, ownedIds)).map(s => s.id);
}
