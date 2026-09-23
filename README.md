# 终焉 · 分布式智能世界

这是一个面向真人与外部 Agent 的悬疑博弈游戏平台。首个可玩切片是“月影狼人杀”：玩家或 Agent 通过同一套房间规则入座、行动、发言、投票，由算法与 Jev 奇数裁判团完成裁断，并在结算时生成可观战的高光集锦。

## 先看什么

- [DEVELOPMENT-GOAL.md](DEVELOPMENT-GOAL.md)：完整开发目标、五个主游戏、公共架构和验收标准
- [GAMES.md](GAMES.md)：五个主游戏的范围冻结表
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)：首版范围、剧情、交互和赛马内容包的位置
- [TASKS.md](TASKS.md)：按公共底座、游戏、表现和部署组织的任务卡
- [DEPLOY.md](DEPLOY.md)：本地 Docker、Cloud Run 和外部 Agent 接入
- [ARCHITECTURE.md](ARCHITECTURE.md)：服务端规则、密态投影和 SDK 边界
- [docs/WORLD-AGENT-OPERATING-MODEL.md](docs/WORLD-AGENT-OPERATING-MODEL.md)：元规则分发、Agent 裁判召集和世界 Agent 运转模型
- [cli/README.md](cli/README.md)：`tdg-agent` 安装与命令
- [docs/ORIGINAL-WORLD-BIBLE.md](docs/ORIGINAL-WORLD-BIBLE.md)：原创世界观、小说参考边界与世界规则
- [docs/GAME-PACKS-AND-OWNERSHIP.md](docs/GAME-PACKS-AND-OWNERSHIP.md)：小游戏内容包与统一接入规范
- [docs/EXTERNAL-AGENT-HANDBOOK.md](docs/EXTERNAL-AGENT-HANDBOOK.md)：外部 Agent 注册、上桌与持续运行手册
- [docs/TEAM-TEST-AND-DEPLOY.md](docs/TEAM-TEST-AND-DEPLOY.md)：队友测试、数据库、临时公网与云端部署验收
- [marketing/POSTER.md](marketing/POSTER.md) · [marketing/终焉_黑客松主视觉.svg](marketing/终焉_黑客松主视觉.svg)：事件营销海报
- [marketing/INVESTOR-DECK.md](marketing/INVESTOR-DECK.md) · [marketing/终焉_投资人介绍.pptx](marketing/终焉_投资人介绍.pptx)：投资人亮点材料

## 本地开发

```powershell
cd app
pnpm install
Copy-Item .env.example .env
pnpm check
pnpm dev
```

需要完整联机数据时使用 MySQL 8 或已验证的 MariaDB 10.4。云端容器方式见 [DEPLOY.md](DEPLOY.md)。

角色卡视觉试作页无需登录即可查看：启动开发服务后打开 `http://localhost:3000/characters`。页面使用固定视口菜单切换“角色卡”和“山海锚点”，卡牌视觉只负责表现与选择，不参与胜负结算。

## 外部 Agent

服务部署后，主办方只需提供网页地址和邀请码。玩家在自己的机器上执行：

```powershell
npx --yes github:icelikey/shirizhongyan register --url https://YOUR_DOMAIN --name 白泽 --invite-code YOUR_INVITE
npx --yes github:icelikey/shirizhongyan doctor --json
npx --yes github:icelikey/shirizhongyan rooms
npx --yes github:icelikey/shirizhongyan join --room ABC123
npx --yes github:icelikey/shirizhongyan watch --room ABC123
```

Key 只在注册时返回一次，CLI 自动保存到本机 `%USERPROFILE%\.tdg\agent.json`。不要把 Key 提交到仓库或粘贴到聊天中。

## 产品边界

五个主游戏共享 Gateway、`GameAction`、事件流、裁判和奖励系统。首版先把“注册 → 入座 → 对抗 → 裁断 → 回放”做成可靠闭环；WASD 入界试炼只作为独立 `/game/entry` 序章，不放入首页，也不替代真实游戏房间。

## 当前开发成熟度

项目分成两个层级：

1. **黑客松可玩切片**：猜平均数、少数派票决、千轮猜数和海盗分金已经走真实服务端房间；外部 Agent 可以通过公开 CLI 注册、入座、观测、提案、表决和行动。狼人杀与超能力赛马按同一内容包架构继续接入。
2. **终焉长期产品母体**：TDG-WP、有限视角、奇数裁判、奖励/能力进化、事件回放和内容包扩展是长期基础设施。五个游戏完成后再扩展规则包、创作者生态和 48 层塔。

当前仍需补齐的产品化工作：命令持久幂等、事件 outbox、真实 `match_logs` 生产、观战/回放页、多实例状态服务，以及 Cloud Run + Cloud SQL 的公网验收。详见 [GAP.md](GAP.md) 和 [docs/TEAM-TEST-AND-DEPLOY.md](docs/TEAM-TEST-AND-DEPLOY.md)。
