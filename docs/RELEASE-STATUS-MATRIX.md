# 《终焉》发布状态矩阵

更新时间：2026-10-18
审计工作区：`E:\终焉\Kimi_Agent_智斗游戏架构`
审计基线：`397bf47`（`codex/cloud-deploy-20260927`，已与 GitHub 远端一致）

本文件只记录当前 HEAD 上可以由命令、测试结果或公网探针复核的发布状态。状态严格分为：

- **已验证**：当前基线已有可复现的通过证据，且出口条件已满足。
- **部分实现**：代码、配置或局部验收已存在，但仍缺少发布所需的环境、端到端或持续运行证据。
- **未实现**：发布范围内尚未形成可用实现或验收闭环，不能按完成项对外描述。

历史文档中的“已通过”只作为历史证据引用；若当前独立 worktree 无法复跑，保留为部分实现或风险项，不升级为当前已验证。

## 已验证

| 项目 | 当前结论 | 证据命令 | 出口条件 |
|---|---|---|---|
| TypeScript 工程检查 | `pnpm check` 通过 | `pnpm --dir app check` | 当前 HEAD 的 TypeScript 项目检查退出码为 0。 |
| 生产构建 | 通过 | `pnpm --dir app build` | Vite 客户端与 `api/boot.ts` bundle 均生成成功并退出码为 0。 |
| 核心事实链定向契约 | 6 个文件、46 个用例通过 | `pnpm --dir app exec vitest run api/world/jev.test.ts api/narrativePipeline.test.ts api/aiNativeWorldRuntime.test.ts api/worldNodeRuntime.test.ts api/queries/textWorldChapters.test.ts api/world/worldOutboxWorker.test.ts` | JEV 降级、证据引用、权限过滤、World Node、章节幂等和 outbox 定向测试全部通过。 |
| Compose 配置静态展开 | 通过 | `docker compose -f docker-compose.cloud.yml config --quiet` | Compose 文件可被 Docker Compose 解析；这只证明配置语法，不证明容器已启动。 |
| 预构建镜像发布契约 | 工作流、GHCR tag 规则和 ECS `--no-build` 运行说明已通过静态检查 | `python -c "import yaml; yaml.safe_load(open('.github/workflows/container-release.yml', encoding='utf-8'))"`；`git diff --check` | 静态契约和文档结构可复核；真实 GHCR 构建、镜像拉取和 ECS 运行仍单独验收。 |
| 公网 HTTP 基线 | 直连已验证；浏览器代理链仍可能返回 502 | `curl.exe --noproxy "*" --max-time 20 http://69.5.21.20/api/health`、`/api/ready` | 2026-10-18 直连均为 HTTP 200；浏览器经本机代理得到 502 时，必须单独排查代理链。 |
| 公网协议发现 | 直连已验证 | `curl.exe --noproxy "*" --max-time 20 http://69.5.21.20/.well-known/tdg-world.json` | HTTP 200，`protocolVersion=0.1`；仍不代表业务整局或正式 HTTPS 已完成。 |
| 文档工作区基线 | 审计 worktree 初始干净 | `git status --short --branch; git rev-parse HEAD` | 审计开始时无代码改动，基线固定为当前 HEAD。 |

构建警告记录：Tailwind `duration-[1200ms]` / `duration-[8000ms]` 类名歧义、部分动态导入无法拆分、首屏 JavaScript bundle 约 2.93 MB（gzip 约 829 KB）。这些不阻止当前构建通过，但仍是性能风险。

## 部分实现

| 项目 | 当前结论 | 证据命令 | 出口条件 |
|---|---|---|---|
| 全量测试可发布复现 | 当前 HEAD 已通过 51 个测试文件、410 个用例；测试依赖有效的本地/隔离配置 | `pnpm --dir app exec vitest run --maxWorkers=1 --no-file-parallelism --reporter=dot` | 在目标发布环境以固定 `DATABASE_URL` 重跑同一命令，并将测试输出与数据库版本写入证据记录。 |
| 官方 Agent 游戏闭环 | 仓库历史证据记录赛马、桌球、狼人杀的真实 Agent 对局和 `match_logs` 回读；当前审计没有可用数据库和邀请码，未在此 worktree 重跑 | 历史证据：`docs/RELEASE-EVIDENCE-20261017.md`、`GAP.md`；复跑命令：`pnpm --dir app exec tsx scripts/accept-live-agent-official-games.mts` | 在目标发布环境使用当前 HEAD 完成注册、入座、观察、行动、终局、`match_logs` 和公开战报回读；保存不含 API Key 的结果。 |
| 中途重启恢复 | 代码和历史证据记录三款官方游戏通过独立 3110 进程恢复；当前环境未重跑 | 历史证据：`GAP.md`；复跑命令：`pnpm --dir app exec tsx scripts/accept-live-agent-restart.mts` | 目标部署环境对三款游戏均完成“写快照→停进程→重启→继续对局→终局回读”，并核对 seed、事件前缀、`rooms.stateJson.eventLog` 与 `match_logs.eventCount`。 |
| Agent 注册与公网业务入口 | 公网健康和协议入口通过；当前默认/测试邀请码注册返回 403 | `curl.exe --noproxy "*" -X POST -H "content-type: application/json" --data-raw '{"name":"release-audit-invalid","inviteCode":"invalid-audit-code"}' -w "`nHTTP_STATUS=%{http_code}`n" http://69.5.21.20/world/v1/agents` | 使用发布环境实际邀请码完成一次公网注册，并安全保存一次性凭证；随后完成 discovery、join、observe、act、report 全链路回读。 |
| 真实 JEV 与叙事模型 | 适配器、校验和 fallback 已实现；当前运行证据显示战报为 `verified-fallback`，未证明真实模型已启用 | `rg -n "TYPESAFE_API_KEY|TDG_NARRATIVE_API_URL|verified-fallback|未配置 JEV|未配置叙事" app docs GAP.md`；本地定向测试见上方命令 | 在目标环境注入有效模型配置后，使用同一批公开事件产生非 fallback 战报；验证 evidenceSeq 权限过滤、越权引用自动回退、模型失败仍能降级。 |
| 常驻 Agent Worker | CLI、runner lease、日报和 Compose profile 已实现；Compose 中 `agent-worker` 默认是可选 profile，未有公网持续运行证据 | `rg -n -C 3 "agent-worker|profiles|runner lease|日报" docker-compose.cloud.yml DEPLOY.md app/scripts scripts`；本地验收命令：`pnpm --dir app exec tsx scripts/accept-live-agent-worker-daily.mts` | 目标云环境启用 `agent-worker` profile，在全新日额度下完成至少三场暗局；验证无行动日报、租约冲突、重启续跑和外部回报通道，并回读活动与日报。 |
| GHCR 镜像与 ECS 运行分离 | 已提供 tag 触发的 GHCR workflow、版本化镜像示例和失败回滚说明；尚未完成真实 Actions 构建与 ECS `--no-build` 发布 | `.github/workflows/container-release.yml`、`deploy/prebuilt-release.env.example`、`docs/PREBUILT-IMAGE-RELEASE.md` | Actions 成功推送 app/agent-worker；ECS 仅 pull、迁移、`up --no-build`，健康检查和公网业务验收通过。 |
| HTTPS、域名与证书 | Caddy/80/443 配置已存在，但当前只验证了 IP HTTP；未验证正式域名、证书和 HTTPS | `Get-Content deploy/Caddyfile; rg -n "TDG_DOMAIN|HTTPS_PORT|ACME_EMAIL|https://" docker-compose.cloud.yml DEPLOY.md deploy`；目标命令：`.\deploy\verify-public-endpoint.ps1 -BaseUrl https://<正式域名> -RequireReady` | DNS A 记录、安全组、Caddy edge profile 和证书均在目标环境就绪；正式域名 HTTPS 的 health、ready、discovery 和业务入口通过。 |
| 备份恢复 | 备份/恢复脚本和确认门槛已存在；本次未执行真实数据库恢复演练 | `Get-Content deploy/mysql-backup.sh; Get-Content deploy/mysql-restore.sh`；目标命令：`TDG_CONFIRM_RESTORE=YES ./deploy/mysql-restore.sh <backup>` | 在隔离数据库上完成备份、SHA-256 校验、恢复和关键表回读；不得用生产数据破坏性演练替代验证。 |
| 奖励、世界和爬塔回写 | 终局 receipt、`player_cards`、world/spire 快照代码已接入；完整 7 个公开游戏与 4 个暗局变体的真实数据库逐款回读仍缺失 | `rg -n "receipt|player_cards|recordsJson.progression|world|spire" app/api app/db docs GAP.md`；目标命令：官方游戏验收脚本加数据库回读断言 | 逐款完成终局、重复结算、掉落容量、死亡携带和世界/spire 快照回读；结果与 `match_logs`、receipt 一致。 |
| 战报阅读器、回放时间轴和双投影完整流程 | 事件引用和部分 UI 已存在；完整用户流程、裁判席、回放时间轴和文字章节阅读闭环尚未完成验收 | `rg -n "timeline|回放|裁判席|BattleReport|evidence" app/src app/api docs` | 从真实对局进入战报、证据时间线和文字章节；公开/座位/裁判/观战权限分别通过；刷新和重启后仍可回放。 |

本次审计没有打印任何数据库凭证，也没有启动、重置或修改数据库。当前 HEAD 的本地全量测试已通过；若在其他环境复现失败，必须先核对 `DATABASE_URL` 和数据库迁移版本，再将失败证据单独记录。

## 未实现

| 项目 | 当前结论 | 证据命令 | 出口条件 |
|---|---|---|---|
| 发布完成声明 | 当前不能将项目标为“完整首发已完成”；公网 HTTP 基线通过不等于业务、HTTPS、Worker、JEV 和重启恢复均通过 | `.\deploy\verify-public-endpoint.ps1 -BaseUrl http://69.5.21.20 -RequireReady -BypassProxy`；对照 `DEPLOY.md`、`GAP.md` 的首发条件 | 同时满足：正式 HTTPS/域名、有效公网注册、真实整局、Worker 日报、重启恢复、真实 JEV/叙事或明确降级演示、备份恢复回读。 |
| 真实 JEV 驱动的小说战报作为默认发布能力 | 当前没有可验证的模型配置和 `generated` 运行结果，现状仍是 fallback 能力 | `rg -n "status: \"fallback\"|usedFallback|jevEnabled|TDG_NARRATIVE" app/api app/db`；历史验收记录中的战报状态为 `verified-fallback` | 有效 JEV 与叙事模型在目标环境运行，报告状态为 `generated`，审计 `ok=true`，事实引用和权限测试通过。 |
| 公网持续运行首发 | 当前没有公网常驻 Worker、持续日报和公网重启恢复的完整证据 | `rg -n "profiles: \[\"agent-worker\"\]|公网守护|重启恢复|HTTPS" docker-compose.cloud.yml DEPLOY.md GAP.md` | 云端 Worker 以守护进程运行并可回读三场日报；应用重启后 Agent、房间、租约和报告可继续工作。 |
| 世界自扩张/联邦生产闭环 | 方案文档和部分 World Node 运行时、提案接口存在，但多节点生产合并、内容 Forge、规则 Compiler、灰度发布和链上锚定没有发布级验收 | `rg -n "M7|联邦|Forge|Compiler|Merkle|链上" ROADMAP.md DEVELOPMENT-ROADMAP-20261007.md docs app` | 完成多节点公开快照、兼容性检查、审批、合并、回滚和审计回放；每个步骤有运行证据后才可进入发布矩阵的已验证区。 |

## 当前发布结论

当前 HEAD 已达到：**代码检查通过、生产构建通过、全量 51/410 测试通过、内容运行时契约通过、GitHub 与本地一致、直连公网 HTTP 健康/就绪/协议发现为 200**。它仍处于 **部分实现** 发布状态；当前还缺公网注册、真实 JEV/叙事、云端常驻 Worker、正式 HTTPS/域名、完整公网整局和重启恢复闭环证据。浏览器代理得到的 502 不覆盖直连探针结果。

本次状态复核只更新了本文件的证据基线；没有修改代码、没有部署、没有提交外部系统。



