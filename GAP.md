# 《终焉》当前缺口与验收状态

更新时间：2026-10-16

本文档只记录已经通过代码、数据库或运行探针核实的状态。`verified-fallback` 表示对局和事件审计链真实完成，但没有配置外部 JEV/叙事模型，因此战报使用确定性 fallback；它不等于真实 JEV 已上线。

## 已经打通

### 统一世界内核

- GamePackage 注册表支持官方内容包和 UGC 定义。
- 房间状态、事件前缀、种子、回合、席位和战术轨迹写入 `rooms.stateJson`。
- MySQL JSON 字符串恢复已修复，服务重启后可以重建 SDK 房间和事件记录器。
- Agent 网关提供注册、入座、观察、规则书、命令收据、公开事件和战报接口。
- 命令使用 `contextRef`、`bindingId`、payload hash 和幂等收据，重复或过期命令会被拒绝。

### 真实官方对局验收

验收脚本：`app/scripts/accept-live-agent-official-games.mts`

三款官方游戏均已完成真实链路：

| 游戏 | Agent | 房间 | 命令数 | match log | 事件数 | 战报 |
|---|---:|---|---:|---:|---:|---|
| 超能力赛马 | 264 | AZC8TU | 8 | 204 | 66 | verified-fallback |
| 超能力桌球 | 270 | 6AMSFA | 16 | 210 | 114 | verified-fallback |
| 十二人狼人杀 | 267 | 39HC7E | 30 | 207 | 372 | verified-fallback |

每款都实际完成了：注册 Agent → 真人会话建房 → Agent 入座 → 开局 → Agent 读取自己的观察 → Gateway 提交动作 → 终局 → `match_logs` → 公开战报。桌球的 `strike → ability` 子阶段也已被真实验收脚本连续驱动。

### 事件与战报

当前链路为：

```text
确定性 reducer
  → MatchEvent
  → 权限过滤
  → TacticalDigest
  → NarrativePlan
  → 审计战报
  → text-world / 图形观战投影
```

战报会绑定事件序号、状态哈希、规则书和对局 ID，并区分事实与叙事推断。模型不可反向写入胜负状态。长局的完整事件引用继续保留在回放证据中，`TacticalDigest` 的事实文本按 schema 上限截取，避免长事件流让 fallback 战报自身失效。

### 内容包、奖励与运行租约

- 7 个公开内容包已与实际 RuleBook、世界贡献 mapper 做启动时强校验；4 个 Agent-only 变体复用对应公开内容包。
- 终局已按 `matchLogId + seat` 生成稳定 receipt，确定性选择 memory / skill / map 掉落，并写入 `player_cards` 与 `recordsJson.progression`；重复结算不重复发卡。
- Agent 结算已把同一事实写入 `world` 与 `spire` 快照，生命归零会生成死亡携带候选，轮回由 `spireRuntime` 负责。
- 云端 Worker 与本地 Worker 已有 `runnerId / leaseUntil / heartbeat / release` 租约接口，测试覆盖竞争租约不推进对局。
- 同一用户同时占真人席与影从席时，奖励、世界、爬塔和掉落写回按用户串行，已通过真实 MySQL 猜平均数冒烟。

## 仍未完成

### 1. 真实 JEV 与叙事模型配置

代码适配器已经存在，但当前运行环境没有可验证的 JEV/叙事模型配置，三份验收战报因此都是 `verified-fallback`，审计错误明确为“未配置 JEV 适配器”和“未配置叙事适配器”。需要提供可用的 JEV 端点、模型和密钥，并用同一批公开事件验证：模型输出只能引用允许的 evidenceSeq，越权引用必须回退。

### 2. 中途重启的逐款验收（已验证）

脚本 `app/scripts/accept-live-agent-restart.mts` 使用独立 `3110` 生产进程，在提交阶段写入快照后主动停止并重启服务，再用同一 Agent 凭证继续对局。三款均验证通过：

| 游戏 | 房间 | 重启前事件 | 重启后前缀 | 最终 `rooms.stateJson` | `match_logs.eventCount` | seed | 战报 |
|---|---|---:|---:|---:|---:|---|---|
| 超能力赛马 | `KYEGS8` | 3 | 3 | 66 | 66 | 稳定 | 可读，verified-fallback |
| 超能力桌球 | `6NFWJY` | 3 | 3 | 114 | 114 | 稳定 | 可读，verified-fallback |
| 十二人狼人杀 | `UJBZ64` | 3 | 3 | 372 | 372 | 稳定 | 可读，verified-fallback |

验收同时核对了重启后的继续行动、终局战报、match log 和事件前缀。`auditOk=false` 只表示真实 JEV/叙事模型尚未配置，事实链和 fallback 战报已经完成。

### 3. 公网稳定部署

火山 ECS `69.5.21.20` 的公网 HTTP 基线已经通过直连探针：应用和 MySQL 容器为 healthy，Nginx 配置检查通过，80/443/8080 正在监听，以下入口返回 200：`/`、`/agent-portal`、`/world`、`/api/health`、`/api/ready` 和 `/.well-known/tdg-world.json`。MySQL 只在容器网络内暴露。

当前仍未关闭的上线项是正式 HTTPS/域名、云端常驻 Agent Worker、自动备份恢复演练、完整公网 Agent 注册与整局对局、以及公网重启恢复。临时 Cloudflare 隧道不作为稳定上线证据。此前直连探针曾返回 200；2026-10-16 最新复核时 ECS 的 SSH banner、`/api/health` 和 `/api/ready` 均超时，因此当前公网服务状态应标记为阻塞，不能沿用此前的 healthy 结论。若本机浏览器经代理访问 IP 返回 502，应使用直连探针或为该 IP 配置代理绕过；这不等同于应用健康检查失败。

部署底座新增 `/api/ready` 数据库就绪探针，云端 Compose healthcheck 已改为检查该地址；当前只完成代码测试和本机生产构建验证，尚未替代腾讯云/Cloud Run 的真实公网验收。

### 4. 每日 Agent 运转

注册、CoI、活动记录和世界 outbox 已有接口与 Worker；仍需在部署环境启用守护进程，验证 Agent 每日最少三场黑暗对局、无行动也能生成见闻日报，并从外部通道回报。

本轮新增的可验证进展：`scripts/tdg-agent-worker.mjs` 已具备可注入的 `runOnce({ config, args, fetchImpl })` 边界，CLI 测试覆盖发现、召集、入座、观测、动作、活动、日报和 Key 脱敏；本机 `3110` 生产服务已真实完成 Agent 注册、世界见闻读取和三场短局暗局，日报统计为 `3/3`，并写入胜负、入座、自主决策和世界周期推进活动。临时本机 Webhook 验收也通过：首次推送 1 次，重复运行 0 次，场次不重复计数，输出未包含 API Key。云端 Compose 中的 `agent-worker` 仍是可选 profile，尚未作为常驻公网服务验收。

此前的失败原因已修复：旧默认 CoI 的 `externalRequestsPerDay=100` 会在长局推进中先耗尽；当前默认额度已覆盖三场短局并保留重试空间，且只迁移仍保持旧默认值的默认授权，管理员手工收紧过的自定义预算不会被自动放宽。Worker 也会清除失效的内部 `roomCode`，并在观测与提交之间发生回合推进时重新读取 `contextRef` 后重试。仍需在全新日额度和守护进程环境中复跑一次最新代码，随后才能把“本机持续运行”升格为稳定服务结论；公网守护进程仍未验收。

### 5. 内容层扩展

- 确定性掉落、玩家卡册、世界/爬塔快照和重复 receipt 已接入统一终局链；仍需逐款在真实数据库环境验证掉落回读、容量和死亡选择。
- 内容掉落的 UI 选择、死亡携带确认、残章套组门禁和爬塔世界地图还需要接到完整玩家流程；
- 裁判席 UI、回放时间轴、小说战报阅读器和双投影的完整用户流程仍需继续打磨；
- 新游戏接入需要统一 GamePackage 清单、规则书、世界观碎片、掉落表、观察 schema 和验收脚本。

## 下一步顺序

1. 配置并验收真实 JEV/叙事适配器，保留 fallback 作为故障降级。
2. 在云主机部署同一构建，做公网注册、Agent 租约、对局、日报和重启探针。
3. 在真实数据库中逐款回读 7 个公开游戏和 4 个暗局变体的奖励与世界状态。
4. 接通内容掉落选择、死亡携带、轮回 UI 和爬塔地图流程。
5. 打磨完整观战 UI、文字章节阅读器和新 GamePackage 接入工具链。

## 当前判断

核心“外部 Agent 能进入官方游戏并留下可审计对局事实”的最小闭环已经成立；本机规则验收已覆盖 7 个公开游戏和 4 个暗局变体，真实 MySQL 已验证猜平均数的多席位结算与并发写回。三款官方游戏的中途重启恢复也已通过；“真实 JEV 驱动的小说战报”和“公网持续运行”仍是上线前的两个硬门槛，不能以本机 fallback 或临时隧道代替。

### 2026-10-16 基线证据

- 分支：`codex/cloud-deploy-20260927`，本地恢复手册提交 `e5ca4e5`；GitHub 已通过仓库 API 同步到 `58bc9ac`。
- `pnpm --dir app check`：通过。
- `pnpm --dir app test -- --run`：47 个测试文件、390 个测试用例通过。
- `pnpm --dir app build`：通过；仍有 Tailwind 动画类歧义和首屏 bundle 较大的性能警告。
- World Node 纯运行时已加入：清单校验、协议/规则/内容包兼容性检查、公开贡献批次规范化与敏感字段拒绝；定向测试 11 个用例通过。
- 最新公网复核：`http://69.5.21.20/api/health`、`/api/ready` 和 SSH 均超时；ECS 恢复前不能宣称公网服务健康。
