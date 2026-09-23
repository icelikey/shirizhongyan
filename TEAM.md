# 三人协作说明

本文档是当前仓库的协作入口。首个可交付产品只做一个主游戏：**月影狼人杀**。赛马、达芬奇密码、海盗分金和辩论都保留为内容包或实验场，不在同一轮里各做一套半成品。

## 当前状态（2026-09-23）

| 模块 | 状态 | 事实与下一步 |
|---|---|---|
| Agent Gateway | 已有 | 房间查询、入座、脱敏观测、行动、规则书、质询已存在 |
| 公开 Agent 注册 | 本轮已写入，待提交 | `agent.publicRegister` 通过邀请码发放长期 `tdg_` Key |
| CLI | 本轮已写入，待提交 | `cli/` 支持 register、rooms、join、watch、act、speak、appeal、doctor |
| 事件流与奇迹集锦 | 已有基础 | 对局事件可落库，并可生成可观战的高光片段 |
| 云端安装包 | 本轮已写入，待提交 | Docker、Compose、Cloud Run 脚本和 CI 已补齐 |
| 月影狼人杀闭环 | 进行中 | 需要把身份、夜晚、结构化发言、投票、Jev、结算和语音串成一局 |
| 赛马 | 内容包候选 | 契约和数据已有，等主线稳定后接入执行器与演出 |
| 本地数据库验收 | 待运行 | 当前 Docker Desktop 未启动，数据库烟测需启动 MySQL 8 后重跑 |

## 三条不能破的边界

1. 卡牌只解锁信息、路线、条款或叙事，不直接替玩家改胜负数值。
2. 异能只改变信息与时间，例如多看、误导、加时、窥见推理链；最终胜负仍由规则裁定。
3. 密态事件只能进入全知观战投影，玩家席位视角必须由服务端过滤。

所有新游戏都通过 `TemplateModule` 接入。规则状态、行动校验和事件记录在服务端；前端只负责输入与展示；Agent 通过公开 Gateway 走同一套规则。

## 三条开发主线

### A 号：平台、云端和 Agent 协议

建议分支：`codex/platform-cloud`

负责 `app/Dockerfile`、`docker-compose.cloud.yml`、`deploy/`、健康检查、MySQL 8/Cloud SQL 说明、公开注册、`cli/`、GitHub Actions，以及 API 契约的向后兼容。

验收条件：

- `pnpm check`、CLI `npm run check` 和 `pnpm build` 通过。
- `GET /api/health` 返回 `200` 与 `ok: true`。
- 新 Agent 能用邀请码注册，Key 只返回一次，Key 重启后仍能恢复同一座位。
- `docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d --build` 能启动应用和 MySQL 8。
- Cloud Run 脚本默认 `min=1`、`max=1`，不把房间状态误部署成多实例。
- 仓库中没有 API Key、数据库密码或真实邀请码。

### B 号：月影狼人杀与 AI 玩法

建议分支：`codex/werewolf-agent`

负责狼人杀规则状态机、四种参与方式（人/人、Agent/Agent、人+Agent/人+Agent、混合）、隐藏身份投影、结构化发言卡、Jev 分析与奇数裁判团、托管与断线恢复、语音事件协议。

验收条件：

- 真人对 Agent、Agent 对 Agent、人加 Agent 对人加 Agent 各跑完一局。
- 夜晚行动、白天发言、投票、出局和胜负结算全部由服务端状态驱动。
- 发言先产生结构化意图，再由 Jev 做语义分析；Jev 不可用时仍能用本地降级规则继续。
- 裁判席只使用 3、5 或 7 席，投票与理由能落到事件流。
- 语音服务失败时退回字幕和浏览器 TTS，不阻塞比赛。

### C 号：观战、视觉、引导和剧情

建议分支：`codex/spectator-ui`

负责选择卡、身份卡、对话气泡、音频播放、裁判席、全知观战页、Agent Reel、三分钟新手引导、月影村剧情和结算卡面。

验收条件：

- 观众能看懂“谁做了什么、为什么触发、结果改变了什么”。
- 私密信息、公开信息和裁判信息使用明显不同的视觉层级。
- 点击发言卡后有字幕、预制音频或回退语音，并留下 `SpeechEvent`。
- 一局结束能看到至少一段可复看的高光集锦。
- 首次玩家不读长文也能在三分钟内完成入座、一次发言和一次投票。

## GitHub 工作方式

所有人从最新 `main` 建分支，不直接推 `main`。分支只承载一条主线，提交信息写清行为变化，例如 `feat: add public agent registration`。

每个 Pull Request 必须写：目标、改动文件、验收命令、截图或录屏、已知限制。合并前执行：

```bash
cd app
pnpm check
pnpm test
pnpm build
cd ../cli
npm run check
```

合并顺序固定为：平台契约 → 狼人杀状态机 → UI/剧情 → 现场联调。出现 API 契约变更时，先在 PR 中更新 `contracts/` 和调用方，再合并实现。

## 四天交付节奏

第一天完成云端启动、公开注册、CLI、房间入座和新手引导骨架；第二天完成狼人杀四种模式和脱敏投影；第三天完成结构化发言、Jev、语音回退和观战页；第四天只做联调、性能、演示脚本和故障兜底。

赛马作为下一阶段的 `♦ 金壤` 内容包，沿用同一 Gateway、事件流、裁判和集锦接口，不在主线验收前插入新的完整游戏。
