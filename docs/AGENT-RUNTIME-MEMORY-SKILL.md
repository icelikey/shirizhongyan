# 《终焉》Agent Runtime：记忆、Skill 与持续运转

## 目标

《终焉》接入外部 Agent 的核心不是提供一个聊天窗口，而是让一个带身份、记忆、Skill 和 CoI 权限的影从，能够在服务器世界中持续观察、行动、失败、复盘并向玩家汇报。

参考诺拉酒馆这类本地 Agent 整合包时，借鉴的是“人格配置、记忆加载、Skill 调度、常驻运行”的运行时逻辑。酒馆 UI、角色卡格式和模型供应商不是《终焉》的规则内核，也不能替代 Gateway 的权限与结算。

## 运行边界

```text
玩家 / 外部 CLI / Pi Agent
          │
          ▼
Agent Runtime
身份 · 记忆 · Skill · 每轮计划 · 日报
          │ 只提出候选行动
          ▼
TDG Gateway
API Key · CoI · 入座绑定 · contextRef · commandId
          │ 只接收合法命令
          ▼
GamePackage / RuleBook / 确定性内核
阶段 · 物理 · 计分 · 胜负 · 回放 · 奖励
          │
          ├── Agent 活动流 / 每日简报
          └── Outbox → 世界贡献 → 世界纪元
```

模型可以解释观测、提出行动、生成复盘和 Skill 候选；模型不能直接写数据库、修改胜负、读取别人的隐藏信息、伪造 CoI 或跳过合法动作校验。

## 四层记忆

Pi 适配层的 `src/memory.mjs` 提供本地、可持久化的四层记忆仓。每条记录都带 `source`、`eventId`、`createdAt`、`confidence` 和 `visibility`，因此可以回答“这段记忆从哪来、是否已经验证、谁能看到”。

| 记忆层 | 保存内容 | 典型来源 | 生命周期 |
| --- | --- | --- | --- |
| `working` | 当前观测、当前房间、待处理危机、短期假设 | 本轮 observation、Worker | 可过期、容量最小 |
| `episodic` | 牌局、失败、死亡、奇遇、战报摘要 | `gateway.match.settled`、战报 | 长期保留，按容量裁剪 |
| `semantic` | 已验证的世界锚点、公开见闻、裁判判例 | 世界事件、RuleBook、裁判 | 只写入有来源的事实 |
| `procedural` | 自身 Skill、策略模板、触发条件和代价 | 对局复盘、官方 Skill | 需要再次验证才能升级 |

### 写入规则

1. 记忆不能只写一段没有出处的模型文案，至少要有事件来源和事件编号。
2. `semantic` 只表达已经从 Gateway、RuleBook、裁判收据或公开世界事件得到的内容；猜测应留在 `working`。
3. `procedural` 是 Skill 候选，不是绕过规则的权限。它必须在下一次行动前重新经过当前 RuleBook 和 CoI 检查。
4. 本地记忆不等于服务器世界事实。服务器状态、对局收据和 Outbox 事件优先级更高。
5. 记忆仓拒绝 `tdg_...`、`sk-...`、Authorization 等凭据，也拒绝保存思维链和内部推理过程。

## 一个完整运行周期

```text
启动
  → 读取本地身份与记忆
  → GET /world/v1/world/state
  → GET /world/v1/matches
  → 幂等 POST /matches/:code/join
  → GET /observation + /rulebook
  → Agent 根据记忆提出候选行动
  → Gateway 刷新 contextRef / bindingId 并校验 CoI
  → GamePackage 确定性结算
  → 保存经历 / Skill 候选 / 世界见闻
  → 每日生成 Agent 报告
```

没有房间时，Agent 仍可读取世界公开见闻并保存 `semantic` 记忆；读取、等待、策略计算不计入黑暗对局。每日三场暗局只能由服务端已结算的牌局完成，日报显示 `x/3`。

## Skill 生命周期

```text
对局经历
  → 复盘中提取候选
  → 标记来源、触发条件、目标游戏、代价和风险
  → 在下一局由 RuleBook / CoI 再校验
  → 记录有效结果
  → 达到证据门槛后升级为个人 Skill 或官方 Skill
```

Skill 建议至少包含：

```json
{
  "id": "skill-echo-lure-v1",
  "trigger": "对手连续追随上一轮公开选择",
  "action": "在允许的行动窗口使用伪信卡",
  "scope": ["pollDuel"],
  "cost": { "action": 1, "cooldown": 2 },
  "evidence": ["match-log-...", "ruling-..."],
  "status": "candidate"
}
```

官方 Skill 可以提供额外信息、提醒或有限的盘外招，但它仍然必须声明适用游戏、CoI 范围、次数、冷却和失败代价。Skill 不能直接改写结果。

## CLI、Pi 和常驻 Worker 的分工

- `cli/tdg-agent.mjs`：明确、可审计的人工命令入口，适合注册、诊断、观察和一次性动作。
- `pi-tdg-agent`：把 `@earendil-works/pi-agent-core` 的模型循环接到同一个 Gateway；模型只通过 `tdg_*` 工具行动。
- `scripts/tdg-agent-worker.mjs`：不依赖网页的常驻巡游进程。它会读取见闻、发现房间、幂等入座、提交合法动作、写活动并生成日报；当前也会把世界见闻、策略动作和终局摘要写入四层记忆。
- `app`：世界服务器、Gateway、规则书、数据库、Outbox 和网页展示，是最终权威。

因此“Agent 注册成功”只代表身份创建；“入座成功”代表获得房间绑定；“持续运行”还必须有周期日志、活动流、记忆写入和日报证据。

## 世界自主运作

```text
玩家 / Agent 的合法行动
  → 对局终局
  → match_logs 与 world.match.settled 同事务写入
  → world_outbox 租约消费
  → 版本化 GamePackage 映射
  → world_contributions
  → world_epochs 聚合
  → 下一轮公开见闻、线索、判例和可用内容
```

这里的“涌现”来自可追溯事件、不同玩家与 Agent 的选择、版本化映射和世界聚合；不是让一个大模型凭空宣布世界已经发生了某件事。

## 最小接入示例

```js
import { TdgClient, MemoryStore, createTdgPiAgent, runPiLoop } from "./src/index.mjs";

const memory = new MemoryStore({
  path: process.env.TDG_AGENT_MEMORY || "~/.tdg/agent-memory.json",
});
const client = new TdgClient({
  baseUrl: process.env.TDG_BASE_URL,
  apiKey: process.env.TDG_AGENT_KEY,
  memory,
});

const agent = createTdgPiAgent({
  client,
  agentId: process.env.TDG_AGENT_ID,
  model,
  streamFn,
});

await runPiLoop({ agent, memory, intervalMs: 5000 });
```

真实部署时请使用绝对路径；不要把 API Key 放进代码、提示词、日志、记忆、URL 或 Git。
