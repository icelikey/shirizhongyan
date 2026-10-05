# 终焉：AI 原生世界运行架构

## 0. 核心判断

终焉只有一套共同事实，但提供两种展现形式：

- **AI 原生文字世界**：Agent 读取见闻、记忆、规则和战报，在文字与协议中持续生活、探索和博弈。
- **图形交互世界**：人类观察世界地图、角色、游戏、卡牌和战斗演出；它是共同事实的可视化投影。

两者不能各自维护一套胜负和世界状态。唯一能写入世界事实的是确定性内核；文字世界和图形世界都消费同一条追加事件流。

```text
玩家/Agent 命令
      ↓
确定性内核：权限、规则、结算、账本
      ↓
Canonical WorldEvent + stateHash
      ├─→ AI 原生文字投影：见闻、战报、记忆、传闻、关系
      └─→ 图形交互投影：地图、角色、动画、卡牌、观战
```

## 1. 三类内容的权威性

| 层级 | 内容 | 是否可以改写事实 |
|---|---|---|
| Constitution | 世界宪法、权限边界、时间和因果原则 | 只能通过治理升级 |
| Canonical state | 玩家、Agent、游戏、生命、积分、卡牌和已结算事件 | 只能由内核追加和结算 |
| Projection | 文字战报、传闻、镜头、音效和 UI 表现 | 不可以 |

JEV 和大模型位于 Projection/Proposal 层：可以解释、归纳、提出策略和内容，但不能直接修改 Canonical state。

## 2. AI 原生文字世界

文字世界保存 Agent 的可用上下文，而不是暴露模型内部思维链：

- 世界公开见闻和地点状态
- Agent 个人记忆和已安装 Skill
- 服务器公共记忆
- 对局公开事件和策略摘要
- 角色关系、承诺、冲突和传闻
- 未解决的问题和候选真相
- Agent 可执行的下一步命令

文字世界中的选择必须经过 `TextWorldGateway` 转成协议命令，再交给世界内核验证。自由文本只作为意图输入，真正改变世界的必须是结构化命令。

## 3. 战报生成流水线

```text
WorldEvent[]
  → 权限过滤与脱敏
  → JEV TacticalDigest
  → 叙事导演 NarrativePlan
  → 大模型 NarrativeReport
  → 事实审计 ReportAudit
  → 文字世界章节与图形时间线
```

JEV 输出结构化战术节拍：事件序号、公开事实、策略类别、转折点、证据引用和不确定性。大模型只负责把这些内容写成小说式战报；审计器要求每个事实性句子都能引用事件或已确认世界资料。

战报保存三个版本：

1. `rawEvents`：原始事件和状态哈希；
2. `tacticalDigest`：JEV 的结构化策略摘要；
3. `narrativeReport`：面向人类阅读的小说式文本。

## 4. 统一事件协议

所有投影均按下列字段同步：

```ts
interface WorldEventRef {
  worldId: string;
  cycle: number;
  matchId: string | null;
  eventSeq: number;
  eventType: string;
  stateHash: string;
  rulebookVersion: string;
  visibility: "public" | "seat" | "judge" | "owner";
}
```

图形投影可以延迟渲染或替换动画；文字投影可以异步生成完整战报，但两者必须绑定同一 `eventSeq` 和 `stateHash`。

## 5. Agent 运行时

Agent 身份、模型、角色和权限分离：

```text
AgentIdentity
  ├─ modelProvider
  ├─ role: explorer | narrator | judge | creator | auditor | scheduler
  ├─ memoryScopes
  ├─ capabilities
  ├─ heartbeatPolicy
  └─ budgetPolicy
```

首批世界 Agent：

- `world-clock`：推进周期和心跳；
- `world-orchestrator`：提出任务、房间和事件入口；
- `content-forge`：生成内容包候选；
- `rule-compiler`：将自然语言规则转换为可验证规则；
- `judge-convener`：召集 3/5/7 名裁判；
- `evidence-auditor`：审计事件和叙事引用；
- `chronicle-writer`：生成文字世界章节；
- `balance-warden`：检查经济、难度和刷取漏洞。

Agent 可以在同一进程中运行，但能力令牌和写入范围必须分离。

## 6. 自扩张闭环

```text
观察事件
  → 发现空白/矛盾/玩家兴趣
  → 生成内容提案
  → Schema 校验与规则编译
  → 沙盒模拟和回放
  → 裁判/审计/平衡检查
  → 灰度发布
  → 玩家与 Agent 使用
  → 事件写回世界记忆
  → 下一轮内容生成
```

每个内容包必须有唯一 ID、依赖、触发条件、权限、奖励、事件格式、来源、审查记录、哈希、版本和回滚状态。

## 7. 当前实现顺序

1. 统一 `WorldEvent`、`TacticalDigest`、`NarrativeReport` 和双投影契约；
2. 让游戏运行时真实产出完整事件流；
3. 接入 Agent heartbeat 和提案队列；
4. 接入 JEV 战术摘要与战报审计；
5. 接入内容包沙盒、裁判和灰度发布；
6. 最后扩展更多游戏、地图和美术表现。

## 8. 验收标准

- Agent 可以在没有人工逐步操作的情况下持续运行；
- Agent 的文字世界行为能产生真实、可回放的世界事件；
- 同一事件可以同时生成文字战报和图形时间线；
- 战报不能引用不存在的事件；
- 文字世界不能绕过内核修改胜负；
- 新内容经过沙盒和审计后才可发布；
- 事件回放可重建相同状态哈希；
- 图形界面关闭后，文字世界仍能继续运转。
