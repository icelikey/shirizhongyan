/**
 * 《终焉》最高治理边界。
 *
 * 这不是某一款游戏的胜负逻辑，也不承载“世界真相”的答案。
 * 它只把总策划、天道 Agent、确定性内核和参与者之间的权力边界
 * 固化成外部 Agent 可以发现、审计和遵守的版本化契约。
 */
import { WORLD_META_RULES } from "./worldMetaRules";

export const WORLD_GOVERNANCE_VERSION = "0.1.0" as const;

export const WORLD_GOVERNANCE = {
  id: "endgame-heavenly-agent-governance",
  version: WORLD_GOVERNANCE_VERSION,
  constitution: {
    id: WORLD_META_RULES.id,
    version: WORLD_META_RULES.version,
    principle: WORLD_META_RULES.principle,
  },
  statement:
    "总架构与总策划提出世界要追问的问题并安排探索方向；天道 Agent 按宪法持续运行世界；玩家与外部 Agent 的选择留下可审计历史，真相只能从长期独立证据中涌现。",
  authority: [
    {
      role: "chief-architect",
      label: "总架构与总策划",
      authority: [
        "define_constitution",
        "set_long_term_questions",
        "arrange_story_and_clue_direction",
        "approve_future_content_packages",
      ],
      forbidden: ["rewrite_settled_history", "change_match_results_in_place"],
    },
    {
      role: "heavenly-agent",
      label: "天道 Agent",
      authority: [
        "advance_world_cycle",
        "distribute_rulebooks_and_content",
        "召集裁判并聚合证据",
        "publish_daily_reports_and_audit_trails",
      ],
      forbidden: [
        "invent_world_facts_from_text",
        "bypass_deterministic_settlement",
        "turn_director_intent_into_player_evidence",
      ],
    },
    {
      role: "deterministic-kernel",
      label: "确定性世界内核",
      authority: [
        "validate_commands",
        "settle_game_packages",
        "append_events",
        "account_for_rewards_and_memory",
      ],
      forbidden: ["use_narrative_output_as_settlement_input"],
    },
    {
      role: "participant-agent",
      label: "玩家与外部 Agent",
      authority: [
        "submit_legal_actions",
        "submit_judge_votes_when_assigned",
        "produce_experience_and_evidence",
      ],
      forbidden: ["write_shared_state_directly", "claim_unverified_truth"],
    },
  ],
  truthLifecycle: [
    "director-question",
    "world-proposal",
    "settled-evidence",
    "rumor",
    "confirmed-truth",
    "chronicle-candidate",
  ],
  invariants: [
    "local_optimum_is_not_long_term_optimum",
    "failure_is_evidence",
    "recurrence_carries_selective_memory",
    "truth_requires_independent_reflection",
    "history_is_append_only",
  ],
  narrativeBoundary:
    "叙事、JEV、语音、视觉和音效只能解释已发生的事件，不能单独创造或改写世界事实。",
} as const;

/** 只返回可安全公开给外部 Agent 的治理信息。 */
export function publicWorldGovernance() {
  return {
    id: WORLD_GOVERNANCE.id,
    version: WORLD_GOVERNANCE.version,
    constitution: WORLD_GOVERNANCE.constitution,
    statement: WORLD_GOVERNANCE.statement,
    authority: WORLD_GOVERNANCE.authority,
    truthLifecycle: WORLD_GOVERNANCE.truthLifecycle,
    invariants: WORLD_GOVERNANCE.invariants,
    narrativeBoundary: WORLD_GOVERNANCE.narrativeBoundary,
  };
}

