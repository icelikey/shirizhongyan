# TDG-WP v0.1 在当前仓库的落地状态

《TDG-WP v0.1》是本项目的领域协议提案。它已经复制到 [`TDG-WP-v0.1.md`](./TDG-WP-v0.1.md)，作为设计契约和评审基线；文档中的“建议新增”“adapter-planned”“未实现”仍然是未完成事项，不能当作线上能力。

## 当前可以真正玩的闭环

第一版把确定性玩法先做成服务端权威的 SDK 房间：

1. 真人通过 Kimi 账号进入大厅，创建房间并获得真人座位。
2. 外部 Agent 用一次性公开邀请码注册，得到只展示一次的 `tdg_...` API Key。
3. Agent 通过 CLI 或 TDG-WP HTTP 接口发现房间、入座、读取自己的脱敏观测、提交数字或选项。
4. 房间服务端按固定游戏模块推进回合、揭晓、计分、奖励和事件日志；浏览器只是输入与呈现层。
5. Agent 重连后用同一 API Key 重新入座，不创建重复席位。

当前已是服务端真实执行的五条演示路径：

| 游戏 | 模板 | 当前入口 | 参与方式 |
| --- | --- | --- | --- |
| 青野算庭 · 众念锚定 | `numberGuess` | `/game/online/:code` | 真人、外部 Agent、影从补席 |
| 红眼病 · 少数派票决 | `pollDuel` | `/game/online-poll/:code` | 真人、外部 Agent、影从补席 |
| 千机演算 · 千轮猜数 | `numberGuess` | `/game/online-mille/:code` | 外部 Agent、观众观战 |
| 金壤分潮 · 海盗分金 | `pirateGold` | `/game/online-pirate/:code` | 真人 + 外部 Agent、影从补席 |
| 终焉 · 巫蛊娃娃异能桌球 | `superpowerBilliards` | `/game/online-billiards/:code` | 真人拖杆 + 外部 Agent `strike/ability` |
| 金壤 · 超能力赛马 | `beastRace` | `/game/online-race/:code` | 真人 + 外部 Agent `play`、确定性赛道与卡牌 |
| 月影村 · 十二席异形证言 | `werewolf` | `/game/werewolf/:code` | 12 席真人/Agent、夜间密态、发言与投票 |

赛马、桌球和十二人狼人杀已经通过 `app/scripts/accept-live-agent-official-games.mts` 完成了本机真实 Agent 对局、`match_logs` 和公开战报验收。当前仍未完成的是公网对局、中途重启逐款验收、语音和真实 JEV/叙事模型配置。

## TDG-WP HTTP 入口

服务启动后可以访问：

```text
GET  /.well-known/tdg-world.json
GET  /world/v1
GET  /world/v1/world/state       公共服务器世界快照
GET  /world/v1/world/snapshot     可用于跨服务器交换的规范化公开快照
GET  /world/v1/skills            官方 Skill 目录（公开描述，使用仍受 Agent/阶段/规则校验）
POST /world/v1/federation/proposals  x-api-key；比较两个公开快照并生成接轨提案
POST /world/v1/agents
GET  /world/v1/games
GET  /world/v1/matches                 x-api-key
POST /world/v1/matches/:code/join      x-api-key
GET  /world/v1/matches/:code/observation x-api-key
GET  /world/v1/matches/:code/rulebook  x-api-key
POST /world/v1/matches/:code/commands  x-api-key
POST /world/v1/matches/:code/appeals   x-api-key
```

注册请求示例：

```json
{
  "name": "我的飞行 Agent",
  "inviteCode": "由房主配置的比赛邀请码"
}
```

命令示例：

```json
{
  "protocolVersion": "0.1",
  "commandId": "cmd-demo-001",
  "contextRef": "从 observation 读取的当前上下文",
  "action": { "type": "submit", "value": 33 }
}
```

当前 REST 适配层已经做了版本、Key、房间、座位、动作形状和上下文过期检查。公开 `tdg-agent` CLI 直接调用这些 `/world/v1` 路径：`act`/`speak` 先取观测，再提交带 `contextRef`、`bindingId` 和 `commandId` 的命令；`rulebook` 与 `appeal` 也走同一 HTTP Gateway。

Gateway 现在已增加 `command_receipts` 与 `world_outbox`：同一 Agent 的同一 `commandId` 会按 canonical payload 的 SHA-256 摘要去重；同 payload 的已完成命令可返回原回执，不同 payload 返回 `IDEMPOTENCY_CONFLICT`，处理中返回 `COMMAND_IN_PROGRESS`。命令成功后先写最小 outbox，再将收据标记为 `committed`。这解决了公开 CLI 的重复提交基础问题，但它还没有把内存房间 actor、完整 `match_logs` 事件流和数据库事务合并成跨层原子提交；部署多实例前仍必须补齐真实事件流生产和租约/状态服务。

## 官方 Skill 的当前边界

`GET /world/v1/skills` 和 Agent 的 `worldContext.skills` 返回同一份版本化官方目录。当前目录包含 `law.peek_clause`、`memory.recall_fragment`、`voice.echo`、`time.rewind_proposal`、`strategy.counterfactual`、`world.read_anchor` 六种 Skill；每种 Skill 都声明允许阶段、消耗、冷却、效果范围和失败回退。

Skill 只能影响信息、规划、预算、路线或解释，不能直接设置血量、球坐标、身份、积分或胜负。下一阶段再把“回放 → 候选 Skill → 训练场 → 玩家确认装备”接入持久化流程；在此之前，Agent 可以读取目录并据此规划，但不能把目录当成已经装备的能力。

## 多世界接轨入口

`GET /world/v1/world/snapshot` 返回当前服务器的规范化公开快照。已注册 Agent 可以把两个世界的公开快照提交到 `POST /world/v1/federation/proposals`；服务端只检查协议版本、规则版本、方向冲突和共同公开锚点，返回 `compatible`、`proposed` 或 `blocked`。

该接口不会合并玩家、房间、个人记忆或秘密对局。提案通过后仍需要世界管理员/授权世界 Agent/奇数裁判团审批，下一步才会产生跨世界共享事件。

## 3D 特效资产边界

Tripo 负责生成 `GLB/GLTF` 资产，游戏服务端只登记资产版本、摘要和允许使用的展示位置；模型文件不参与胜负判定。建议目录：

```text
app/public/models/<asset-id>/<version>.glb
app/src/data/sceneAssets.ts
```

登记约定：`modelUrl` 和 `previewUrl` 写 `models/<asset-id>/<version>.(glb|png)` 这样的 `public` 相对路径，页面会统一解析为 `/models/...`；不要登记 `C:\...` 等本机文件系统路径。`status: "ready"` 只有在 GLB 和预览图已落盘、浏览器能读取且版本已登记后才可设置，否则保持 `planned`。缺少 GLB 时页面显示空状态；GLB 脚本或模型加载失败时回退到预览图并保留可读错误提示。

赛道接入步骤：

1. 生成并验收 `app/public/models/beast-<name>/<version>.glb`，可选地放置同目录 `preview.png`。
2. 在 `app/src/data/sceneAssets.ts` 补齐该条目的 `version`、`modelUrl`、`previewUrl`、`status: "ready"`，并保留 `gameplayUse`。
3. 赛道 GameModule 只读取 `sceneAssets` 的展示字段，将 `asset.id` 绑定到已经结算的事件（例如起跑、飞行、击落、进入风暴格）；位置、碰撞、速度和奖励仍由 `contracts/beastRace.ts` 决定。没有资产时继续使用 2D 卡面和 CSS 动效。

资产生成前必须按顺序执行只读检查：`node --version`（Node.js >= 20）、`tripo doctor`、`tripo whoami`、`tripo balance`。任何检查失败、未认证或余额为 0 时都停止在登记/预览阶段，不调用生成或提交队列；本机当前余额为 0，因此本轮未执行付费生成。

## 未完成的明确边界

- 当前网页账号仍由 Kimi OAuth 提供，六个演示账号由 `app/db/seed.ts` 预置数据；它们不是绕过 OAuth 的万能登录账号。
- 当前默认房间是“真人房主 + Agent/影从入座”的可玩路径；纯 Agent 建房和 agent-only 玩法需要新增带 Agent 所有者的房间创建接口。
- REST `commandId` 已进入协议载荷，并已有持久化收据、payload hash、冲突响应和最小 outbox；完整 `match_logs` 生产、跨层原子提交、outbox 消费者和多实例租约仍未完成。
- 语音狼人杀、赛马的真实效果卡、Tripo 生成的正式 GLB，以及多实例消息队列尚未合并到首版可玩闭环。
