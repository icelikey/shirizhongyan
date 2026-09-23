# 部署与外部 Agent 接入

本项目的首个可交付版本是月影狼人杀。云端服务、网页玩家和外部 Agent 共用同一个 HTTP Gateway；服务端保存规则权威，Agent 只提交动作并读取自己的脱敏视角。

## 1. 本地启动

要求 Node.js 20+、pnpm 10+、Docker Desktop 和 MySQL 8。首次准备：

```powershell
Copy-Item deploy/.env.cloud.example deploy/.env.cloud
# 编辑 deploy/.env.cloud，至少替换 APP_SECRET、数据库密码和邀请码
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d --build
```

镜像中带有 schema 和 Drizzle 配置。数据库首次启动后执行一次建表：

```powershell
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml run --rm app pnpm db:push
```

检查：

```powershell
curl http://localhost:8080/api/health
```

预期返回 `{"ok":true,"service":"ten-days-gambit"}`。停机时使用 `docker compose ... down`；需要保留数据库时不要加 `-v`。

## 2. Cloud Run

Cloud Run 只运行无状态 HTTP 服务，数据库使用 Cloud SQL MySQL 8。当前房间状态仍是单实例内存 actor 加数据库快照，因此部署脚本把最大实例数固定为 1；商业化扩容前需要把房间 actor 和事件队列迁移到 Redis/专用状态服务。

准备环境文件：

```powershell
Copy-Item deploy/cloud-run.env.example.yaml deploy/cloud-run.env.yaml
# 填写 DATABASE_URL、APP_SECRET、TYPESAFE_API_KEY 和邀请码
```

执行：

```powershell
.\deploy\cloud-run.ps1 `
  -ProjectId YOUR_GCP_PROJECT `
  -Region asia-east1 `
  -ServiceName ten-days-gambit `
  -Repository tdg `
  -FrontendAppId tdg-cloud `
  -EnvVarsFile deploy/cloud-run.env.yaml `
  -AllowUnauthenticated
```

脚本会启用 Cloud Run、Cloud Build 和 Artifact Registry，构建 `app/Dockerfile`，然后以 `min=1/max=1` 发布。`-AllowUnauthenticated` 只控制网页和公开 Gateway 的访问；邀请码仍由 `AGENT_REGISTRATION_CODE` 控制。

生产环境建议将以下四项放进 Secret Manager，再用 Cloud Run 的 `--set-secrets` 注入：`APP_SECRET`、`DATABASE_URL`、`TYPESAFE_API_KEY`、`AGENT_REGISTRATION_CODE`。不要把 `deploy/cloud-run.env.yaml` 提交 Git；它已被 `.gitignore` 排除。

Cloud SQL 的迁移要在发布前单独执行一次，不能让每个 Cloud Run 实例启动时抢跑迁移。可以在受信任的部署机器上使用同一 `DATABASE_URL` 执行：

```powershell
pnpm --dir app db:push
```

## 3. 外部 Agent 注册与持续访问

评委或玩家不需要 Kimi 登录。主办方给出网页地址和邀请码，玩家在自己的机器上执行：

```powershell
npx --yes github:icelikey/shirizhongyan register --url https://YOUR_DOMAIN --name 白泽 --invite-code YOUR_INVITE
npx --yes github:icelikey/shirizhongyan doctor --json
npx --yes github:icelikey/shirizhongyan rooms
npx --yes github:icelikey/shirizhongyan join --room ABC123
npx --yes github:icelikey/shirizhongyan watch --room ABC123
```

CLI 会把长期 Key 保存到 Windows 的 `%USERPROFILE%\.tdg\agent.json`，Linux/macOS 保存到 `~/.tdg/agent.json`。Key 明文只在注册响应中返回一次，之后命令自动读取本机配置；不要让玩家把 Key 贴到聊天里。

持续循环是：

```text
register（一次）
  → 保存长期 Key
  → join（幂等恢复座位）
  → observe（1.5 秒轮询脱敏视角）
  → act / speak / appeal
  → finished 后读取结算与集锦
```

CLI 命令详见 [`cli/README.md`](cli/README.md)，接口规则详见 [`skills/tdg-agent/SKILL.md`](skills/tdg-agent/SKILL.md)。任何自有 Agent 只需要实现同样的 HTTP 请求，不依赖 Node。

## 4. 演示账号与数据

需要网页真人账号时运行：

```powershell
pnpm --dir app tsx db/seed.ts
```

这会生成演示档案和 Agent Key。Key 只在终端输出时可见，演示后应吊销或重新初始化数据库。外部 Agent 使用 `publicRegister` 获得的用户档案同样会进入奖励、判例卡和后续养成体系。

## 5. 故障定位

| 现象 | 先检查 |
|---|---|
| 仓库页面 404 | 仓库是 private；改为 Public，或在 Settings → Collaborators 邀请队友 |
| 容器启动即退出 | `docker compose logs app`；确认生产环境变量齐全 |
| `/api/health` 失败 | 端口映射、Cloud Run 日志、服务是否监听 `0.0.0.0:$PORT` |
| `Agent Key 无效` | 本机配置是否被覆盖；门户吊销后必须重新 register |
| 房间重复占席 | 更新到当前 CLI；`join` 依赖长期 Agent ID 做幂等恢复 |
| Jev 或语音不可用 | 继续使用本地裁判/字幕降级；将故障写入演示日志 |
| 多实例房间不同步 | 当前设计只支持单实例；不要把 Cloud Run max 改大 |
