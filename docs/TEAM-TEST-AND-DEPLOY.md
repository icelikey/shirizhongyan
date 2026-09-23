# 测试、数据库与部署路线

更新时间：2026-09-23

本文记录当前可复核的验证结果、队友本机测试矩阵，以及从本地演示到正式云端的部署路径。没有现场输出、日志或 HTTP 响应的项目不标记为“已通过”。

## 1. 当前验证状态

| 项目 | 当前状态 | 证据与边界 |
| --- | --- | --- |
| CLI 语法检查 | **已通过** | pnpm --dir cli check 返回 0。 |
| Compose 静态解析 | **已通过** | docker compose -f docker-compose.local.yml config 返回 0；这只证明 YAML 和变量展开有效。 |
| app TypeScript 检查 | **待复核** | pnpm --dir app check 没有输出 TypeScript 错误，但本轮 PowerShell 包装命令没有可靠返回退出码，不能作为最终门禁。 |
| app 测试 | **部分通过** | 9 个测试文件中 7 个通过，187 个测试中 184 个通过；3 个失败均为 ER_NO_SUCH_TABLE: ten_days_gambit.users。 |
| MySQL、建表、种子数据 | **被 Docker Engine 阻塞** | 当前 docker info 等待 8 秒仍无 Engine 响应，无法启动 MySQL 并执行 db:push / db:seed。 |
| app 容器构建与 /api/health | **未验证，被 Docker Engine 阻塞** | 没有可用容器和 HTTP 200 响应。 |
| ngrok 远程 Agent 联调 | **未验证** | 依赖本机 app、邀请码、HTTPS 隧道和注册/入座/行动链。 |
| Cloud Run + Cloud SQL | **路线具备，线上结果未验证** | deploy/cloud-run.ps1 固定 min=1/max=1；当前没有本次发布的 URL、Cloud SQL 迁移输出或健康检查证据。 |

当前失败首先是环境前置失败：测试已经能加载代码并运行，但目标 MySQL 数据库没有 schema。不要把这 3 项写成规则逻辑失败，也不要把 Compose 静态解析写成容器启动成功。

## 2. 队友本机测试矩阵

每位队友使用独立本机数据库，不共享一套开发数据库。统一要求 Node.js 20+、pnpm 10+；脚本以 app/package.json、cli/package.json 为准。

| 层级 | 命令或动作 | 通过标准 |
| --- | --- | --- |
| CLI | pnpm --dir cli check | 返回 0 |
| TypeScript | pnpm --dir app check | 返回 0、无诊断 |
| 前端/服务构建 | pnpm --dir app build | Vite 和 server bundle 都完成 |
| 无数据库测试 | pnpm --dir app test -- api/world/eggs.test.ts | 测试全绿 |
| 数据库烟测 | pnpm --dir app test | 187 项全部通过 |
| HTTP 健康 | Invoke-RestMethod http://127.0.0.1:3000/api/health，或 Compose 的 8080 端口 | ok=true，service=ten-days-gambit |
| Gateway 发现 | Invoke-RestMethod http://127.0.0.1:3000/.well-known/tdg-world.json | 返回协议发现文档 |
| Agent 循环 | register → doctor → rooms → join → watch → act | 完成一次行动，错误不回显完整 Key |
| 种子账号 | pnpm --dir app db:seed | 输出六个演示账号及一次性 Key |

队友交付结果时至少附命令、时间、返回码、关键响应或失败首行，以及使用的数据库环境。只说“能跑”不算验收证据。

## 3. 本机数据库初始化、种子与健康检查

### 3.1 准备

在项目根目录执行：

    Copy-Item deploy/.env.local.example deploy/.env.local

编辑 deploy/.env.local，填写本机密码、APP_SECRET 和 AGENT_REGISTRATION_CODE。不要把该文件、真实密码、邀请码或 Agent Key 提交到仓库。宿主机数据库地址默认使用：

    mysql://tdg:<本机密码>@127.0.0.1:3307/ten_days_gambit

### 3.2 启动 MySQL、建表和种子

Docker Desktop 正常运行后执行：

    .\deploy\local-up.ps1 -Seed

脚本会启动 docker-compose.local.yml 的 MySQL 8.4，等待 healthcheck，通过后注入 DATABASE_URL，执行 pnpm db:push，并在传入 -Seed 时执行 pnpm db:seed。

db:seed 是可重复执行的演示播种流程：固定六个 demo 用户，补充档案，再为每人生成一把新的 Agent Key。每次重跑都会产生新 Key；明文只在该次终端输出中可见。数据库重置时可以重新播种，但不要把旧 Key 当成仍然有效。

### 3.3 启动 app 与检查

宿主机开发服务：

    $env:DATABASE_URL = "mysql://tdg:<本机密码>@127.0.0.1:3307/ten_days_gambit"
    pnpm --dir app dev

另开终端检查：

    Invoke-RestMethod http://127.0.0.1:3000/api/health
    Invoke-RestMethod http://127.0.0.1:3000/.well-known/tdg-world.json

完整容器路径：

    Copy-Item deploy/.env.cloud.example deploy/.env.cloud
    docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d --build --wait
    docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml run --rm app pnpm db:push
    Invoke-RestMethod http://127.0.0.1:8080/api/health

停机保留数据使用 docker compose down，不要加 -v。只有明确要销毁本机数据库时才删除 Compose volume。

## 4. Docker Desktop 恢复后的操作顺序

当前 Docker Engine 是本轮硬阻塞点。恢复后按顺序执行，失败就停在对应步骤并保留输出：

    docker version
    docker info
    docker compose version
    docker compose -f docker-compose.local.yml config
    .\deploy\local-up.ps1 -Seed

然后验证：

    docker compose --env-file deploy/.env.local -f docker-compose.local.yml ps
    pnpm --dir app check
    pnpm --dir app test
    Invoke-RestMethod http://127.0.0.1:3000/api/health

如果只验证完整容器，再执行 Cloud Compose 的 up -d --build --wait、容器内 db:push 和 8080 健康检查。不要因为 docker compose config 成功就跳过 Engine、MySQL healthcheck 和实际 HTTP 检查。

## 5. ngrok 临时公网联调

ngrok 只映射 app 端口，不映射 MySQL。先让宿主机 app 在 3000 运行：

    ngrok http 3000

使用 ngrok 输出的 HTTPS 地址：

    node cli/tdg-agent.mjs register --url https://<ngrok域名> --name "远程 Agent" --invite-code <临时邀请码>
    node cli/tdg-agent.mjs doctor --url https://<ngrok域名>
    node cli/tdg-agent.mjs rooms
    node cli/tdg-agent.mjs join --room <房间码>
    node cli/tdg-agent.mjs watch --room <房间码>
    node cli/tdg-agent.mjs act --room <房间码> --type submit --value 33

若启用 Kimi OAuth，回调地址必须登记为 https://<ngrok域名>/api/oauth/callback。

联调通过的定义是：公网健康检查成功、注册只返回一次明文 Key、CLI 重启后能恢复原座位、完成一次 watch → act，并且日志不包含完整 Key。ngrok 只用于短期演示和跨机器联调，不作为正式域名、稳定回滚点或生产数据库入口。

## 6. GitHub Codespaces 试用边界

Codespaces 适合运行代码检查、前端构建和无状态 CLI 测试，但不是正式数据库环境：

- Codespace 会因空闲进入休眠；休眠后本地进程、端口转发和临时联调地址不能作为持续服务承诺。
- 工作区磁盘和容器环境可能在重建或回收后变化；本地 MySQL volume 不应视为可靠持久数据。
- 项目需要 MySQL 8。Codespaces 默认不会自动提供持久 MySQL；应使用独立 MySQL/Cloud SQL，或接受临时数据库的生命周期限制。
- 不把 Codespaces 端口转发地址当作稳定 HTTPS 地址，也不要把生产密钥写进 Codespace 文件。
- Codespaces 可以验证 pnpm check、无数据库测试和 cli check；完整 DB 烟测仍须有已建 schema 的 MySQL。
- 正式演示不要依赖 Codespace 是否醒着，需要稳定入口时走 Cloud Run + Cloud SQL。

## 7. Cloud Run + Cloud SQL 正式路线

正式路线是 Cloud Run 无状态 HTTP 服务 + Cloud SQL MySQL 8：

1. 创建目标 GCP project、区域、Cloud SQL MySQL 8 实例和数据库用户。
2. 整理唯一 DATABASE_URL，确认 Cloud SQL 连接方式。
3. 启用 Cloud Run、Cloud Build 和 Artifact Registry。
4. 用 deploy/cloud-run.ps1 构建 app/Dockerfile 并部署。
5. 通过 Cloud Run 的 Cloud SQL 连接参数接入目标实例。
6. 发布前在受信任的迁移环境执行一次 pnpm --dir app db:push，不要让每个实例在启动时抢跑迁移。
7. 运行一次受控 pnpm --dir app db:seed，只把短期演示 Key 交给授权参与者。
8. 发布后验证 Cloud Run URL 的 /api/health、协议发现、注册、入座、观战、行动和结算。
9. 再接入正式域名、OAuth 回调、Secret Manager 和监控。

部署脚本固定 --min 1 --max 1。生产秘密至少包括 APP_SECRET、DATABASE_URL、TYPESAFE_API_KEY 和 AGENT_REGISTRATION_CODE；优先使用 Secret Manager。不要提交 deploy/cloud-run.env.yaml，不要在构建参数、日志或 URL 中暴露秘密。

上线门槛是：镜像构建成功、Cloud SQL 迁移有输出、健康检查返回 200、公开 Gateway 能完成一局最小闭环、日志无秘密、回滚版本已记录。Cloud Build 成功不等于游戏可玩。

## 8. 当前单实例限制

当前房间 actor 在单实例内存中运行，并以数据库快照保存部分状态。数据库不能替代跨实例实时 actor、锁和事件队列。因此：

- Cloud Run max=1 是当前正确约束，不要直接改成多实例。
- 重启、迁移或实例替换期间要验证房间恢复能力。
- 多实例前必须把房间 actor、幂等命令、事件顺序、锁和队列迁移到 Redis 或专用状态服务，并增加跨实例一致性测试。
- 完成迁移前，宣传口径限定为单实例联机演示，不承诺横向扩容或跨实例房间同步。

## 9. 上线前验收

- [ ] git status 干净，未提交 .env、Key、密码或临时配置。
- [ ] pnpm --dir cli check 返回 0。
- [ ] pnpm --dir app check 返回 0。
- [ ] pnpm --dir app build 完整结束并返回 0。
- [ ] pnpm --dir app test 全绿；有 DB 失败时先完成建表。
- [ ] MySQL 8 healthcheck 通过，db:push 成功。
- [ ] 六个种子账号和 Agent Key 交接已核对。
- [ ] /api/health 返回 200，协议发现文档可读。
- [ ] register → doctor → rooms → join → watch → act 完成一次。
- [ ] 网页玩家与 Agent 共用房间的最小演示完成。
- [ ] Jev/TTS 不可用时，字幕或本地裁判降级路径已确认。
- [ ] Cloud Run URL、Cloud SQL、镜像 digest、当前 revision 和回滚 revision 已记录。
- [ ] 单实例仍为 min=1/max=1。
- [ ] 正式 HTTPS 域名和 OAuth 回调已生效。

## 10. 回滚

本地回滚：停止 app，回到上一个已知可运行版本，保留数据库 volume，再做健康检查。普通回滚不要使用 down -v。

Cloud Run 回滚：停止异常 revision 继续接收流量，把流量切回上一条已验收 revision，保留异常 revision 的日志和镜像 digest。数据库回滚单独判断：

- 只有兼容的应用代码变化时，优先回滚 Cloud Run revision。
- 有 schema 变化时，确认迁移是否可逆、旧代码是否还能读取新 schema。
- 不用重新执行旧版 db:push 代替数据库恢复。
- 需要恢复数据时使用 Cloud SQL 备份或时间点恢复，并记录恢复点、影响范围和重新验证结果。
- 回滚后重新检查健康端点、注册、入座、行动、结算和公开/私密视角。

回滚完成的证据是：流量指向目标 revision、健康检查 200、最小对局闭环通过、数据库状态与应用版本兼容。未完成这些检查时只能标记为“已切回，待验收”。
