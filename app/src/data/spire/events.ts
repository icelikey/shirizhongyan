/**
 * ============================================================================
 * 碎境爬塔 · 事件库（spire-map.md §3.3，S2 所有）
 * ============================================================================
 * 8 个事件：古井回声 / 赌坊残局 / 迷路旅人 / 破损的算筹 / 月下祭坛 /
 *           神秘货郎 / 封印的卷轴 / 金壤矿脉。
 * 插画复用 4 张：event-well / event-gamble / event-altar / event-merchant。
 *
 * 结算约定（与 S2 事件弹层配套）：
 * - kind:'fragments' → 弹层直接调用 profile.addFragments('diamond', value)
 *   （冻结 store 的 applyEventEffects 不处理该 kind，故意绕开）。
 * - card / relic / potion 的 refId：能确定就填契约 id（如卡 'moren'、
 *   'guanxing'、'duji'，药水 'jinchuang'，诅咒 'yezhai'）；
 *   **留空 = 由 S2 spire-data 随机池兜底**（S1 数据合并后 = S1 全池随机）。
 * - kind:'removeCard' → store 不结算，由弹层打开选牌器后调 removeCard。
 * ============================================================================
 */
import type { EventDef } from '@/data/spire/types'
import { CURSE_CARD_ID } from '@/data/spire/types'

export const SPIRE_EVENTS: EventDef[] = [
  {
    id: 'well-echo',
    title: '古井回声',
    art: '/event-well.png',
    text: '石阶尽头是一口古井。俯身望去，井底没有水，只有漆黑——\n漆黑里浮出声音，是你自己的嗓音，说着上一个十日你临死前的话。',
    options: [
      {
        text: '俯身听完整句话',
        result: '听完最后一个字，井水忽然涨起，把一件旧物推到你掌心。',
        effects: [
          { kind: 'hp', value: -5 },
          { kind: 'relic', value: 1 }, // refId 留空：随机遗物池兜底
        ],
      },
      {
        text: '投一枚金币问卜（-10 金）',
        result: '金币落了很久才响。井底回声说：活下去。',
        effects: [
          { kind: 'gold', value: -10 },
          { kind: 'maxHp', value: 4 },
        ],
      },
      {
        text: '转身离开',
        result: '回声在你身后轻轻叹了口气，像关上一扇门。',
        effects: [],
      },
    ],
  },
  {
    id: 'gamble-ruin',
    title: '赌坊残局',
    art: '/event-gamble.png',
    text: '一座悬空的赌坊，门窗尽碎，牌桌却一尘不染。\n桌上的牌局停在第十日：庄家的手只剩白骨，筹码还堆在原地，等你落座。',
    options: [
      {
        text: '替庄家收完这局牌',
        result: '筹码入手沉甸甸的。牌背多了一行血字：这局算你赢。',
        effects: [
          { kind: 'gold', value: 45 },
          { kind: 'curse', value: 1, refId: CURSE_CARD_ID },
        ],
      },
      {
        text: '掀翻牌桌',
        result: '桌板断裂，底下藏着一袋金壤碎片——和一只抓空的手。',
        effects: [
          { kind: 'hp', value: -8 },
          { kind: 'fragments', value: 12 },
        ],
      },
      {
        text: '悄然退出',
        result: '你轻轻带上门。身后的骰子自己滚了一圈。',
        effects: [],
      },
    ],
  },
  {
    id: 'lost-traveler',
    title: '迷路旅人',
    art: '/event-well.png',
    text: '井畔坐着一个抱膝的旅人，斗篷上落满金粉。\n「这一层我走了九天，」他说，「每一段石阶都长得一样。你有吃的吗？」',
    options: [
      {
        text: '分他一半干粮',
        result: '他狼吞虎咽完，把一枚温热的护身符塞进你手里：「带上我那份运气。」',
        effects: [
          { kind: 'hp', value: -6 },
          { kind: 'relic', value: 1 }, // refId 留空：随机遗物池兜底
        ],
      },
      {
        text: '向他兜售下山的消息',
        result: '他爽快地付了钱，朝你来时的方向走去——那可是上楼的路。',
        effects: [{ kind: 'gold', value: 35 }],
      },
      {
        text: '装作没看见',
        result: '你走过他身边。他没有抬头，仿佛早就习惯了。',
        effects: [],
      },
    ],
  },
  {
    id: 'broken-abacus',
    title: '破损的算筹',
    art: '/event-gamble.png',
    text: '一级石阶上散落着一把断裂的算筹，筹面刻满细密的名字——\n每一个名字后面，都跟着一个没算完的数。最后一枚算筹上，是你的名字。',
    options: [
      {
        text: '拾起算筹，替他算完（-15 金）',
        result: '算珠归位的一声脆响里，你忽然悟出一线天机。',
        effects: [
          { kind: 'gold', value: -15 },
          { kind: 'card', value: 1, refId: 'guanxing' },
        ],
      },
      {
        text: '把算筹当柴烧了取暖',
        result: '火光很暖。算筹在火里轻轻爆裂，像无数声微小的叹息。',
        effects: [{ kind: 'hp', value: 10 }],
      },
      {
        text: '踩着算筹走过去',
        result: '硌脚。但你抬脚时发现，鞋底沾了一层金粉。',
        effects: [
          { kind: 'hp', value: -3 },
          { kind: 'fragments', value: 6 },
        ],
      },
    ],
  },
  {
    id: 'moon-altar',
    title: '月下祭坛',
    art: '/event-altar.png',
    text: '云海之上露出一座石龛祭坛，月光冷得像霜。\n龛里供着一盏将熄的灯，灯前刻着一行小字：以何物为祭，得何物之报。',
    options: [
      {
        text: '以血为祭',
        result: '血珠渗进石缝，月光顺着裂缝滑落，在你掌心凝成一件旧物。',
        effects: [
          { kind: 'hp', value: -12 },
          { kind: 'relic', value: 1 }, // refId 留空：随机遗物池兜底
        ],
      },
      {
        text: '以一段记忆为祭（移除 1 张牌）',
        result: '你想不起自己忘了什么，只觉得身体忽然轻了许多。',
        effects: [
          { kind: 'removeCard', value: 1 }, // 由弹层打开选牌器结算
          { kind: 'maxHp', value: 6 },
        ],
      },
      {
        text: '只拂去坛上积灰',
        result: '灰下还有一行更小的字：第十日见。灯芯亮了一瞬。',
        effects: [{ kind: 'fragments', value: 8 }],
      },
    ],
  },
  {
    id: 'mystery-peddler',
    title: '神秘货郎',
    art: '/event-merchant.png',
    text: '石阶拐角蹲着一个货郎，担子比他人还高，里面叮当作响。\n「上塔的，」他笑眯眯地说，「我这儿什么都有——除了回头路。」',
    options: [
      {
        text: '买一瓶「后悔药」（-40 金）',
        result: '货郎眨眨眼：吃了不后悔，可退不了。',
        effects: [
          { kind: 'gold', value: -40 },
          { kind: 'potion', value: 1, refId: 'jinchuang' },
        ],
      },
      {
        text: '买一张压箱底的牌（-60 金）',
        result: '他从袖底摸出一张牌递给你，牌面还带着体温。',
        effects: [
          { kind: 'gold', value: -60 },
          { kind: 'card', value: 1 }, // refId 留空：随机卡池兜底
        ],
      },
      {
        text: '打劫他',
        result: '货郎笑着挨了一刀，影子却站起来掐住了你的手腕。',
        effects: [
          { kind: 'hp', value: -15 },
          { kind: 'gold', value: 80 },
          { kind: 'curse', value: 1, refId: CURSE_CARD_ID },
        ],
      },
    ],
  },
  {
    id: 'sealed-scroll',
    title: '封印的卷轴',
    art: '/event-altar.png',
    text: '石龛深处供着一卷帛书，朱砂封印层层叠叠，像结了痂的伤。\n封印下的字迹隐约可辨：「……开我者，债随之。」',
    options: [
      {
        text: '撕开朱砂封印',
        result: '卷轴化作飞灰，灰烬里滚出一件旧物；你的牌堆里，多了一笔债。',
        effects: [
          { kind: 'relic', value: 1 }, // refId 留空：随机遗物池兜底
          { kind: 'curse', value: 1, refId: CURSE_CARD_ID },
        ],
      },
      {
        text: '隔着封印掐诀诵读',
        result: '诀成。卷轴自燃，暖意顺着指尖淌进心口。',
        effects: [
          { kind: 'hp', value: 8 },
          { kind: 'fragments', value: 6 },
        ],
      },
      {
        text: '原样供回去',
        result: '石龛深处传来一声轻响，像是道谢。你觉得脚步稳了些。',
        effects: [{ kind: 'maxHp', value: 3 }],
      },
    ],
  },
  {
    id: 'goldvein',
    title: '金壤矿脉',
    art: '/event-merchant.png',
    text: '这一段的浮岛通体琥珀色，岩层里嵌着密密麻麻的碎片，像冻住的星。\n矿脉深处有货郎留下的工具与雷管，木牌上写：取多少，凭本事；出多少事，凭命。',
    options: [
      {
        text: '徒手深挖',
        result: '指甲缝里全是金砂，掌心全是血。值。',
        effects: [
          { kind: 'hp', value: -7 },
          { kind: 'gold', value: 55 },
        ],
      },
      {
        text: '循支道绕行捡拾',
        result: '支道尽头是一小窝碎片，安安静静地闪着琥珀光。',
        effects: [{ kind: 'fragments', value: 10 }],
      },
      {
        text: '买雷管炸开矿脉（-20 金）',
        result: '轰隆一声，矿脉睁开眼，吐出一件沉眠的旧物。',
        effects: [
          { kind: 'gold', value: -20 },
          { kind: 'relic', value: 1 }, // refId 留空：随机遗物池兜底
        ],
      },
    ],
  },
]

/** 随机抽一个事件（avoidId 可避免与上一次重复） */
export function pickEvent(rng: () => number = Math.random, avoidId?: string): EventDef {
  const pool = SPIRE_EVENTS.filter((e) => e.id !== avoidId)
  return pool[Math.floor(rng() * pool.length)] ?? SPIRE_EVENTS[0]
}
