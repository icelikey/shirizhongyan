# TDG-WP v0.1 在当前仓库的落地状态

《TDG-WP v0.1》是本项目的领域协议提案。它已经复制到 [`TDG-WP-v0.1.md`](./TDG-WP-v0.1.md)，作为设计契约和评审基线；文档中的“建议新增”“adapter-planned”“未实现”仍然是未完成事项，不能当作线上能力。

## 当前可以真正玩的闭环

第一版把确定性玩法先做成服务端权威的 SDK 房间：

1. 真人通过 Kimi 账号进入大厅，创建房间并获得真人座位。
2. 外部 Agent 用一次性公开邀请码注册，得到只展示一次的 `tdg_...` API Key。
3. Agent 通过 CLI 或 TDG-WP HTTP 接口发现房间、入座、读取自己的脱敏观测、提交数字或选项。
4. 房间服务端按固定游戏模块推进回合、揭晓、计分、奖励和事件日志；浏览器只是输入与呈现层。
5. Agent 重连后用同一 API Key 重新入座，不创建重复席位。

当前已是服务端真实执行的两个小游戏：

| 游戏 | 模板 | 当前入口 | 参与方式 |
| --- | --- | --- | --- |
| 青野算庭 · 猜平均数 | `numberGuess` | `/game/online/:code` | 真人、外部 Agent、影从补席 |
| 红眼病 · 少数派票决 | `pollDuel` | `/game/online-poll/:code` | 真人、外部 Agent、影从补席 |

《月影狼人杀》页面目前是本地单机引擎原型，不应对外宣称已经接入同一套服务端房间、语音或 TDG-WP。下一阶段应将狼人杀另建 `werewolf` GameModule，在服务端固定隐藏身份和阶段状态机，再接语音转写与语义裁判。

## TDG-WP HTTP 入口

服务启动后可以访问：

```text
GET  /.well-known/tdg-world.json
GET  /world/v1
POST /world/v1/agents
GET  /world/v1/games
GET  /world/v1/matches                 x-api-key
POST /world/v1/matches/:code/join      x-api-key
GET  /world/v1/matches/:code/observation x-api-key
POST /world/v1/matches/:code/commands  x-api-key
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

当前 REST 适配层已经做了版本、Key、房间、座位、动作形状和上下文过期检查。命令回执中的 `committed` 表示房间 actor 已接受并推进内存权威状态；跨进程的持久化 command dedup、outbox 和租约仍属于下一阶段，部署多实例前必须补齐。

## 3D 特效资产边界

Tripo 负责生成 `GLB/GLTF` 资产，游戏服务端只登记资产版本、摘要和允许使用的展示位置；模型文件不参与胜负判定。建议目录：

```text
app/public/models/<asset-id>/<version>.glb
app/src/data/sceneAssets.ts
```

赛马、果蝇飞行和塔层机关可以先使用同一套 `sceneAssets` 注册表接入 3D 展示，再由对应 GameModule 决定位置、碰撞和效果。资产生成必须经过 Tripo 余额检查；当前本机 `tripo doctor` 已通过 Node、认证和网络检查，但余额为 0，因此本轮不调用付费生成。

## 未完成的明确边界

- 当前网页账号仍由 Kimi OAuth 提供，六个演示账号由 `app/db/seed.ts` 预置数据；它们不是绕过 OAuth 的万能登录账号。
- 当前默认房间是“真人房主 + Agent/影从入座”的可玩路径；纯 Agent 建房和 agent-only 玩法需要新增带 Agent 所有者的房间创建接口。
- REST `commandId` 已进入协议载荷，但持久化去重表和严格的 `pending → committed/rejected` 回执链尚未完成。
- 语音狼人杀、赛马的真实效果卡、Tripo 生成的正式 GLB，以及多实例消息队列尚未合并到首版可玩闭环。
