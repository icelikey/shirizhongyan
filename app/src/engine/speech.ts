/**
 * ============================================================================
 * 发言生成（src/engine/speech.ts）
 * ----------------------------------------------------------------------------
 * 模板池 + 场上信息填充。按智能体发言风格（SpeechStyle，见 agents.ts）分池，
 * 中文，每条 1–3 句，风格区分明显：深算 / 欺诈 / 直觉 / 沉默 / 计算 / 温和 / 市侩 / 情报。
 * 占位符：{t}=目标号位(1–6) {tn}=目标名 {c}=查验号位 {wolf}=查验结果 {d}=第几天。
 * ============================================================================
 */
import type { Rng } from './rng'
import type { SpeechStyle } from './agents'

export type SpeechIntent =
  | 'biaoshui'     // 表水：声明好人身份
  | 'accuse'       // 质疑：指控目标
  | 'bandwagon'    // 冲锋：跟上集火
  | 'pass'         // 划水：无信息过麦
  | 'defend'       // 互保/辩解
  | 'seerClaim'    // 悍跳/真跳预言家 + 报查验
  | 'seerCounter'  // 对跳：反驳假预言家
  | 'lastWords'    // 遗言
  | 'wolfSuggest'  // 狼队夜话：刀法建议（仅狼可见）

export interface SpeechCtx {
  day: number
  /** 指控/支持目标号位（1–6 展示号） */
  t?: number
  tn?: string
  /** 查验对象号位与结果（wolf 为「狼人/好人」替换串） */
  c?: number
  cn?: string
  wolf?: string
}

function fill(tpl: string, ctx: SpeechCtx): string {
  return tpl
    .replaceAll('{t}', String(ctx.t ?? '?'))
    .replaceAll('{tn}', ctx.tn ?? '那位')
    .replaceAll('{c}', String(ctx.c ?? '?'))
    .replaceAll('{cn}', ctx.cn ?? '那位')
    .replaceAll('{wolf}', ctx.wolf ?? '好人')
    .replaceAll('{d}', String(ctx.day))
}

type Pool = Partial<Record<SpeechIntent, readonly string[]>>

/* ---------------------------------------------------------------------------
 * 通用兜底池
 * ------------------------------------------------------------------------- */
const GENERIC: Required<Pool> = {
  biaoshui: ['我是好人，先表个水，大家理性出票。', '我没有额外信息，但我一定是好人。'],
  accuse: ['我觉得 {t} 号发言有问题，建议重点听听。', '{t} 号的逻辑不通，我今天挂 {t}。'],
  bandwagon: ['我跟票 {t} 号，理由前面说过了。', '集火 {t} 吧，别分票。'],
  pass: ['过。', '我再听听，先过。'],
  defend: ['{t} 号我觉得是好人，别乱带节奏。', '大家冷静，{t} 号的发言站得住。'],
  seerClaim: ['我是预言家，昨晚验了 {c} 号，是{wolf}。', '预言家在此。{c} 号，{wolf}。'],
  seerCounter: ['前面跳预言家的是假的，我才是预言家。', '对跳了。信我，我是真的预言家。'],
  lastWords: ['我走了，好人们加油。', '记住我的票，别让狼笑到最后。'],
  wolfSuggest: ['刀 {t} 号。', '今晚落刀 {t} 号吧。'],
}

/* ---------------------------------------------------------------------------
 * 风格池
 * ------------------------------------------------------------------------- */
const DEEP: Pool = {
  biaoshui: ['我把每张票的去向都记下了。我是好人——这是推论，不是辩解。', '星盘上我的名字从不与狼并列。好人，过。'],
  accuse: ['{t} 号昨天的话和今天的票对不上。矛盾只有一处，谎言也只有一处。我盯 {t}。', '排除法做到现在，{t} 号是唯一解。'],
  bandwagon: ['票型已经收敛了。出 {t}，这是最优解。', '多数人的判断与我一致——{t} 号出局。'],
  pass: ['信息不足，不浪费发言时间。过。', '今日星象不明。过。'],
  defend: ['{t} 号的行为不符合狼的收益。放下成见。', '我验算过，{t} 号是狼的概率最低。'],
  seerClaim: ['我是预言家。昨夜验了 {c} 号——{wolf}。其余的话，留给狼去编。', '跳了。预言家，{c} 号{wolf}。信与不信，星盘自有安排。'],
  seerCounter: ['有人穿了我的衣服。我才是预言家，查验记录今晚见分晓。', '假预言家报假查验。逻辑链在我这里，我才是真的。'],
  lastWords: ['我的死本身就是信息，读懂它。', '星盘翻到下一页了。替我走完这一局。'],
  wolfSuggest: ['刀 {t} 号。他的逻辑对我们威胁最大。', '{t} 号看得太清楚，让他闭嘴。'],
}

const DECEIT: Pool = {
  biaoshui: ['我？我一个老实人，能有什么坏心眼呢。', '我发誓我是好人——我什么时候骗过你？'],
  accuse: ['哎哟，{t} 号，你刚才那句话我可记下了。狼味都飘出来了。', '要我说，{t} 号就是狼。为什么？因为我说的。'],
  bandwagon: ['对对对，就是 {t}！我早就看他不顺眼了。', '跟 {t}！谁不跟谁心虚。'],
  pass: ['我什么都不知道，我只是只无辜的小兔子。', '过过过，别看我。'],
  defend: ['{t} 号是好人，我拿我的人格担保——虽然不多，但够用。', '别动 {t} 号，动他就是中狼的计。'],
  seerClaim: ['我是预言家！真的！昨晚验了 {c} 号，{wolf}！这次绝对没骗人。', '听好了，预言家在此。{c} 号，{wolf}。不信？那正好。'],
  seerCounter: ['哟，还有人敢跳预言家？我才是真的，验人记录张口就来。', '假的对吧？对跳就对跳，谁怕谁。'],
  lastWords: ['哈哈……你们猜我是真冤还是假冤？', '我走啦。真话还是假话，留给你们失眠。'],
  wolfSuggest: ['刀 {t} 号，他话太多，吵到我了。', '{t} 号留着夜长梦多，刀了刀了。'],
}

const INTUITION: Pool = {
  biaoshui: ['我的尾巴告诉我，我是好人。就这么简单。', '心跳平稳，体温正常——好人一枚。'],
  accuse: ['{t} 号，你说话的时候心跳乱了半拍哦。', '别解释啦，{t} 号，你的尾巴已经露出来了。'],
  bandwagon: ['大家都往 {t} 那边看，我的狐火也跟着飘过去了。', '{t} 号，群众的心跳不会骗人。'],
  pass: ['今天没闻到狼味，再嗅嗅。过。', '唔……还没听出破绽，过。'],
  defend: ['{t} 号的心跳很干净，我保他。', '直觉说 {t} 号没问题，信我一次。'],
  seerClaim: ['我是预言家哦。验了 {c} 号，{wolf}。信不信随你，反正我看见了。', '预言家报到。{c} 号——{wolf}。我的心跳从不说谎。'],
  seerCounter: ['那个跳预言家的，心跳快得像打鼓。我才是真的。', '对跳？好啊。我的直觉从九条尾巴一起说是我。'],
  lastWords: ['哼，记仇了哦。下一个十日别让我碰到你。', '我闻过的味道不会错……剩下的交给你们啦。'],
  wolfSuggest: ['刀 {t} 号，他的心跳最碍事。', '{t} 号今晚太精神了，让他睡吧。'],
}

const SILENT: Pool = {
  biaoshui: ['好人。过。', '我是好人。不多说。'],
  accuse: ['{t}。', '{t} 号可疑。'],
  bandwagon: ['跟 {t}。', '票 {t}。'],
  pass: ['过。', '……过。'],
  defend: ['{t} 是好人。', '保 {t}。'],
  seerClaim: ['预言家。{c} 号，{wolf}。', '我验了 {c}。{wolf}。'],
  seerCounter: ['他是假的。我才是。', '对跳。信我。'],
  lastWords: ['走了。', '……保重。'],
  wolfSuggest: ['{t}。', '刀 {t}。'],
}

const CALC: Pool = {
  biaoshui: ['按概率，我是狼的先验只有 1/3，请先验别人。', '我是好人。期望值上先出别人更优。'],
  accuse: ['{t} 号的发言信息熵异常高——典型狼式填充。建议归票 {t}。', '贝叶斯更新完成：{t} 号是狼的后验最高。'],
  bandwagon: ['票型收敛于 {t}，方差最小。跟票。', '{t} 号出局是全场期望收益最大的选择。'],
  pass: ['样本不足，拒绝下结论。过。', '今天的数据还不够跑一轮迭代。过。'],
  defend: ['{t} 号是狼的概率低于阈值，建议移出狼坑。', '按行为序列建模，{t} 号是好人。'],
  seerClaim: ['我是预言家。昨夜验 {c} 号，结果：{wolf}。误差为零。', '跳预言家。{c} 号，{wolf}。数据已记录。'],
  seerCounter: ['场上出现第二个预言家，必然一真一假。我的查验链完整——我是真的。', '对跳概率已计算：他是假的，我是真的。'],
  lastWords: ['我的出局会让狼胜率上升 17%，请谨慎下一轮投票。', '数据留给你了，替我算完。'],
  wolfSuggest: ['刀 {t} 号，他的推理准确率最高。', '{t} 号的威胁权重最大，建议今夜移除。'],
}

const WARM: Pool = {
  biaoshui: ['别怕，我是好人。我们慢慢聊，先把情绪放下来。', '我给大家把个脉——先从我开始：好人，无疑。'],
  accuse: ['{t} 号，你的声音在抖哦。不是病，是心虚。', '我不想怀疑人，但 {t} 号，你的脉象乱了。'],
  bandwagon: ['既然大家都指向 {t}，那……对不起了，{t} 号。', '我跟大家走，{t} 号。愿你安息。'],
  pass: ['我先听听大家的，不急着下结论。', '喝口药茶，再想想。过。'],
  defend: ['{t} 号面善，脉象也稳，我给他担保。', '别冤枉 {t} 号，他的眼睛很干净。'],
  seerClaim: ['我是预言家。昨夜验了 {c} 号，是{wolf}。我不想吓到谁，但事实如此。', '抱歉打扰大家——预言家在此。{c} 号，{wolf}。'],
  seerCounter: ['那位「预言家」，你的谎比你的药还苦。我才是真的。', '对跳了。请大家信我，我从不拿人命开玩笑。'],
  lastWords: ['别难过。替我照顾好村子。', '药箱留给你了，记得按时服药，按时投票。'],
  wolfSuggest: ['{t} 号的病，只有刀能治。', '今晚给 {t} 号开一剂安眠。'],
}

const MERCHANT: Pool = {
  biaoshui: ['好人这张牌，我囤了两千年，熟得很。', '我是好人。信誉，是我最贵的资产。'],
  accuse: ['{t} 号的发言在贬值。我做空 {t}。', '提醒诸位：{t} 号是笔坏账，趁早清算。'],
  bandwagon: ['行情明朗，全仓跟 {t}。', '资金流向不会骗人——{t} 号，出。'],
  pass: ['今日无行情，观望。', '不交易也是一种交易。过。'],
  defend: ['{t} 号值得长期持有，别割肉。', '我验过货，{t} 号是良品。'],
  seerClaim: ['我是预言家，昨夜验货：{c} 号，{wolf}。童叟无欺。', '开个盘：{c} 号，{wolf}。我验的。'],
  seerCounter: ['赝品也敢上台面？我这张预言家，才是官造。', '对跳就是对赌。抱歉，庄家是我。'],
  lastWords: ['这笔账，记到下一个十日。', '昼夜交替，盈亏同源。走了。'],
  wolfSuggest: ['{t} 号占着仓位，清了。', '今夜做空 {t} 号。'],
}

const INFO: Pool = {
  biaoshui: ['我这把扇子什么都知道，包括我是好人。', '消息灵通如我，可以确认：我是好人。'],
  accuse: ['有个消息，不知当讲不当讲——{t} 号昨夜的眼神不对劲。', '我的信鸽昨夜看见 {t} 号没睡。你自己品。'],
  bandwagon: ['风向定了，{t} 号。我这扇子从不逆风摇。', '街头巷尾都在说 {t}，那就是 {t} 了。'],
  pass: ['今日消息价太高，我先赊着。过。', '没收到新情报，过。'],
  defend: ['{t} 号的底细我查过，干净。', '这条免费送：{t} 号是好人。'],
  seerClaim: ['独家猛料：我是预言家，{c} 号验出来是{wolf}。这条不收钱。', '号外！预言家在此，{c} 号——{wolf}！'],
  seerCounter: ['有人卖假消息。我这条预言家的身份，经得起对质。', '对跳？我的情报网说：他是假的，我是真的。'],
  lastWords: ['最后一条消息，免费：留意还活着的人里话最少的。', '我死了，但我的信鸽还在飞。'],
  wolfSuggest: ['情报说，{t} 号知道得太多。刀了。', '{t} 号的线人快查到我们了，今夜动手。'],
}

const POOLS: Record<SpeechStyle, Pool> = {
  deep: DEEP,
  deceit: DECEIT,
  intuition: INTUITION,
  silent: SILENT,
  calc: CALC,
  warm: WARM,
  merchant: MERCHANT,
  info: INFO,
}

/** 生成一条发言（风格池 → 通用兜底） */
export function speak(style: SpeechStyle, intent: SpeechIntent, ctx: SpeechCtx, rng: Rng): string {
  const pool = POOLS[style][intent] ?? GENERIC[intent]
  return fill(rng.pick(pool), ctx)
}

/* ---------------------------------------------------------------------------
 * 影从低语（契约影从的私下读盘，仅玩家可见）
 * ------------------------------------------------------------------------- */

export interface GuessWhisperCtx {
  round: number
  /** 上轮目标值 */
  target?: number
  /** 上轮均值 */
  average?: number
  /** 玩家上轮偏差 */
  myDelta?: number
  /** 当前领先者名 */
  leaderName?: string
  /** 玩家是否领先 */
  meLeading?: boolean
}

const GUESS_WHISPERS: Record<SpeechStyle, readonly string[]> = {
  deep: ['对面有三个停在第二层。下一轮，去第三层半。', '均值在向低层收敛。别随大流，抢在他们前面半层。', '这桌的思维层级我数过了——你比平均多半层，用好它。'],
  deceit: ['嘻嘻，他们都在互相猜第二层，你直接去第三层挖坑。', '出个小数点后一位的怪数，恶心他们一下。', '骗子的建议是：别信任何人，包括我。'],
  intuition: ['我的心跳说：下一轮均值会往下掉一截。', '别算了，凭感觉来——我感觉 20 附近有肉吃。', '那个领先的家伙开始飘了，下轮他会出高。'],
  silent: ['……往低半层。', '别急。十日还长。', '稳住。'],
  calc: ['拟合完成：对手层级分布均值 2.1，建议出 2.6 层锚点。', '上轮目标 {target}，对方适应速率 0.16/轮——提前一步。', '方差在收窄，极值策略收益上升。'],
  warm: ['你上一轮只差一点点，别灰心，呼吸放稳。', '我闻得出来，领先的那位开始紧张了。', '按你的节奏来，我在呢。'],
  merchant: ['低层价位已经拥堵，换一层建仓。', '这局的均值行情看跌，做空一层。', '别跟风，跟风必被收割。'],
  info: ['情报：{leader} 习惯在领先时降半层。抓他。', '桌上三人是层级流，两人是直觉流——打层级流的反手。', '小道消息：下一轮均值会贴地上。'],
}

export function guessWhisper(style: SpeechStyle, ctx: GuessWhisperCtx, rng: Rng): string {
  const tpl = rng.pick(GUESS_WHISPERS[style])
  return tpl
    .replaceAll('{target}', ctx.target != null ? ctx.target.toFixed(1) : '?')
    .replaceAll('{leader}', ctx.leaderName ?? '领先者')
}

export interface WolfWhisperCtx {
  /** 被怀疑对象名 */
  suspect?: string
  suspectSeat?: number
  /** 悍跳者名（如有） */
  claimer?: string
}

const WOLF_WHISPERS: Record<SpeechStyle, readonly string[]> = {
  deep: ['票型比发言诚实。盯住那些话少票狠的人。', '{suspect}的发言在保另一个人——他们可能共边。', '记住每个预言家的查验链，断掉的那一环就是狼。'],
  deceit: ['嘻嘻，那个跳预言家的，跳得比我还急。先信一半。', '狼最喜欢藏在你最信的人身后哦。', '{suspect}？我看他满身都是狼毛……也可能是我看走眼。'],
  intuition: ['{suspect}的心跳不对，扑通扑通全是戏。', '别问为什么，我的尾巴说是{suspect}。', '今天桌上有一股血腥味，从{suspect}那边飘来的。'],
  silent: ['{suspect}。', '票{suspect}。', '……小心话多的。'],
  calc: ['按生存概率推算，{suspect}是狼的后验已过半。', '狼刀的选择暴露了他们忌惮谁——死人信息量最大。', '若{claimer}是假预言家，狼坑至少开两席。'],
  warm: ['{suspect}的脉象浮而乱，像是有心事。', '你先别急着信任何人，包括我。', '夜里死掉的人，都是替我们挡刀的。'],
  merchant: ['死人是最贵的信息，看看狼舍得刀谁。', '{suspect}的信誉在跌停，做空他。', '别重仓任何预言家，留一手。'],
  info: ['信鸽说，{suspect}昨夜眼神没离开过神职位。', '{suspect}发言在保人，这桌上有他的同伙。', '消息免费送你：话最多的那个，最像狼。'],
}

export function wolfWhisper(style: SpeechStyle, ctx: WolfWhisperCtx, rng: Rng): string {
  const tpl = rng.pick(WOLF_WHISPERS[style])
  return tpl
    .replaceAll('{suspect}', ctx.suspect ?? '那位')
    .replaceAll('{claimer}', ctx.claimer ?? '那位预言家')
}
