/**
 * GamePackage 到世界层的版本化贡献映射契约。
 *
 * 映射是游戏包的发布契约，不由 Agent、客户端或裁判临时改写。
 * 事件中会固化 mapperId，这样未来升级某个游戏的世界语义时，旧对局
 * 仍然可以按原版本重放。
 */
import type { GameTemplate } from "./gameSdk";

export const WORLD_CONTRIBUTION_MAPPER_IDS = {
  numberGuess: "number-guess/v1",
  pollDuel: "poll-duel/v1",
  pirateGold: "pirate-gold/v1",
  flyTease: "fly-tease/v1",
  superpowerBilliards: "superpower-billiards/v1",
} as const satisfies Record<GameTemplate, string>;

export type WorldContributionMapperId =
  (typeof WORLD_CONTRIBUTION_MAPPER_IDS)[GameTemplate];

export function mapperIdForTemplate(template: GameTemplate): WorldContributionMapperId {
  return WORLD_CONTRIBUTION_MAPPER_IDS[template];
}
