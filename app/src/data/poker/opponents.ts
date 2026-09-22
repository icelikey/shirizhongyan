/**
 * 丹丘牌楼 · 十二位面具牌手（poker.md §1.2/§1.3）。
 * 第 4/8 层为精英（HP ×1.5，压注区间伪装），第 12 层为楼主「千面」（HP 400）。
 * 压注区间 bet 为第 1 层基准，实际区间随层数上浮（引擎 clamp 至 3–15）。
 */

export interface OpponentDef {
  id: string
  /** 层数 1–12 */
  floor: number
  name: string
  /** 面具设定 */
  mask: string
  /** 第 1 层基准压注区间 [lo, hi] */
  bet: [number, number]
  elite?: boolean
  boss?: boolean
  /** 立绘（public/pop-*.png），无立绘者用 MaskIcon 兜底 */
  portrait?: string
  /** 战前台词 */
  intro: string
  /** 压注台词（随机） */
  betLines: string[]
  /** 败北台词 */
  defeat: string
}

export const OPPONENTS: OpponentDef[] = [
  {
    id: 'lingren', floor: 1, name: '笑面伶人', mask: '半张永远上扬的朱漆笑面',
    bet: [3, 5], portrait: '/pop-lingren.png',
    intro: '客官里边请——这第一局，奴家让您三分。',
    betLines: ['笑一笑，压一压。', '您猜，奴家这笑里有几分真？'],
    defeat: '笑面……裂了。往上走吧，上面的面具，一张比一张厚。',
  },
  {
    id: 'qinshi', floor: 2, name: '无瞳琴师', mask: '蒙眼的素白琴面，无瞳却似洞穿',
    bet: [3, 6], portrait: '/pop-qinshi.png',
    intro: '琴音替你洗牌。你的心跳，我听见了。',
    betLines: ['这一弦，为你而紧。', '杂音入心，压注无声。'],
    defeat: '弦断了……你的心跳，原来也会骗人。',
  },
  {
    id: 'wuji', floor: 3, name: '红袖舞姬', mask: '流苏金面，眼波自缝隙流转',
    bet: [4, 7], portrait: '/pop-wuji.png',
    intro: '看袖，还是看牌？你只能选一样。',
    betLines: ['红袖一翻，注上加注。', '舞步不乱，你的阵脚呢？'],
    defeat: '袖停了。这一舞，输得心服。',
  },
  {
    id: 'shushi', floor: 4, name: '符面术士', mask: '贴满符咒的青铜面，精英',
    bet: [5, 8], elite: true, portrait: '/pop-shushi.png',
    intro: '符面之下无相。你看到的区间，未必是贫道的底牌。',
    betLines: ['符起，注落。', '你读的，只是贫道让你读的。'],
    defeat: '符灰落地……你读穿了第四层。罕见。',
  },
  {
    id: 'shanggu', floor: 5, name: '玉算盘商贾', mask: '算珠串成的市侩面具',
    bet: [4, 8], portrait: '/pop-shanggu.png',
    intro: '人心币进，命出。本店的账，从不算错。',
    betLines: ['这一注，记在您的命账上。', '算盘一响，黄金万两。'],
    defeat: '亏、亏了……这单生意，认赔！',
  },
  {
    id: 'sengren', floor: 6, name: '闭口僧', mask: '缝了嘴的木鱼面，不语而威',
    bet: [5, 9], portrait: '/pop-sengren.png',
    intro: '（他不说话。木鱼声里，你听见自己的贪心。）',
    betLines: ['……（木鱼笃笃）', '（他推注的手，没有一丝颤抖。）'],
    defeat: '（他双手合十，第一次开口：）善哉。上去罢。',
  },
  {
    id: 'zhitong', floor: 7, name: '垂髫稚童', mask: '纸糊的童面，画得歪歪扭扭',
    bet: [3, 9], portrait: '/pop-zhitong.png',
    intro: '哥哥陪我玩牌嘛——输了的人，要留下来哦。',
    betLines: ['嘻嘻，加注！', '你的牌在发抖诶。'],
    defeat: '呜哇——不玩了不玩了！楼上的婆婆最凶了！',
  },
  {
    id: 'biaoshi', floor: 8, name: '铜面镖师', mask: '刀疤纵横的铜面，精英',
    bet: [6, 10], elite: true,
    intro: '押镖三十年，押的是人心。这一趟，押你的命。',
    betLines: ['镖旗所指，注不回头。', '护镖如护命——加注。'],
    defeat: '镖……失了。铜面之下的脸，你已经配得上一见。',
  },
  {
    id: 'poniang', floor: 9, name: '捻线婆娘', mask: '红线缠面的老妪，线头连着牌背',
    bet: [5, 10],
    intro: '老婆子捻的不是线，是你出牌的路数。',
    betLines: ['线头一紧，注就上来了。', '你的牌路，老婆子早织好了。'],
    defeat: '线断了也罢。上去吧，小心那面镜子。',
  },
  {
    id: 'jingguan', floor: 10, name: '镜冠判官', mask: '头顶一面水银镜冠，照出你的表情',
    bet: [6, 11],
    intro: '本官断案不看牌，看镜子里你的脸。',
    betLines: ['镜中你，已露怯。押。', '心虚一钱，压注一钧。'],
    defeat: '镜裂了……原来判官也会看走眼。',
  },
  {
    id: 'huajiang', floor: 11, name: '描皮画匠', mask: '未上完妆的白面，随胜负变幻',
    bet: [7, 12],
    intro: '再赢一层，我就把你的脸，画进牌楼里。',
    betLines: ['这一笔，描你的败相。', '颜料不够了——拿你的注来调。'],
    defeat: '画毁了……也罢，你的脸，我画不出第二张。',
  },
  {
    id: 'qianmian', floor: 12, name: '千面楼主', mask: '千面叠千面，无一面是真',
    bet: [8, 15], boss: true, portrait: '/pop-qianmian.png',
    intro: '十二层的路，你用一副牌走上来了。现在——猜猜我是谁？',
    betLines: ['千面之一，足以压你。', '你读过的所有心，都是我的。', '这一注，是整座牌楼的重量。'],
    defeat: '千面尽落……最后这一张，是你自己的脸。丹丘，认你了。',
  },
]

export const OPPONENT_MAP: Record<string, OpponentDef> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o]))

/** 第 f 层对手 HP：30 + 15×(f-1)，精英 ×1.5，楼主固定 400 */
export function opponentHp(floor: number): number {
  const opp = OPPONENTS[floor - 1]
  if (opp.boss) return 400
  const base = 30 + 15 * (floor - 1)
  return Math.round(base * (opp.elite ? 1.5 : 1))
}
