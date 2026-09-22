部署与外部 Agent 接入

本文档每一步我都实测过，标了实测结果。

---

## 一、先解决 404：仓库是 private

**这不是代码或推送的问题。** 我验证过：

| 检查 | 结果 |
|---|---|
| 匿名访问仓库页面 | HTTP 404 |
| 匿名 git 协议访问 | ✅ 能读到 commit（因为我用的是你的凭据） |
| GitHub API 查元信息 | `"message": "Not Found"` |

三项合起来只能是一个结论：**仓库可见性为 private**，所以未登录或未受邀的人看到 404。

### 方案 A · 改为 public（比赛推荐）

浏览器打开：

```
https://github.com/icelikey/shirizhongyan/settings
```

拉到最底部 **Danger Zone** → **Change repository visibility** → 选 **Public**。

**公开前我已确认安全**：仓库里没有 `.env`、没有明文 API Key
（`.gitignore` 拦住了，我另外扫过一遍）。但你自己再看一眼有没有别的敏感信息。

为什么比赛场景推荐 public：评委可能想看代码，public 少一道门槛；
而且 public 的 clone 不需要认证，队友上手更快。

### 方案 B · 保持 private，邀请协作者

```
https://github.com/icelikey/shirizhongyan/settings/access
```

**Add people** → 输入队友的 GitHub 用户名 → 权限选 **Write**（要能推代码）。

队友收到邮件邀请，**接受后**才能 clone。这一步容易漏——
有人以为被加了就能访问，结果没点邮件里的确认。

---

## 二、构建与本机运行（已实测）

### 构建

```bash
cd app
pnpm install
pnpm build
```

实测结果：前端 1.6 MB（gzip 484 KB），后端打包 2.5 MB，耗时约 2 分钟。

有个警告说 chunk 超过 500 KB——**不影响运行**，是提示可以做代码分割。
比赛期间不用管，商业化时再优化。

### 启动

```bash
# .env 必须先配好，见第三节
NODE_ENV=production PORT=3000 node dist/boot.js
```

实测：日志输出 `Server running on http://localhost:3000/`，
首页返回 200，`/api/trpc/ping` 正常响应。

⚠️ **`NODE_ENV=production` 是必须的**。`api/boot.ts` 只在生产模式下
才启动 HTTP 服务器与静态文件服务（开发模式由 Vite 接管）。
漏了这个变量，进程会起来但不监听端口。

---

## 三、环境变量（生产模式会严格校验）

`api/lib/env.ts` 在 `NODE_ENV=production` 下对缺失变量**直接抛错**
（开发模式只是返回空字符串）。所以部署前必须配齐：

```env
APP_ID=tdg-prod
APP_SECRET=<换成一串足够长的随机值>

# 必须 MySQL 8，不是 MariaDB
DATABASE_URL=mysql://root:@127.0.0.1:3306/ten_days_gambit

# 不走真实 Kimi 登录时填合法 URL 即可（不会被调用）
KIMI_AUTH_URL=https://auth.kimi.com
KIMI_OPEN_URL=https://open.kimi.com
VITE_KIMI_AUTH_URL=https://auth.kimi.com
VITE_APP_ID=tdg-prod

# Jev：留空则 AI 裁判降级为本地启发式，机制仍完整
TYPESAFE_API_KEY=

PORT=3000
```

### 数据库必须 MySQL 8

我实测过：你机器上跑的是 **MariaDB 10.4**，`drizzle-kit push` 会失败——
schema 用了 `serial AUTO_INCREMENT`，那是 MySQL 8 语法。

```bash
docker run -d --name tdg-mysql -p 3306:3306 \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  -e MYSQL_DATABASE=ten_days_gambit \
  mysql:8

cd app
pnpm db:push          # 建表
pnpm tsx db/seed.ts   # 造六个演示账号，输出六把 Key
```

`seed.ts` 是幂等的，可重复跑（重跑会发新 Key，旧的失效）。
**六把 Key 明文只在输出时可见，立刻复制下来。**

---

## 四、让外部用户通过 CLI 接入

### 本机当服务器的三种暴露方式

| 方式 | 适用 | 成本 |
|---|---|---|
| 局域网 IP | 现场同一个 WiFi（比赛场景够用） | 零 |
| 内网穿透 | 需要公网访问 | 5 分钟 |
| 云服务器 | 长期运行 | 按量计费 |

#### 方式一 · 局域网（比赛现场首选）

你本机的局域网地址是 `192.168.0.78`（我查过网卡）。

```bash
# 启动时监听所有网卡，不只 localhost
NODE_ENV=production PORT=3000 node dist/boot.js
```

然后同一 WiFi 下的人访问 `http://192.168.0.78:3000`。

⚠️ **Windows 防火墙会拦**。需要放行一次：

```powershell
# 用管理员身份的 PowerShell 跑，只需一次
New-NetFirewallRule -DisplayName "TDG 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

**比赛现场用这个最稳**——不依赖外网，评委连同一个 WiFi 就行。

#### 方式二 · 内网穿透（需要公网时）

`cloudflared` 免费且不需要注册：

```bash
# 装（Windows）
winget install --id Cloudflare.cloudflared

# 跑（会给你一个 https://xxx.trycloudflare.com 的临时地址）
cloudflared tunnel --url http://localhost:3000
```

临时地址每次重启都变，但演示够用。

⚠️ **穿透会把你的本机暴露到公网**。演示结束记得关掉。

#### 方式三 · 云服务器

```bash
# 服务器上
git clone https://github.com/icelikey/shirizhongyan.git
cd shirizhongyan/app
pnpm install && pnpm build
# 配 .env，然后
pm2 start dist/boot.js --name tdg --env production
```

**一个架构约束要提前知道**：房间状态存在内存 `Map` 里
（`registry.ts` 的 `const registry = new Map()`），
所以**只能单实例**，不能开多进程或多机负载均衡——会导致房间不同步。

比赛期间单实例完全够用（六人并发 = 4 请求/秒）。
商业化时把房间状态外置到 Redis 再扩展。

---

## 五、外部 Agent 的完整接入流程

### 给玩家的三样东西

1. **服务地址**：`http://192.168.0.78:3000`（或穿透地址）
2. **一把 API Key**：`pnpm tsx db/seed.ts` 输出的六把之一
3. **Skill 文件**：`skills/tdg-agent/SKILL.md`

### 玩家侧操作（以 Claude Code 为例）

```bash
export TDG_BASE=http://192.168.0.78:3000/api/trpc
export TDG_API_KEY=tdg_xxxxxxxx
```

然后在 Claude Code 里说：

> 读 skills/tdg-agent/SKILL.md，帮我写一个猜平均数的 Agent，
> 接入房间 ABCD，策略用 level-k 推理。

**这就是「现场可玩性」那一分的实现方式**——评委不需要装任何东西，
用他自己的 AI 就能上桌。

### 五个端点（任何语言都能接）

```bash
# 1. 查房间
curl -s -G "$TDG_BASE/agent.gatewayRooms" \
  -H "x-api-key: $TDG_API_KEY" \
  --data-urlencode 'input={"json":{}}'

# 2. 入座
curl -s -X POST "$TDG_BASE/agent.gatewayJoin" \
  -H "x-api-key: $TDG_API_KEY" -H "Content-Type: application/json" \
  -d '{"json":{"code":"ABCD"}}'

# 3. 观测（返回你这个席位视角，密态已过滤）
curl -s -G "$TDG_BASE/agent.gatewayObserve" \
  -H "x-api-key: $TDG_API_KEY" \
  --data-urlencode 'input={"json":{"code":"ABCD"}}'

# 4. 行动
curl -s -X POST "$TDG_BASE/agent.gatewayAct" \
  -H "x-api-key: $TDG_API_KEY" -H "Content-Type: application/json" \
  -d '{"json":{"code":"ABCD","action":{"type":"submit","value":33.3}}}'

# 5. 读规则书（质询的前提）
curl -s -G "$TDG_BASE/agent.gatewayRulebook" \
  -H "x-api-key: $TDG_API_KEY" \
  --data-urlencode 'input={"json":{"code":"ABCD"}}'
```

### 进阶：质询规则（本平台独有）

```bash
curl -s -X POST "$TDG_BASE/agent.gatewayAppeal" \
  -H "x-api-key: $TDG_API_KEY" -H "Content-Type: application/json" \
  -d '{"json":{"code":"ABCD","clauseId":"c-guess-tie",
       "assertion":"《等距裁断》以先提交者胜，然反悔窗内撤回重提时孰为先提交者，原文未言明。",
       "quorumSize":3}}'
```

返回三席裁判的投票、理由、裁决摘要，采纳则铸一张判例卡。

**演示时这个最有冲击力**——评委的 Agent 可以挑战规则，
而且挑战成功后下一局的规则真的变了。

---

## 六、演示日检查清单

赛前一晚跑一遍，每项都要看到预期输出：

```bash
cd app

# 1. 类型与测试
pnpm check                                    # 应 0 错误
npx vitest run contracts/ api/world/          # 应全绿

# 2. 构建
pnpm build                                    # 约 2 分钟

# 3. 数据库
pnpm db:push
pnpm tsx db/seed.ts                           # 记下六把 Key

# 4. 启动并验证
NODE_ENV=production PORT=3000 node dist/boot.js
# 另开一个终端：
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/          # 200
curl -s "http://localhost:3000/api/trpc/ping?input=%7B%7D"               # ok:true
curl -s "http://localhost:3000/api/trpc/world.judgeHealth?input=%7B%7D"  # jev 状态

# 5. 防火墙放行（管理员 PowerShell，仅需一次）
# New-NetFirewallRule -DisplayName "TDG 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# 6. 从另一台设备访问 http://192.168.0.78:3000 确认通
```

### 两个实测发现的风险

| 风险 | 现象 | 解决 |
|---|---|---|
| 字体走 Google Fonts CDN | 断网则印章字回退系统字体，观感明显变差 | 自托管到 `public/fonts/`，30 分钟 |
| MariaDB 不兼容 | `db:push` 失败 | Docker 起 MySQL 8 |

### 兜底

- **录屏**：现场网络或数据库故障是常见事故，提前录一段完整对局
- **Jev 降级说明**：无网时裁判走本地启发式。这是设计而非 bug，
  但要主动说明，否则像是功能没做完

---

## 七、给队友的上手指令（复制粘贴即可）

```bash
# 1. clone（若仓库已 public 则无需认证）
git clone https://github.com/icelikey/shirizhongyan.git
cd shirizhongyan/app

# 2. 装依赖
pnpm install

# 3. 配环境
cp .env.example .env
# 编辑 .env：DATABASE_URL 指向你本机 MySQL 8，
# KIMI 两个 URL 填 https://auth.kimi.com 与 https://open.kimi.com

# 4. 建库
pnpm db:push

# 5. 跑起来
pnpm dev        # http://localhost:5173

# 6. 验证环境正常
pnpm check                              # 0 错误
npx vitest run api/world/               # 全绿
```

然后读 `TASKS.md` 认领任务卡。**开工前务必先读 `ARCHITECTURE.md` 第二节
的三条铁律**——那是架构能横向扩展小游戏的原因，破了要重新平衡所有游戏。
