/**
 * ============================================================================
 * 新手引导数据（contracts/onboarding.data.ts）
 * ----------------------------------------------------------------------------
 * 【为何末步是质询】其余八步教的是「怎么玩」，末步告诉玩家「规则本身可被改写」。
 * 本作不把规则写成不可违逆的天条：玩家可引条款质询，由 3/5/7 席裁判团裁决，
 * 采纳则铸成判例，影响此后所有同规则书的对局。
 * 这是全作唯一「玩家能改变世界」的机制，故留在最后，作为引导的落点。
 *
 * 【锚点用路由而非 CSS 选择器】选择器会随组件重构失效，且引导指向一个
 * 不存在的选择器时会静默失败（浮层飘在角落，玩家不知道该看哪）。
 * 路由是稳定契约——`route` 决定这一步在哪一页，`anchor` 为页内可选补充，
 * 缺失时降级为居中浮层，永远不会指向空气。
 * ============================================================================
 */

export interface OnboardingStep {
  id: string;
  title: string;
  /** 正文，至多两句——牌桌上没人读长文 */
  body: string;
  /** 这一步所在的路由（与 src/App.tsx 的 path 对应） */
  route: string;
  /**
   * 页内锚点选择器，可选。
   * null = 居中浮层。找不到该元素时也降级为居中，不报错。
   */
  anchor: string | null;
  /**
   * next  读完点「继续」
   * click 等玩家实际点了目标元素
   * wait  等某个状态到达（如结算完成），由页面调 advance()
   */
  action: "next" | "click" | "wait";
  /** 完成这一步的获得提示；null = 纯讲解无奖励 */
  rewardHint: string | null;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "bind-echo",
    title: "立契，选影从",
    body: "你误入牌局之间，先与一只契约影从立契。八位影从各有所长，所选即是你在十日中的第一种判断。",
    route: "/",
    anchor: null,
    action: "click",
    rewardHint: "契成之时，得开局异能一枚",
  },
  {
    id: "meet-fragments",
    title: "认识碎片",
    body: "世界每十日终结一次，碎片是重启后留下的证词。它按四花色分记，既是门票，也是叙事的钥匙。",
    route: "/lobby",
    anchor: null,
    action: "next",
    rewardHint: null,
  },
  {
    id: "enter-lobby",
    title: "大厅",
    body: "此处是四陆交汇之地，牌局尚未落子的空场。房间可由你开，也可入他人之局。",
    route: "/lobby",
    anchor: null,
    action: "next",
    rewardHint: null,
  },
  {
    id: "choose-match",
    title: "择一局",
    body: "♠玄渊重欺骗，♥丹丘重谈判，♣青野重算数，♦金壤重争利。先试青野的猜数一局，规则最简。",
    route: "/lobby",
    anchor: null,
    action: "click",
    rewardHint: null,
  },
  {
    id: "make-a-move",
    title: "落手",
    body: "秘密提交，同时揭晓。你可自行落手，也可委托影从代打——它会按人设的思考层级出数。",
    route: "/game/guess",
    anchor: null,
    action: "click",
    rewardHint: "得一次可追溯的行动记录",
  },
  {
    id: "reveal-settle",
    title: "揭晓与结算",
    body: "牌面翻开，隐线才显出真形。结算不只记输赢，也记你触发了哪些彩蛋。",
    route: "/game/guess",
    anchor: null,
    action: "wait",
    rewardHint: "胜负既定，碎片入囊",
  },
  {
    id: "map-and-tier",
    title: "世界与位阶",
    body: "四陆铺于图上，位阶自黄而玄、而地、而天。位阶不只是名号——它决定你每局能用几次异能。",
    route: "/world",
    anchor: null,
    action: "next",
    rewardHint: null,
  },
  {
    id: "relic-puzzle",
    title: "残章",
    body: "残章不是散落的收藏，是可互相校验的碎语。集齐一组，拼出的那句真相即是塔门口令。",
    route: "/lore",
    anchor: null,
    action: "next",
    rewardHint: null,
  },
  {
    id: "appeal-the-rules",
    title: "规则可被质询",
    body: "若条款与眼前事实相悖，你可引它质询，由三席裁判裁断。采纳者铸成判例，此后同类之局皆从新解。",
    route: "/codex",
    anchor: null,
    action: "next",
    rewardHint: "质询得中，铸判例卡一张——世上仅此一张",
  },
];

export const ONBOARDING_VERSION = 1;

export function stepById(id: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find(step => step.id === id);
}

/** 某路由下的引导步骤（页面据此决定是否显示浮层） */
export function stepsForRoute(route: string): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(s => route.startsWith(s.route));
}

/** 下一步（走完返回 undefined） */
export function nextStep(currentId: string): OnboardingStep | undefined {
  const i = ONBOARDING_STEPS.findIndex(s => s.id === currentId);
  return i >= 0 ? ONBOARDING_STEPS[i + 1] : undefined;
}

/** 总步数（进度条用） */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;
