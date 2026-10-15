# 《终焉》发布基线证据（2026-10-16）

这份记录只保存可复核的发布基线，不把设计计划写成运行事实。

## 代码基线

- 分支：`codex/cloud-deploy-20260927`
- 提交：本地已包含 World Node 运行时、ECS 恢复手册和状态对齐；GitHub 分支已通过仓库 API 完成本轮同步
- GitHub：`https://github.com/icelikey/shirizhongyan/tree/codex/cloud-deploy-20260927`
- 工作区：`git diff --check` 通过

## 本机构建验证

```text
pnpm --dir app check              PASS
pnpm --dir app test -- --run     PASS · 47 files · 390 tests
pnpm --dir app build             PASS
```

构建仍有两类非阻塞警告：Tailwind `duration-[...]` 类名歧义，以及首屏 JavaScript bundle 较大。它们进入性能修缮队列，不改变当前确定性规则结果。

## 火山 ECS 运行基线

- 应用容器：healthy
- MySQL 容器：healthy
- Nginx：`nginx -t` successful
- 监听：80、443、8080
- MySQL：仅容器网络访问，没有开放 MySQL 公网入口

## 公网直连探针

以下地址通过绕过本机代理的直连 HTTP 探针返回 200：

```text
http://69.5.21.20/
http://69.5.21.20/agent-portal
http://69.5.21.20/world
http://69.5.21.20/api/health
http://69.5.21.20/api/ready
http://69.5.21.20/.well-known/tdg-world.json
```

浏览器经过本机代理访问该 IP 时出现 502，应与直连结果分开判断。正式 HTTPS、域名、公网 Agent 注册整局和重启恢复还没有在本记录中宣告完成。

## 2026-10-16 部署尝试

- `agent-worker` 镜像已按脚本依赖补齐 `pi-tdg-agent/src`，远程构建成功。
- Worker 曾成功注册云端常驻 Agent，但旧应用实例的租约写入暴露了嵌套重复键错误；代码已在 `53ca047` 中修复并通过本地回归。
- 重新构建应用镜像期间，ECS 的 SSH banner、HTTP 健康检查和云终端同时超时，无法继续回读容器状态。实例需要先恢复后，才能继续执行应用重启、Worker 租约接管和公网整局验收。
- 因此本次只确认代码已推送和本地验证通过，未把“镜像构建开始”记为公网部署完成。

## 2026-10-16 本地 World Node 运行时收口

- 新增 `app/api/worldNodeRuntime.ts`：校验 `WorldNodeManifest`、协议/规则/内容包兼容性，构建排序稳定且只包含公开字段的 `ContributionBatch`。
- 新增 `app/api/worldNodeRuntime.test.ts`：11 个定向用例通过，覆盖无效清单、版本不兼容、缺失内容包、重复贡献 ID、世界标识和敏感字段拒绝。
- `pnpm check`：通过。
- `pnpm test -- --run`：通过，47 个测试文件、390 个测试用例。
- `pnpm build`：通过。
- `git diff --cached --check`：通过后提交为 `fce5386`。

## 最新公网复核

- 直连 `http://69.5.21.20/api/health`：超时，HTTP 000。
- 直连 `http://69.5.21.20/api/ready`：超时，HTTP 000。
- `ssh -o BatchMode=yes -o ConnectTimeout=10 tdg-volc "echo ssh_ok"`：banner exchange 超时。
- 结论：ECS 当前仍需恢复；公网 Agent 注册、Worker、真实整局和重启恢复不能验收。

## 下一条发布证据

下一次更新必须补充：公网 Agent 注册响应（不记录 API Key）、一场真实整局、三场暗局日报、应用重启后的房间回读、数据库备份恢复回读，以及 HTTPS 入口。
