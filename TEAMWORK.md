# 三人协作规范（黑客松）

---

## 一、当前最紧急的问题 ⚠️

**这 4 万行代码原先没有任何版本控制。**

原状况：项目嵌在 `E:/video/ice` 仓库内，而该仓库的 `.git/info/exclude`
第 60 行把 `**/app/` 整个排除了，且它的 remote 指向一个不相关的 TTS 项目。
**等于零备份、零历史、无法协作。**

已处理：本目录已 `git init`（main 分支）+ 写好根级 `.gitignore`。
**还需你做一步**：建远程仓库并推送（见下节）。

---

## 二、立即执行：建仓推送

```bash
cd "E:/video/ice/世界树/时间移民/偃月牵丝/Kimi_Agent_智斗游戏架构"

# 1. 确认忽略规则生效（node_modules 不应出现）
git add -A
git status --short | head -20
git status --short | wc -l        # 应在 400 行左右，不该有上万行

# 2. 首次提交
git commit -m "chore: 十日牌局项目初始化，纳入版本控制"

# 3. 建远程（GitHub 网页建空仓库，勿勾选 README）后关联
git remote add origin https://github.com/<你的账号>/ten-days-gambit.git
git push -u origin main
```

⚠️ **推送前务必确认** `git status` 里没有 `.env`。该文件含数据库密码与
`APP_SECRET`，已在 `.gitignore` 里，但值得手动再看一眼。

---

## 三、按契约层切分的三人分工

分工的核心原则：**沿 `contracts/` 切，而不是沿页面切**。
理由是契约层已经把前后端解耦，各人改自己那侧不会冲突。

### A 号 · 规则与裁判（后端，你自己）

**为什么你做**：这是项目最原创的部分，也是评委的关注点，需要最熟悉架构的人。

| 任务 | 文件 | 优先级 |
|---|---|---|
| RuleBook 契约定义 | `contracts/rulebook.ts`（新建） | P0 |
| 事件流生产端：`SdkRoom` 写 `MatchEvent` | `api/games/sdk/runtime.ts` | P0 |
| `match_logs` 落库查询层 | `api/queries/matchLogs.ts`（新建） | P0 |
| 裁判团投票 + 3/5/7 法定人数 | `api/world/judges.ts`（新建） | P0 |
| 质询 API 端点 | `api/worldRouter.ts`（新建） | P1 |

**不要碰**：`src/` 下任何文件、`DESIGN.md`。

### B 号 · 小游戏与 Agent 接入（后端/引擎）

**为什么独立**：游戏模板走 `TemplateModule` 接口，是天然的插件点，零冲突。

| 任务 | 文件 | 优先级 |
|---|---|---|
| 狼人杀联机化（移植到 SDK 模板） | `api/games/sdk/werewolf.ts`（新建） | P1 |
| 海盗分金模板 | `api/games/sdk/pirateGold.ts`（新建） | P1 |
| 异能数据扩充 8→24 条 | `contracts/abilities.data.ts` | P2 |
| Agent 接入示例脚本（Python + curl） | `examples/`（新建） | P1 |

**Agent 示例脚本是隐藏加分项**：评委现场能用 curl 接入一个 Agent，
比任何 PPT 都有说服力。

**不要碰**：`api/world/`、`contracts/rulebook.ts`、`src/index.css`。

### C 号 · 视觉与观战（前端）

**为什么独立**：前端只读 `contracts/`，不改后端，不会与 A/B 冲突。

| 任务 | 文件 | 优先级 |
|---|---|---|
| 观战页（读事件流演出） | `src/pages/Spectate.tsx`（新建） | P0 |
| 裁判席 UI（3 席投票可视化） | `src/components/world/JudgePanel.tsx`（新建） | P0 |
| `/world` 与 `/agent` 视觉补强（现仅 100 行） | 对应页面 | P1 |
| 待补素材（见 `DESIGN.md` 第七节） | `public/` | P1 |

**不要碰**：`api/` 下任何文件、`db/schema.ts`。

---

## 四、防冲突的文件归属表

| 路径 | 归属 | 规则 |
|---|---|---|
| `contracts/` | **共有** | 改动前必须群里说一声，这是三方共享的地基 |
| `api/world/` | A | |
| `api/games/sdk/` | B | A 只在接事件流时改 `runtime.ts`，需先协调 |
| `api/queries/` | A 主 / B 次 | 一人一文件，不共编同一文件 |
| `src/pages/` | C | |
| `src/components/` | C | |
| `src/engine/` | B | 纯前端引擎 |
| `src/index.css` | C | **只有 C 能改**，避免色彩令牌被覆盖 |
| `db/schema.ts` | A | 改表结构必须群里通知，其他人要 `pnpm db:push` |
| `*.md` | 各自负责的那份 | A→ARCHITECTURE、C→DESIGN、A→TEAMWORK |

### `contracts/` 的特殊纪律

它被三方同时引用，是唯一的高冲突区。规则：

1. **只增不改**：加新类型、新字段（可选字段）随意；
   改已有字段名或删字段 → 必须群里确认
2. 一人一文件：A 建 `rulebook.ts`，B 改 `abilities.data.ts`，不交叉
3. 改完立刻 `pnpm check` + 推送，别攒着

---

## 五、Git 工作流（轻量，适合 72 小时）

**不用 GitFlow**，太重。用「主干 + 短分支」：

```bash
# 每次开新任务
git checkout main
git pull --rebase origin main        # 先同步，避免分叉
git checkout -b feat/judge-quorum    # 分支名：feat/ fix/ art/ 前缀

# 开发中，小步提交
git add -A && git commit -m "feat: 裁判团 3 席投票判定"

# 完成后
pnpm check                            # 必须 0 错误才能推
git push -u origin feat/judge-quorum
# GitHub 上开 PR → 另一人瞄一眼 → 合并
```

### 提交信息格式

```
feat: 新功能      fix: 修 bug       art: 美工素材/视觉
docs: 文档        refactor: 重构    chore: 杂务
```

### 三条铁律

1. **`main` 永远可跑**：推 `main` 前必须 `pnpm check` 通过
2. **`pull --rebase` 而非 `pull`**：保持历史线性，冲突更好解
3. **每天至少推一次**：72 小时的比赛，攒代码是最大风险

---

## 六、冲突处理速查

```bash
# 情况1：pull 时冲突
git pull --rebase origin main
# 冲突后：手动改文件 → git add <文件> → git rebase --continue

# 情况2：改错了想撤销（未提交）
git restore <文件>

# 情况3：提交了但想改提交信息（未推送）
git commit --amend

# 情况4：搞乱了想回到远程状态（⚠️ 丢弃本地改动）
git fetch origin && git reset --hard origin/main
```

**情况 4 会丢代码**，执行前先 `git stash` 保一份。

---

## 七、素材体积问题（建仓前先处理）⚠️

`app/public/` 里 76 张 PNG 合计 **184MB**，其中 50 张超过 2MB。
整个 git 仓库因此达到 186MB，队友 clone 会很慢，推送也容易超时。

### 建议：压缩后再推首个版本

```bash
# 装工具（任选其一）
npm i -g sharp-cli          # 推荐，跨平台
# 或 choco install imagemagick

# 批量压缩：宽度上限 1920，质量 82（背景图够用）
cd app/public
for f in *.png; do
  npx sharp-cli -i "$f" -o "compressed/$f" resize 1920 --withoutEnlargement -f png -q 82
done

# 目测确认没失真后替换
```

预期能压到 20–30MB，clone 从几分钟降到十几秒。

### 若不想压缩，用 Git LFS

```bash
git lfs install
git lfs track "app/public/*.png"
git add .gitattributes && git commit -m "chore: PNG 走 LFS"
```

⚠️ LFS 有免费额度限制（GitHub 免费账户 1GB 存储 / 1GB 月流量），
三人频繁拉取可能超额。**72 小时比赛更推荐直接压缩**。

### 已做的缓解

`.gitattributes` 里已设 `*.png -diff`，review 时不会刷屏二进制 diff。

---

## 八、环境统一（避免"我这能跑"）

```bash
# 三人必须一致
node -v      # 20.x
pnpm -v      # 用 pnpm，不用 npm（仓库有 pnpm-lock.yaml）
```

### 新成员上手（10 分钟）

```bash
git clone <仓库地址>
cd ten-days-gambit/app
pnpm install
cp .env.example .env         # 关键：填 DATABASE_URL
pnpm db:push                 # 建表
pnpm dev                     # localhost:5173
```

### 数据库怎么共享

三人各连自己的本地 MySQL，**schema 靠 `db/schema.ts` 同步**，不共享数据。
A 号改了 `schema.ts` 后群里说一声，其他人 `git pull && pnpm db:push`。

⚠️ 不要三人连同一个云数据库——一人 `db:push` 会影响所有人的正在跑的对局。

### 验证环境是否正常

```bash
pnpm check                                # 应 0 错误
npx vitest run api/world/eggs.test.ts     # 应 33 项全绿（无需 DB）
pnpm test                                 # 36 项，需 DB 才全绿
```

若 `pnpm test` 有 3 项失败且报 `ER_ACCESS_DENIED_ERROR`，
说明 `.env` 的 `DATABASE_URL` 没配对，不是代码问题。

---

## 九、AI 工具的分工使用

四个模型各管一段，按「谁最擅长什么」切：

| 工具 | 负责 | 不适合 |
|---|---|---|
| **Fable 5**（我） | 全局架构与设计、契约层改动、跨文件重构、代码评审 | — |
| **GPT** | 单文件功能实现、数据批量生成（异能扩充到 48 条）、写测试 | 契约层改动（容易破铁律） |
| **Codex CLI**（本地） | 单页面/单组件视觉优化、CSS 调整、素材压缩 | 后端逻辑、跨文件改动 |
| **Kimi K3** | UI 界面设计与视觉方案 | 逻辑代码 |
| **Jev**（运行时） | 游戏内的判断决策（不是开发工具） | 生成任何文本 |

### Jev 与前三者的区别

Jev 不是开发工具，它是**跑在游戏里的模型**——AI 裁判的裁断、
狼人杀发言的矛盾检测都靠它。已接入 `api/world/jev.ts`，
Key 走 `TYPESAFE_API_KEY` 环境变量。

验证是否配好：

```bash
cd app
TYPESAFE_API_KEY=apikey_xxx npx tsx scripts/jev-smoke.ts
```

应看到「✓ 裁判能区分实质质询与空泛不服」。
未配 Key 时裁判自动降级到本地启发式，机制仍完整——但演示时要说明。

⚠️ **Key 绝不入库**。它只从环境变量读取，`.env` 已在 `.gitignore` 里。
若不小心提交过，立刻去 console.typesafe.ai/keys 吊销重发。

### 派活给 GPT 的模板

```
项目：十日牌局（React 19 + tRPC + Drizzle）
先读这两份约束：ARCHITECTURE.md 第二节（三条铁律）、DESIGN.md 第八节

任务：<具体到单个文件>
硬要求：
- 不改 contracts/ 下已有字段名
- 不让卡牌/异能影响胜负计算（铁律）
- 改完必须 pnpm check 通过
```

### 派活给 Codex 的模板

```bash
codex exec "读 DESIGN.md 的硬约束（第八节）。
任务：<单个页面或组件>
只改这一个文件，改完跑 pnpm check 确认 0 错误。"
```

**关键纪律**：AI 生成的代码**必须有人 review 才能进 `main`**。
三人互相 review，哪怕只花 2 分钟扫一眼 diff。
72 小时比赛里，一个没人看过的 AI 改动可能让你们花 3 小时 debug。

---

## 十、72 小时时间表建议

| 阶段 | 时间 | 目标 |
|---|---|---|
| T+0~2h | 全员 | 建仓推送、环境跑通、认领分工 |
| T+2~24h | 并行 | A: 事件流落库；B: 狼人杀联机；C: 观战页骨架 |
| T+24~28h | 全员 | **第一次合并对齐**，确保 main 可跑通一局完整对局 |
| T+28~48h | 并行 | A: 裁判团机制；B: 海盗分金 + Agent 示例；C: 裁判席 UI + 视觉补强 |
| T+48~52h | 全员 | **第二次合并对齐** + 端到端演练 |
| T+52~64h | 并行 | 补缺口、修 bug、素材补齐 |
| T+64~70h | 全员 | **冻结代码**，只修致命 bug；排练演示 |
| T+70~72h | 全员 | 演示稿 + 录屏备份（防现场网络故障） |

### 两个必须留时间的事

1. **录屏备份**：现场网络不通、数据库连不上是常见事故。
   提前录一段完整对局 + 裁判裁决的视频。
2. **字体自托管**：`DESIGN.md` 第五节提到字体走 Google Fonts CDN，
   离线会回退。赛前 30 分钟能解决，现场发现就来不及。

---

## 十一、演示重点（评委视角）

按「原创性 × 可演示性」排序，建议这个顺序讲：

**1. 分布式裁判 + 规则演化**（最大亮点，留最多时间）

现场让 Agent 质询一条规则 → 3 席裁判投票 → 判例入库 → 下一局规则已变。

可直接报的实测数字：Jev 裁断一次质询 755ms，实质质询支持度 0.75、
论据强度 1.97/2 判采纳；空泛不服支持度 0.43、论据 0.00/2 判驳回。
**判别力清晰**是这个机制可信的关键——不然任何胡说都能立判例。

一句话说清价值：*原著的主角在规则内求生，我们的玩家可以修改规则本身。*

**2. 任意 Agent 接入**（技术说服力）

现场用 curl 把评委的 Agent 接进一局对抗。四个端点就够：
`gatewayJoin` → `gatewayObserve` → `gatewayAct`，想质询规则再加 `gatewayAppeal`。

**3. 快慢分工的混合架构**（技术深度）

Jev 做「系统一」快判断（裁断、分类、矛盾检测），
通用大模型留给「系统二」慢思考（策略规划）。
讲清为什么裁判不能用 LLM：延迟数秒会让全场等待，而 Jev 是 300–800ms。

**4. 四种对抗模式**（完整度）

人vs人 / AI vs AI / 混合，一个 `SeatKind` 统一表达，不是三套代码。

**5. 异能只改信息不改胜负**（设计深度）

这条铁律让 48 种异能 × N 个游戏只需 5 个接入点。
**最容易被低估的加分项**：它证明你们想过架构，不是堆功能。

### 演示时务必准备的兜底

- **录屏**：现场网络不通或数据库连不上是常见事故
- **Jev 降级说明**：若现场无网，裁判会走本地启发式。
  这不是 bug 而是设计——但要主动说明，否则像是功能没做完
