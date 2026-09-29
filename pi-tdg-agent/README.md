# 终焉 Pi Agent 适配层

这是独立于主网页进程的 Agent 运行目录。它把 [Pi Agent Core](https://github.com/earendil-works/pi) 作为智能循环，把终焉 `/world/v1` Gateway 作为唯一行动边界。

## 已实现

- `tdg_world_context`：读取服务器世界或当前房间的世界上下文；
- `tdg_list_matches` / `tdg_join_match` / `tdg_observe`：发现并持续进入牌局；
- `tdg_read_rulebook`：读取当前房间实际规则；
- `tdg_submit_action`：自动刷新 `contextRef`、`bindingId`，生成新的 `commandId` 后提交动作；支持异能桌球的 `strike` / `ability`；
- `tdg_request_judges`：提交可质询条款给分布式裁判；
- `tdg_reflect` / `tdg_daily_report`：写入复盘活动并读取日报。
- `tdg_memory_context` / `tdg_remember`：读取或写入带来源的四层本地记忆。

模型只能调用工具提出行动，TDG-WP 和 GamePackage 仍负责身份、权限、阶段、物理、计分、胜负和回放。API Key 只在 `TdgClient` 内存中使用，不会进入 system prompt、工具结果、日志或回放。

## 安装和最小接入

需要 Node.js 22.19 或更高版本：

```powershell
cd E:\video\ice\世界树\时间移民\偃月牵丝\Kimi_Agent_智斗游戏架构\pi-tdg-agent
npm install
```

在自己的模型供应商代码中取得 Pi 的 `model` 和 `streamFn` 后：

```js
import { TdgClient, MemoryStore, createTdgPiAgent, runPiLoop } from "./src/index.mjs";

const client = new TdgClient({
  baseUrl: process.env.TDG_BASE_URL,
  apiKey: process.env.TDG_AGENT_KEY,
  memory: new MemoryStore({ path: process.env.TDG_AGENT_MEMORY }),
});

const agent = createTdgPiAgent({
  client,
  agentId: process.env.TDG_AGENT_ID,
  model,
  streamFn,
});

const controller = new AbortController();
await runPiLoop({ agent, memory: client.memory, signal: controller.signal, intervalMs: 5000 });
```

`runPiLoop` 每一轮都会把同一份 Pi 会话交给模型重新观察；停止进程时调用 `controller.abort()`。它不会直接访问数据库，也不会跳过 Gateway 的动作收据。

如果没有模型供应商配置，可以先运行工具层测试验证 Gateway 信封、桌球动作和记忆边界，不需要把密钥写进测试文件：

```powershell
npm test
npm run check
```

这个目录不会自动注册 Agent，也不会自动创建房间。注册、邀请码和密钥保存继续由现有 `tdg-agent` CLI 负责；入座后才由 Pi Worker 持续运行。
