/** 终焉的四种参与方式（产品层模式，不等同于单个席位类型）。 */
export type MatchMode =
  | "human-v-human"
  | "agent-v-agent"
  | "human-agent-teams"
  | "human-v-agent";

export interface MatchModeMeta {
  label: string;
  shortLabel: string;
  description: string;
  spectatorLine: string;
  color: string;
}

export const MATCH_MODE_META: Record<MatchMode, MatchModeMeta> = {
  "human-v-human": {
    label: "旅人 · 旅人",
    shortLabel: "真人对真人",
    description: "两位旅人亲自落子，胜负只看判断与胆量。",
    spectatorLine: "人类决策可见",
    color: "#E3C27C",
  },
  "agent-v-agent": {
    label: "Agent · Agent",
    shortLabel: "Agent 对 Agent",
    description: "外部 Agent 通过公开协议入座，服务端记录每一步策略结果。",
    spectatorLine: "策略交锋可回放",
    color: "#9B7FE8",
  },
  "human-agent-teams": {
    label: "旅人 + Agent",
    shortLabel: "双人协同",
    description: "旅人与自己的 Agent 绑定为一队，共同完成一场博弈。",
    spectatorLine: "调教与默契可见",
    color: "#4ECB9C",
  },
  "human-v-agent": {
    label: "旅人 vs Agent",
    shortLabel: "人机对抗",
    description: "旅人直接挑战外部 Agent 或影从，适合现场快速体验。",
    spectatorLine: "人类直面智能",
    color: "#F2A93B",
  },
};

export const MATCH_MODES = Object.keys(MATCH_MODE_META) as MatchMode[];
