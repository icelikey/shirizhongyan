/**
 * 终焉官方 Skill 注册表。
 *
 * Skill 只改变信息、规划、预算或解释路径，不直接改写游戏结果。
 * 规则内核仍然是唯一可以提交并结算动作的地方。
 */
import { z } from "zod";

export const OFFICIAL_SKILL_VERSION = "1.0" as const;

export const skillPhaseSchema = z.enum([
  "observe",
  "plan",
  "negotiate",
  "submit",
  "review",
]);
export type SkillPhase = z.infer<typeof skillPhaseSchema>;

export const skillEffectScopeSchema = z.enum([
  "information",
  "planning",
  "budget",
  "route",
  "explanation",
]);
export type SkillEffectScope = z.infer<typeof skillEffectScopeSchema>;

export interface OfficialSkill {
  id: string;
  version: typeof OFFICIAL_SKILL_VERSION;
  title: string;
  summary: string;
  lore: string;
  allowedPhases: readonly SkillPhase[];
  cost: { resource: "charge" | "attention" | "memory"; amount: number };
  cooldown: number;
  effectScope: SkillEffectScope;
  fallback: string;
  requiresEvidence: boolean;
}

export const OFFICIAL_SKILLS: readonly OfficialSkill[] = [
  {
    id: "law.peek_clause",
    version: OFFICIAL_SKILL_VERSION,
    title: "窥条",
    summary: "在一次争议或关键决策前读取当前规则书的相关条款。",
    lore: "塔不会告诉你答案，只肯把写在门上的字擦亮。",
    allowedPhases: ["observe", "review"],
    cost: { resource: "charge", amount: 1 },
    cooldown: 1,
    effectScope: "information",
    fallback: "没有匹配条款时只返回规则书版本，不生成解释。",
    requiresEvidence: true,
  },
  {
    id: "memory.recall_fragment",
    version: OFFICIAL_SKILL_VERSION,
    title: "回忆残片",
    summary: "从已装备记忆卡中召回一条带来源的线索。",
    lore: "遗忘不是抹去，而是把一盏灯放到你暂时找不到的地方。",
    allowedPhases: ["observe", "plan"],
    cost: { resource: "memory", amount: 1 },
    cooldown: 2,
    effectScope: "information",
    fallback: "没有可引用的记忆时返回空结果，不允许补写正史。",
    requiresEvidence: true,
  },
  {
    id: "voice.echo",
    version: OFFICIAL_SKILL_VERSION,
    title: "回声",
    summary: "把被跳过的公开发言重新放回本局证据链。",
    lore: "玄渊记得每一个没有被回应的声音。",
    allowedPhases: ["negotiate", "review"],
    cost: { resource: "attention", amount: 1 },
    cooldown: 1,
    effectScope: "explanation",
    fallback: "只能恢复公开发言，不能读取私聊或隐藏身份。",
    requiresEvidence: true,
  },
  {
    id: "time.rewind_proposal",
    version: OFFICIAL_SKILL_VERSION,
    title: "回提",
    summary: "允许对尚未提交的方案重新提案一次。",
    lore: "时间可以让人重说一句话，却不能让已经落下的刀回到鞘中。",
    allowedPhases: ["plan", "negotiate"],
    cost: { resource: "charge", amount: 1 },
    cooldown: 2,
    effectScope: "planning",
    fallback: "已提交或已结算的事实不可回滚。",
    requiresEvidence: false,
  },
  {
    id: "strategy.counterfactual",
    version: OFFICIAL_SKILL_VERSION,
    title: "逆共识",
    summary: "要求策略层生成一个反共识候选，并给出可审计理由。",
    lore: "算庭最危险的门，往往由所有人同时认为不会打开。",
    allowedPhases: ["plan"],
    cost: { resource: "attention", amount: 1 },
    cooldown: 0,
    effectScope: "planning",
    fallback: "逆共识候选仍需经过动作白名单和规则内核校验。",
    requiresEvidence: false,
  },
  {
    id: "world.read_anchor",
    version: OFFICIAL_SKILL_VERSION,
    title: "读锚",
    summary: "读取当前服务器已经确认的公共世界锚点。",
    lore: "世界不会替你解释真相，只把已经被多人走过的脚印留下。",
    allowedPhases: ["observe", "review"],
    cost: { resource: "memory", amount: 1 },
    cooldown: 1,
    effectScope: "information",
    fallback: "未达到独立参与者门槛的内容只显示为传闻。",
    requiresEvidence: true,
  },
];

export const officialSkillById = new Map(OFFICIAL_SKILLS.map((skill) => [skill.id, skill]));

export function publicSkillCatalog() {
  return OFFICIAL_SKILLS.map((skill) => ({
    ...skill,
    allowedPhases: [...skill.allowedPhases],
  }));
}

export function skillCanRun(skillId: string, phase: SkillPhase) {
  const skill = officialSkillById.get(skillId);
  return Boolean(skill && skill.allowedPhases.includes(phase));
}
