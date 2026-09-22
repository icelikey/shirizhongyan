# 从现在到能玩：落地路线图

本文档基于**实测**而非推测。我在 `localhost:5201` 实际跑了一遍，
下面每条「现状」都是验证过的。

---

## 一、你现在就能玩到什么（已实测）

**单机部分完全可玩。** 实测路径：

```bash
cd app
pnpm install
# 需要 .env 才能启动后端（见第二节）
pnpm dev
```

然后浏览器走：首页 → 缔结契约（三步：报名号 → 选影从 → 印章落定 →
**点「踏入牌局之间」**）→ 落 `/lobby`。

实测确认可玩：

| 游戏 | 路径 | 实测结果 |
|---|---|---|
| 月影狼人杀 | `/game/werewolf/<任意id>` | ✅ 身份发放 → 夜晚 → 白天发言 → 投票，5 个影从同桌 |
| 猜平均数 | `/game/guess/<任意id>` | ✅ 单机可跑 |
| 丹丘牌楼 | `/game/poker` | ✅ 单人爬楼 |
| 碎境爬塔 | `/game/spire` | ✅ 单人战斗 |

契约完成后碎片已发（♠60 ♥30 ♣60 ♦30），存档走 localStorage
（key `ten-days-gambit-profile`），刷新不丢。

### 契约向导有个容易踩的坑

三步向导的最后一步，印章落定后还要点**「踏入牌局之间」**才真正写入存档。
我第一次测时以为点完「缔结契约」就结束了，结果被 LoginGuard 弹回首页。
这不是 bug，但新玩家大概率会卡在这——建议把这个按钮做得更显眼。

---

## 二、阻塞项：必须先解决的两件事

### 1. 没有 `.env`，后端直接崩 ⚠️

**实测现象**：`api/kimi/auth.ts:41` 的 `new URL()` 收到空字符串抛错，
整个后端模块加载失败，大厅的联机功能全部报 500。

原因在 `api/lib/env.ts`：dev 模式下缺失变量返回空字符串而非报错，
于是 `new URL("" + "/api/.well-known/jwks.json")` 抛 Invalid URL。

**解决**：复制 `.env.example` 为 `.env`，Kimi 两个 URL 填合法地址即可
（不走真实登录时不会被调用）：

```env
APP_ID=local-dev
APP_SECRET=local-dev-secret
DATABASE_URL=mysql://root:@127.0.0.1:3306/ten_days_gambit
KIMI_AUTH_URL=https://auth.kimi.com
KIMI_OPEN_URL=https://open.kimi.com
VITE_KIMI_AUTH_URL=https://auth.kimi.com
VITE_APP_ID=local-dev
TYPESAFE_API_KEY=          # 填了才有 AI 裁判，留空则降级本地启发式
```

**建议顺手修掉根因**：让 `env.ts` 在 dev 下给 Kimi URL 一个合法默认值，
而不是空字符串。否则每个新队友都会踩一次。

### 2. 数据库不兼容 ⚠️

**实测现象**：本机跑的是 MariaDB 10.4（3306 端口在监听，root 空密码可连），
但 `drizzle-kit push` 失败——schema 用了 `serial AUTO_INCREMENT`，
这是 MySQL 8 语法，MariaDB 10.4 不认。

**两条路**：

- **推荐**：Docker 起个 MySQL 8（机器上已装 Docker）

  ```bash
  docker run -d --name tdg-mysql -p 3307:3306 \
    -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
    -e MYSQL_DATABASE=ten_days_gambit mysql:8
  # 然后把 .env 的 DATABASE_URL 端口改成 3307
  ```

- 或改 schema 兼容 MariaDB（把 `serial()` 换成 `int().autoincrement()`），
  但要改 7 张表，且以后部署到云上还要再改回来，不划算。

**数据库只影响联机 + 裁判落库**，单机游戏不受影响。

---

## 三、到「能完整玩」还差什么

按依赖顺序，不可跳步：

### P0 · 事件流生产端（一切的前提）

现在 `SdkRoom` 跑对局时用自己的 `submissions`/`history` 数组，
**从不产出 `MatchEvent`，`match_logs` 表从未被写入**。

后果是连锁的：没有事件流 → 没有观战、没有回放、没有情报卡统计、
质询也拿不到真实对局种子（现在暂用「房间码+开局时刻」派生）。

**要做的**：在 `api/games/sdk/runtime.ts` 的关键节点埋点产出事件，
结束时调 `insertMatchLog`（查询层我已写好）。

埋点位置对应已有的 11 种事件类型：

```
入座完成  → matchStart
发身份    → secretAssign（打 secret 标记）
每轮开始  → roundBegin
玩家提交  → action
揭晓      → reveal
淘汰      → eliminate
结算      → matchEnd
```

工作量估计半天。**这是整个项目最关键的一条链**。

### P1 · 狼人杀联机化

现在狼人杀是纯前端引擎（`src/engine/werewolfEngine.ts`，1041 行），
只在浏览器内跑，**不经过服务端**，所以无法多人对战。

要移植成 SDK 模板（实现 `TemplateModule` 接口）。
比其他游戏麻烦，因为它有夜晚私密阶段和自由发言。

### P1 · 观战页 + 裁判席 UI

后端已就绪（`world.matchEvents` 能按视角投影取事件流），
前端零入口。大厅那个「观战」按钮现在是跳到一个新对局，不是真观战。

### P1 · 海盗分金

规则书已写好（`RB_PIRATE`），缺 `TemplateModule` 实现。
可由 `numberGuess` 模板小改复用（提案数额 + 投票通过）。

---

## 四、小游戏怎么选（按对抗类型分类）

你问的「有些只能 Agent 参与，有些只能人参与，有些混合」——
这个分类必须做，因为它决定了房间创建时的座位约束。

### 建议的三档分类

| 档位 | 含义 | 为什么 |
|---|---|---|
| `agent-only` | 只允许 Agent 席 | 需要高速多轮迭代，人跟不上节奏 |
| `human-friendly` | 人机皆可 | 节奏适合人类思考 |
| `mixed-required` | **必须**人机混合 | 玩法核心就是人与 AI 的不对称 |

### 具体游戏归档

| 游戏 | 档位 | 理由 |
|---|---|---|
| 猜平均数 | human-friendly | 5 轮，每轮 30 秒，人能跟上 |
| 红眼病投票 | human-friendly | 规则最简，30 秒讲清 |
| 月影狼人杀 | human-friendly | 经典人局，AI 补位 |
| 海盗分金 | **mixed-required** | 谈判与背叛，人的非理性正是看点 |
| 阿瓦隆 | human-friendly | 全结构化投票，AI 表现比狼人杀更好 |
| **千轮猜数** 📋 | **agent-only** | 1000 轮 level-k 收敛，人类做不到 |
| **拍卖博弈** 📋 | human-friendly | 一轮定胜负，适合暖场 |
| **囚徒困境循环赛** 📋 | **agent-only** | 200 轮迭代看策略演化，观众看曲线 |
| 海龟汤 | **mixed-required** | 需 AI 裁判 + 人出题，天然混合 |

### agent-only 的意义

这是**最能体现「分布式智能」的一档**：人类做不到的事。

千轮猜数里，AI 的 level-k 层级会在上百轮后收敛到纳什均衡附近，
观众能看到一条收敛曲线——这是纯 AI 对抗独有的观赏性。
囚徒困境循环赛更直接：200 轮后哪种策略存活，是可视化的演化过程。

**建议黑客松至少做一个 agent-only 游戏**，否则「AI vs AI」只是
「人的位置换成 AI」，说服力不够。

### 契约层要加的约束

```ts
// contracts/gameSdk.ts 建议新增
export type SeatPolicy = "agent-only" | "human-friendly" | "mixed-required";

interface GameDefinitionBase {
  // ... 现有字段
  seatPolicy: SeatPolicy;
  /** mixed-required 时的最少人类席数 */
  minHumanSeats?: number;
  /** mixed-required 时的最少 Agent 席数 */
  minAgentSeats?: number;
}
```

`SdkRoom.joinAsHuman` / `joinAsAgent` 据此拒绝违规入座。
这个改动很小但必须在契约层做，否则每个游戏各自校验会漏。

---

## 五、真实玩家的 Agent 怎么接入

### 现状：HTTP 接入已完全可用 ✅

四个端点就够，任何语言都能接（`api/agentRouter.ts` 已实现）：

```
agent.register        → 得 tdg_ 前缀 API Key（明文仅返回一次）
agent.gatewayRooms    → 查可见房间
agent.gatewayJoin     → 入座，得 seatToken
agent.gatewayObserve  → 座位视角观测（密态已过滤）
agent.gatewayAct      → 提交动作
```

我这次还加了两个：

```
agent.gatewayRulebook → 读本房间规则书全文
agent.gatewayAppeal   → 发起规则质询（与真人共用同一套裁决）
```

**读规则的能力是质询的前提**——不给 Agent 读条款正文，
「AI 挑战规则」就只是个说法。

### 最小接入示例（待写进 `examples/`）

```python
import requests
BASE = "https://你的域名/api/trpc"
KEY  = "tdg_xxx"
H    = {"x-api-key": KEY}

# 入座
r = requests.post(f"{BASE}/agent.gatewayJoin",
                  json={"json": {"code": "ABCD"}}, headers=H)

# 循环：观测 → 决策 → 行动
while True:
    view = requests.get(f"{BASE}/agent.gatewayObserve",
                        params={"input": '{"json":{"code":"ABCD"}}'},
                        headers=H).json()
    # 你的策略在这里
    value = my_strategy(view)
    requests.post(f"{BASE}/agent.gatewayAct",
                  json={"json": {"code": "ABCD",
                                 "action": {"kind": "submit", "value": value}}},
                  headers=H)
```

**这个示例脚本是隐藏加分项**：评委现场能用 curl 接入一个 Agent，
比任何 PPT 都有说服力。建议 B 号优先做。

### Skill / CLI 接入

你提到「通过 skill 或 cli 接入」——建议这样分：

| 形式 | 适合谁 | 实现 |
|---|---|---|
| **HTTP 裸接** | 会写代码的玩家 | ✅ 已可用 |
| **Claude Code Skill** | 用 Claude Code 的玩家 | 📋 写个 `SKILL.md` 描述五个端点 |
| **npm CLI** | 想快速试的玩家 | 📋 `npx tdg-agent --key xxx --room ABCD` |

Skill 形式最简单：一个 Markdown 文件说明端点与策略接口，
玩家在 Claude Code 里说「帮我写个猜平均数的 Agent 接入 ABCD 房」即可。
**成本几乎为零，但演示效果好**——现场让评委用自己的 Claude 接入。

CLI 形式要发 npm 包，72 小时内不一定来得及，优先级放后。

---

## 六、Agent 的博弈怎么进行

### 现在的机制（已实现）

内置影从（`echo-bot`）用启发式决策：

- `src/engine/agents.ts` 从人设派生参数（aggression / deception / levelK / noise）
- level-k 锚点：`50 × (2/3)^k`，k 由人设决定（bot 随机 1.6–3.6）
- 思考延迟 0.8–2.2 秒（让观众感觉 AI 在"想"）

外部 Agent 则完全自主——平台只给投影后的视图，策略由玩家自己写。

### Jev 带来的新可能（已接入）

实测数据（`npx tsx scripts/jev-smoke.ts`）：

| 判断 | 延迟 | 结果 |
|---|---|---|
| 发言是否自相矛盾 | 311 ms | 矛盾 0.57，识别悍跳 0.88 |
| 质询是否成立（实质） | 755 ms | 支持度 0.75，论据 1.97/2 → 采纳 |
| 质询是否成立（空泛） | 691 ms | 支持度 0.43，论据 0.00/2 → 驳回 |

**这解决了一个现有引擎做不到的问题**：模板引擎能生成发言，
但无法判断「这段话是否自相矛盾」。Jev 可以，而且 300ms 内。

用途有二：

1. 给 `echo-bot` 的投票决策提供真实依据（而非随机）
2. 给真人的辅助提示（建议默认关，否则削弱推理乐趣）

### 快慢分工是架构亮点

```
Jev（系统一）    裁断、分类、矛盾检测、路由     300–800ms
LLM（系统二）    策略规划、长程推理             数秒
```

讲清「为什么裁判不能用 LLM」很有说服力：裁决发生在对局中途，
全场等待，数秒延迟不可接受。这是工程判断，不是技术选型偏好。

---

## 七、美工怎么做

### 现状：视觉体系已相当完整 ✅

我实测截图确认：星云底 + 颗粒噪点 + 金线描边 + 竖排篆字都已到位，
影从立绘质量很高。完整规范见 `DESIGN.md`。

### 必须先解决：素材体积 ⚠️

`app/public/` 里 76 张 PNG 合计 **184MB**，50 张超过 2MB。
整个 git 仓库 186MB，队友 clone 会很慢。

**建仓前先压缩**（`TEAMWORK.md` 第七节有命令），能压到 20–30MB。

### 待补素材（按优先级）

| 优先级 | 素材 | 数量 | 用途 |
|---|---|---|---|
| P0 | 裁判席徽记 | 3 | J0 算律 / J1 明镜 / J2 众议 |
| P0 | 判例卡卡面 | 1 | judicial 唯一稀有度，需明显区别于残章卡 |
| P1 | 观战页幕布 | 2 | 观战的舞台感 |
| P1 | 海盗分金场景 | 1 | ♦ 金壤主场 |
| P2 | 异能图标 | 8→48 | 扩充后需配图 |

### 三个模型怎么分工

| 工具 | 负责 | 派活粒度 |
|---|---|---|
| **Kimi K3** | UI 界面设计方案、布局与视觉稿 | 一次一个页面 |
| **Codex CLI** | 代码级视觉优化、CSS 调整、素材压缩 | 一次一个组件 |
| **Fable 5**（我） | 设计规范维护、跨页面一致性把关 | 全局 |

### 派活给 Codex 的模板

```bash
codex exec "读 DESIGN.md 第八节的硬约束。
优化 app/src/pages/World.tsx 的世界地图视觉（现仅 102 行，偏薄）：
四大陆要有可点击的地域感，生肖进度要可视化。
只改这一个文件，改完跑 pnpm check 确认 0 错误。"
```

**硬约束必须写进 prompt**（`DESIGN.md` 第八节有完整七条），
否则 AI 会引入亮色模式或写死色值，破坏已有的视觉一致性。

### 优先优化的两个页面

`/world`（102 行）和 `/agent`（127 行）明显比其他页面薄
（狼人杀 1146 行、猜数 749 行）。这两页是视觉优化的首选。

---

## 八、剧情怎么构筑

### 现状

- `src/data/lore.ts`（194 行）十卷残章长文
- `contracts/relics.ts`（488 行）把长文切成单句残章卡，按四花色归组
- 集齐一组 4 张 → 显现 truth（塔门口令）

**这个设计很好**：世界观从对局里长出来，不靠「读」来传达。
长文留给愿意细读的人，牌桌上掉落的是单句。

### 待补：三条叙事线

| 线 | 载体 | 状态 |
|---|---|---|
| 主线：十日轮回 | 残章卡拼图 → 塔门口令 | ✅ 已实现 |
| 支线：影从羁绊 | `echoMemoriesJson` 记恩怨 | ⚠️ 有数据无呈现 |
| **暗线：规则演化** | 判例卡 → 规则书版本 | ✅ 后端就绪，缺 UI |

**暗线是最有原创性的**：原著主角在规则内求生，
本游戏的玩家可以修改规则本身。判例卡应该做得有仪式感——
「你改变了世界的规则」值得一个专门的演出。

### 写文案的纪律（已写进 `WORLDVIEW.md`）

1. **自行撰写，不引用原著原文**（原著是别人的作品）
2. 中文优先，文言与白话混用（保持现有调性）
3. 每段不超过三句——牌桌上没人读长文
4. **机制先行**：文案要能解释机制，而不只是装饰

反例：「这是一个充满谎言的世界」（纯装饰）
正例：「明镜不言，只是照见」（解释了 J1 裁判为何不给理由）

---

## 九、部署到云端

### 最小可用方案

```bash
# 构建
pnpm build          # vite build + esbuild 打包 api/boot.ts → dist/

# 运行
NODE_ENV=production node dist/boot.js
```

⚠️ 注意 `env.ts` 在 `NODE_ENV=production` 下会对缺失变量**抛错**
（dev 下只是返回空字符串）。所以部署前必须把所有变量配齐。

### 建议的部署形态

| 组件 | 方案 | 理由 |
|---|---|---|
| 应用 | 单机 Node + PM2 / Docker | 有状态（房间在内存），不能无状态多实例 |
| 数据库 | 云 MySQL 8 | 注意不是 MariaDB，schema 不兼容 |
| 静态资源 | CDN | 184MB 素材走 CDN，别走应用服务器 |

### 有状态是个约束，要提前知道

`SdkRoom` 用内存 `Map<code, SdkRoom>` 存房间，虽然快照会落
`rooms.stateJson`，但**多实例部署会导致房间不同步**。

72 小时比赛：单实例够用，不要引入 Redis 增加复杂度。
赛后若要扩展，再把房间状态外置。

### Agent 持续运行

玩家的 Agent 要 7×24 跑，建议：

```bash
# 玩家侧，不是你们部署
pm2 start my-agent.py --name tdg-agent --restart-delay 5000
```

平台侧要做的是**保证 Agent 断线不影响对局**：
现在超时会用 `timeoutFallback` 兜底提交，这条已实现 ✅。

### 字体离线风险 ⚠️

5 款字体走 Google Fonts CDN。**现场断网会回退到系统字体**，
印章字（Ma Shan Zheng）失效，观感差很多。

赛前 30 分钟自托管到 `public/fonts/` 能解决，现场发现就来不及。

---

## 十、三人分工（对应你的问题）

完整版见 `TEAMWORK.md`，这里只说小游戏部分怎么分。

### 你（A 号）· 规则与裁判

留给你的理由：这是最原创的部分，需要最熟悉架构的人。

- P0 事件流生产端（`runtime.ts` 埋点）
- 裁判席 UI 的后端支撑
- 契约层的 `SeatPolicy` 约束

### B 号 · 小游戏

**天然零冲突**，因为游戏模板走 `TemplateModule` 接口，是插件点。

- 狼人杀联机化（最重，建议优先）
- 海盗分金（规则书已写好，照着实现）
- 千轮猜数 或 囚徒困境循环赛（agent-only，二选一）
- Agent 接入示例脚本 + Skill 文件

### C 号 · 视觉与观战

- 观战页 + 裁判席 UI
- `/world` 与 `/agent` 视觉补强
- 待补素材（裁判徽记、判例卡卡面）
- **素材压缩**（建仓前必做）

### 给 B 号和 C 号的交接材料

直接发这四份文档：

```
ARCHITECTURE.md  架构与三条铁律（必读第二节）
DESIGN.md        视觉规范与硬约束（C 号必读第八节）
TEAMWORK.md      分工、Git 流程、文件归属表
ROADMAP.md       本文档，说清现状与缺口
```

**最重要的是让他们先读三条铁律**（卡牌不改胜负 / 异能只改信息
与时间 / 密态事件只在全知投影）。这三条是架构能扩展的原因，
破了就要重新平衡所有游戏。

---

## 十一、建议的执行顺序

前三步有严格依赖，不能并行：

1. **建 `.env` + Docker MySQL 8** （30 分钟，解除阻塞）
2. **打通事件流落库** （半天，P0，一切的前提）
3. **观战页 + 裁判席 UI** （一天，让机制可见）

之后可并行：

4. 狼人杀联机化（B 号）
5. 海盗分金 + 一个 agent-only 游戏（B 号）
6. 视觉补强 + 素材（C 号）
7. Agent 示例脚本 + Skill（B 号）

### 务必留时间的两件事

- **录屏备份**：现场网络或数据库故障是常见事故
- **字体自托管**：赛前 30 分钟能做，现场发现来不及
