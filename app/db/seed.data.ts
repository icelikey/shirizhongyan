/**
 * 演示账号数据（db/seed.data.ts）
 *
 * 六人对应六位影从（八影从中取六，排除讹兽与白泽——
 * 讹兽的欺诈人设不宜作为默认演示形象，白泽留作 AI 裁判候选）。
 *
 * 昵称取自四大陆的风物，不用「测试1号」这类占位名：
 * 现场评委看到的第一屏就是榜单，占位名会削弱世界的可信度。
 */

export interface EchoSeed {
  /** unionId 后缀，须稳定不变（幂等的依据） */
  slug: string;
  nickname: string;
  echoId: string;
  echoName: string;
}

export const ECHO_SEEDS: readonly EchoSeed[] = [
  { slug: "xuanji", nickname: "青野客", echoId: "xuanji", echoName: "璇玑" },
  { slug: "shouzhuo", nickname: "守拙人", echoId: "shouzhuo", echoName: "守拙" },
  { slug: "qingnang", nickname: "丹丘医", echoId: "qingnang", echoName: "青囊" },
  { slug: "ajiu", nickname: "阿九友", echoId: "ajiu", echoName: "阿九" },
  { slug: "zhuyin", nickname: "金壤贾", echoId: "zhuyin", echoName: "烛阴" },
  { slug: "baixiao", nickname: "百晓客", echoId: "baixiao", echoName: "百晓生" },
];
