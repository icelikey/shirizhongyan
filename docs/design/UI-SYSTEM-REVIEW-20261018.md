# 终焉 UI 系统复盘与前端改造契约

> 日期：2026-10-18  
> 结论类型：当前代码事实 + 设计方案 + 发布前门槛  
> 视觉基准图：[ui-atlas-v1.png](./ui-atlas-v1.png)

## 先给结论

现有项目已经有一套可复用的视觉地基：`DESIGN.md` 和 `app/src/index.css` 已经落地暗色星云、金线、朱砂、四花色、印章、颗粒噪点和动效曲线。首页、大厅、猜数、狼人杀、规则图鉴和 Agent 门户已经有可用页面；世界地图和影从档案页偏薄，裁判席、回放证据链、文字战报阅读器、世界 Agent 控制台和内容审核台还没有形成完整产品页面。

因此下一阶段不是重新换皮，而是把“世界状态、对局状态、Agent 状态、裁判状态和事件证据”统一投影成同一套 UI 状态契约，再按契约补齐页面。视觉稿应先冻结页面结构与状态，代码改造随后按页面逐个落地。

## 已核对的当前 UI 范围

路由入口位于 `app/src/App.tsx`，当前包含：

- 世界与内容：`/`、`/world`、`/lore`、`/codex`、`/leaderboard`、`/characters`。
- 玩家与 Agent：`/lobby`、`/agent`、`/agent-portal`、`/agent-report/:agentId`。
- 主游戏和联机页：`/game/online/:code`、`/game/online-mille/:code`、`/game/online-poll/:code`、`/game/online-pirate/:code`、`/game/online-fly/:code`、`/game/online-billiards/:code`、`/game/online-race/:code`、`/game/online-werewolf/:code`。
- 本地/序章/爬塔：`/game/entry`、`/game/guess/:roomId`、`/game/werewolf/:roomId`、`/game/spire`、`/game/spire/map`、`/game/spire/combat`、`/game/poker`。

已有组件可以复用：`TopHUD`、`AppShell`、`MapCanvas`、`WorldKnowledgeBoard`、`OnlineLobbySection`、`GameTopBar`、`PhaseBanner`、`LogStream`、`AgentPortal` 的 Key 弹层、`AgentReport` 的战报基础块，以及各游戏自己的座位、结算、卡牌和动效组件。

当前缺口不是“没有任何 UI”，而是这些页面没有共享的证据和运行状态：

| 缺口 | 影响 | 设计状态 |
|---|---|---|
| 裁判席 | 规则质询、3/5/7 裁判、判例生效无法被看见 | P0 新页面 |
| 回放时间轴与证据链 | 事件、`eventSeq`、`stateHash`、战报引用无法逐条回看 | P0 新页面 |
| 文字世界/战报阅读器 | 事实回放与推断文本没有统一阅读入口 | P0 新页面 |
| Agent 运行台 | Key、CoI、租约、观察、动作回执和错误状态分散 | P0 新页面 |
| 世界 Agent 控制台 | 心跳、任务、提案、审核、失败重试没有生产可视化 | P0 新页面 |
| 内容提案/灰度发布台 | 内容 Forge、规则 Compiler、审批和回滚没有操作面 | P1 新页面 |
| 世界地图与影从档案 | 现有页面只有地图/档案展示，缺少事件、运行健康和行动入口 | P1 扩展 |

## 视觉系统冻结

新页面继续使用现有令牌，不在组件中新增散落颜色：

- 底色：`--bg-abyss`、`--bg-ink`、`--bg-panel`、`--bg-elevated`、`--bg-felt`。
- 主色：`--gold-100`、`--gold-300`、`--gold-500`、`--gold-700`。
- 四花色：玄渊 `#8B93F8`、丹丘 `#EE6A72`、青野 `#4ECB9C`、金壤 `#F2A93B`。
- 风险/裁判：朱砂 `--cinnabar`；成功/可提交：`--ok`；信息/观察：`--info`。
- 动效：常规 `--ease-ink`，翻牌 `--ease-snap`，奖励 `--ease-spring`；必须继续受 `prefers-reduced-motion` 控制。

`ui-atlas-v1.png` 是结构与气质参考，不是生产数据截图。文字、数值、事件和权限状态必须来自真实 API；图片不能替代事件证据。

## 全量 UI 出图清单

每张图都要同时出“空态、运行态、异常态、完成态”。同一张页面图只保留一个主任务，避免把所有功能塞进首页。

| 编号 | 页面图 | 主任务 | 必须展示的状态 |
|---|---|---|---|
| A01 | 世界地图 + 大陆抽屉 | 先理解世界，再进入玩法 | 当前纪元、四大陆、锁定原因、公开事件、Agent/线索入口 |
| A02 | 主大厅 | 找到可玩的真实房间 | 房间状态、席位、游戏包版本、真人/Agent 标记、观战入口 |
| A03 | 通用对局桌 | 做一个合法动作 | 阶段、倒计时、规则版本、己方视角、动作候选、事件流、提交回执 |
| A04 | 观战与回放 | 看懂一局如何改变世界 | 全知标识、事件时间轴、因果链、`eventSeq`、证据引用、重播/跳转 |
| A05 | 裁判席 | 处理规则质询 | 条款、质询事实、证据包、3/5/7 票面、判例生效周期、回避提示 |
| A06 | 文字世界/战报 | 阅读事实和推断 | 事实段、推断段、证据锚点、权限遮罩、模型状态、fallback 标识 |
| A07 | Agent Gateway | 注册并理解 API 权限 | Key 一次性提示、CoI grants、预算、允许动作、吊销、CLI 示例 |
| A08 | Agent 运行台 | 观察 Agent 是否真的在跑 | runner lease、心跳、当前房间、最新 observation、命令收据、错误码、重试建议 |
| A09 | 世界 Agent 控制台 | 查看世界自动化 | scheduler、active/paused、任务队列、提案队列、消费延迟、失败重试、审计日志 |
| A10 | 内容提案与灰度 | 发布新规则/内容包 | schema 检查、兼容性、审批人、灰度比例、回滚点、证据引用 |
| A11 | 入界序章 | 让新玩家理解节点与协议 | 移动、规则碑、Agent 接入台、事件节点、进入真实房间 |
| A12 | 奖励/轮回/爬塔 | 看见对局后的长期变化 | 掉落、能力、死亡携带、世界贡献、下一层门禁、可回放来源 |

## 对局页的统一骨架

每个游戏页都用同一骨架，模板只替换中间的局面投影：

```text
┌ 规则版本 / 房间码 / 阶段 / 倒计时 / 连接状态 ┐
├ 公开事件与因果链 ─────── 当前局面 ─────── 玩家席位 ┤
├ 规则提示 / 合法动作集合 ─ 动作卡与确认 ─ 回执状态 ┤
└ 回放 / 质询 / 战报 / 退出 ──────────────────────┘
```

模板差异只允许来自 `GamePackage` 的状态投影：

- 猜平均数：数轴、目标线、提交状态、揭晓结果。
- 少数派：选项卡、票数柱、平票提示、连续轮次走势。
- 狼人杀：夜/昼、密态身份、结构化发言意图、投票和全知观战标识。
- 赛马：赛道、手牌、技能窗口、位置/状态、飞行→击落→反制因果链。
- 海盗分金：提案数组、存活席、买票关系、投票封存和提案权转移。
- 虫心算谱：公开响应表、行为倾向、拥挤/怒气/脉冲雨；脉冲雨只作表现层。
- 异能桌球：固定步长球桌、击杆参数、能力窗口、碰撞/袋口/复活证据。

## CLI 与 Agent 的真实权限边界

当前 CLI 不是第二套游戏逻辑，而是 `/world/v1` HTTP/JSON 的协议客户端。外部 Agent 可以通过 CLI 或直接 HTTP 完成：

1. 注册一次并保存一次性 `tdg_` Key。
2. `doctor`、`world`、`rooms`、`rulebook`、`watch/text/report/daily` 读取允许的世界与对局投影。
3. `create`（仅拥有 `create_match` 且目标为官方 `agent-only` 定义时）、`join`、`act`、`speak`、`appeal` 发起写操作。
4. 写操作带最新 `contextRef`、`bindingId`、`commandId`；服务端执行 CoI、规则、席位、阶段、payload hash 和幂等回执检查。

当前不允许外部 Agent：

- 直接写胜负、分数、奖励、世界快照、隐藏信息或事件序号；
- 把自由文本当作规则指令；
- 读取其他席位的密态；
- 以 API Key 自动获得房主、管理员、裁判或世界合并权限。

这些边界由 `app/api/worldGateway.ts`、`app/api/agentRouter.ts`、`@contracts/worldCoi`、房间模板和 `command_receipts` 共同执行。

## “自主 Agent”当前到底怎样运行

### 已存在的自动化

`scripts/tdg-agent-worker.mjs` 已有一条可执行循环：

```text
doctor/discovery → rooms → create/join → observation → chooseAction → commands → activity/report
```

`app/api/world/worldOutboxWorker.ts` 已在 `app/api/boot.ts` 启动，使用数据库领取租约、失败重试和幂等投影，把已结算 `world.match.settled` 事件投影到世界贡献。这证明“结算后自动推进世界聚合”存在。

### 还不能称为完整分布式智能的部分

- `tdg-agent-worker.mjs` 的 `chooseAction` 仍是代码内确定性策略，没有 Codex/LLM/JEV 的策略适配器。
- `worldAgentHeartbeat.ts` 目前是内存纯函数状态和队列，未接持久化任务表、任务领取、模型调用、工具策略和生产审计流。
- Outbox Worker 只消费已经结算的事实，不会自主召集世界 Agent、生成内容、审规则或发布新规则。
- 运行租约只保护单个外部 Agent 的推进者，不等同于世界 Agent scheduler 的任务租约。

因此当前可以准确地说：有确定性 Agent Worker 和结算后世界聚合；尚未有经生产验证的“模型驱动、持久化、可审核、可回滚”的世界 Agent 自动化闭环。

## 前端改造顺序

### P0：先修事实和恢复边界

1. 将房间状态、命令收据、`match_logs` 和 `world_outbox` 设计为同一提交边界或可证明的恢复协议。
2. 先做 `A03/A04/A05/A06`，因为对局、回放、裁判和战报是所有游戏共用的事实投影。
3. 给页面统一 `connectionState`、`receiptState`、`projectionState`、`modelState`，禁止 UI 只显示“成功/失败”二元状态。

### P1：补齐 Agent 与世界自动化

1. `A07`：把 CoI、预算和允许动作做成可解释的权限卡。
2. `A08`：展示 lease、heartbeat、observation、command receipt 和恢复建议。
3. `A09`：把持久化 world-agent scheduler、任务队列、模型适配器、工具策略、审批和审计接入 UI。
4. `A10`：内容/规则包经过 schema、兼容性、审批、灰度和回滚后才进入目录。

### P2：统一长期成长与世界叙事

补 `A01/A11/A12` 的动态事件、奖励和轮回投影；所有叙事文字必须绑定真实事件引用，模型输出和 fallback 明确标识。

## 统一 `GamePackage` 建议

新增游戏不应只加一张页面。每个包应同时提供：

```ts
type GamePackage = {
  definition: GameDefinition
  rulebook: RuleBook
  actionSchema: ZodSchema
  observationSchema: ZodSchema
  eventTypes: readonly string[]
  projectGraphic(view: Viewer): GraphicProjection
  projectText(viewer: Viewer): TextProjection
  replay(events: MatchEvent[]): ReplayState
  worldContribution: WorldContributionMapper
  fallback: { noModel: boolean; noTts: boolean; no3d: boolean }
}
```

前端只消费 `projectGraphic`，Agent/CLI 只消费 `observationSchema`，战报和世界层只消费事件流与 `worldContribution`。这样“游戏接入”“网页展示”“Agent 行动”“世界记忆”不会再次各写一套规则。

## 发布前必须逐项回读

每个首发游戏都要拿同一批真实事件完成：

```text
注册 → 读取规则 → 创建/入座 → 读取 observation → 合法动作
→ 结算 → command receipt → match_logs → world_outbox published
→ 世界贡献 → 回放时间线 → 战报/文字章节 → 刷新/重启后再次读取
```

只通过本地测试、HTTP 200、Compose 配置或历史记录，不能把这条链标为真实上线。公网注册、正式 HTTPS、常驻 Worker、真实 JEV、完整公网整局和重启恢复仍需在目标发布环境单独验收。

