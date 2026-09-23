import type { RuleBook } from "./rulebook";
import type { DebateParams } from "./debate";

export const DEBATE_PARAMS: DebateParams = {
  rounds: 3,
  quorumSize: 3,
  maxArgumentLength: 500,
  scoreAccepted: 2,
  scoreParticipated: 1,
};

export const RULE_DEBATE_RULEBOOK: RuleBook = {
  id: "rb-rule-debate",
  name: "玄渊 · 下一步规则辩论",
  version: 1,
  template: "ruleDebate",
  clauses: [
    {
      id: "c-debate-victory",
      title: "最终采纳",
      text: "每回合由裁判团对候选提案作出采纳、驳回或部分成立的裁定；最后一回合结束时按累计积分排名。",
      category: "victory",
    },
    {
      id: "c-debate-scoring",
      title: "参与计分",
      text: "每席每回合最多提交一份提案；被采纳的提案得 scoreAccepted 分，完成合法提案但未被采纳得 scoreParticipated 分。",
      category: "scoring",
    },
    {
      id: "c-debate-timeout",
      title: "超时兜底",
      text: "回合结束时未提交回应的质询，视为提案者未回应，但不阻止裁判团对候选提案作出裁定。",
      category: "edge",
    },
    {
      id: "c-debate-duplicate",
      title: "重复提案",
      text: "同一席位在同一回合只能提交一份提案，重复提交的后续动作无效。",
      category: "edge",
    },
    {
      id: "c-debate-conduct",
      title: "论据边界",
      text: "提案、质询与回应必须绑定现有条款并提供可验证论据，空泛或越权文本不得成为候选结果。",
      category: "conduct",
    },
  ],
};

export const DEBATE_CLAUSE_IDS = RULE_DEBATE_RULEBOOK.clauses.map(c => c.id);
