# 当前任务单

任务按“能现场玩完一局”排序。每张卡都可以直接转成 GitHub Issue；认领后在标题末尾写负责人和分支。

## P0：必须完成

### TDG-001 · 云端安装包与生产启动

负责人：A 号。文件：`app/Dockerfile`、`docker-compose.cloud.yml`、`deploy/`、`app/api/boot.ts`。

完成标准：Node 20 镜像能构建；容器监听 `0.0.0.0:$PORT`；`/api/health` 返回 200；Compose 使用 MySQL 8 并有健康检查；Cloud Run 脚本固定单实例；秘密配置只通过本地 env 或 Secret Manager 注入。

### TDG-002 · 公开 Agent 注册与持续访问

负责人：A 号。文件：`app/api/agentRouter.ts`、`app/api/queries/agentRegistration.ts`、`app/api/games/sdk/runtime.ts`、`cli/`。

完成标准：

- `tdg-agent register --url ... --name ... --invite-code ...` 成功后本机保存 Key。
- `rooms → join → watch → act` 能完成一次行动循环。
- CLI 重启后再次 `join` 返回原座位，不重复占位。
- `doctor --json` 能区分服务不可达、Key 缺失和 Key 无效。
- 任意错误输出都不回显完整 Key。

### TDG-003 · 月影狼人杀状态机

负责人：B 号。文件：`app/src/engine/werewolfEngine.ts`、`app/api/games/`、`contracts/`。

完成标准：六席局支持身份分配、夜晚行动、白天发言、投票、出局、胜负和回放事件；四种人/Agent 组合各有一条可复现的烟测；任何席位只能看到自己的密态信息。

### TDG-004 · 结构化发言、Jev 裁判与语音事件

负责人：B 号。文件：`app/api/world/jevJudge.ts`、`app/api/world/jev.ts`、`app/contracts/`、语音 provider 适配层。

完成标准：发言由选择卡生成意图、目标和短文本；Jev 分析可信度、矛盾和回应关系；裁判数只能为 3/5/7；MiniMax 或其他 TTS provider 通过统一接口接入；TTS 失败回退字幕/浏览器语音；所有发言产生 `SpeechEvent`。

### TDG-005 · 观战与新手引导

负责人：C 号。文件：`app/src/pages/`、`app/src/components/game/`、`app/src/data/`。

完成标准：首次进入显示四步引导（入座、选身份策略、发言、投票）；观众页能看到公开事件、裁判席和音频状态；玩家私密视角与全知观战视角不能混淆；结算页出现残章、判例卡和 Agent Reel 入口。

### TDG-006 · 四天现场演示脚本与故障兜底

负责人：全员，A 号收口。文件：`DEPLOY.md`、根目录演示说明。

完成标准：新机器按文档能启动；预置六个测试账号可用；Jev、TTS、数据库和网络任一缺失时仍有明确降级；评委只拿到网页地址、测试账号或邀请码即可参加一局。

## P1：主线稳定后再做

### TDG-010 · `♦ 金壤 · 超能力赛马` 内容包

保留现有 `contracts/beastRace.ts` 与赛道数据。补模板执行器、事件演出、100 格赛道、技能卡因果链和观战集锦。验收重点是“飞行 → 被击落 → 反击”的可解释事件链，而不是只播放特效。

### TDG-011 · `♥ 丹丘 · 达芬奇密码`

补升序约束概率函数、公开信息推理和热力图；概率必须是纯函数并有独立测试。

### TDG-012 · `♠ 玄渊 · 规则辩论`

补模糊议题、交叉质询、奇数裁判团和 Jev 理由，用于展示 Agent 真正驱动玩法。

### TDG-013 · `♦ 金壤 · 海盗分金`

补联盟、提案、表决和背叛，作为多人谈判内容包。

## 不接收的实现方式

- 不把多个小游戏复制成多个独立服务。
- 不用前端脚本决定身份、胜负或隐藏信息。
- 不把 LLM 的自由文本直接当作合法动作；先归一化成 `GameAction`。
- 不把《十日终焉》的原文、人物和台词直接复制进产品；只保留倒计时、隐藏身份、规则质询、反转等结构性体验，并写成原创内容。
- 不把真实 API Key、数据库密码、邀请码提交到仓库。
