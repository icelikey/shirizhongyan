# 《终焉》发布基线证据（2026-10-16）

这份记录只保存可复核的发布基线，不把设计计划写成运行事实。

## 代码基线

- 分支：`codex/cloud-deploy-20260927`
- 提交：`fc4e3c1 fix(cloud): proxy public IP and SPA routes`
- GitHub：`https://github.com/icelikey/shirizhongyan/tree/codex/cloud-deploy-20260927`
- 工作区：`git diff --check` 通过

## 本机构建验证

```text
pnpm --dir app check              PASS
pnpm --dir app test -- --run     PASS · 45 files · 361 tests
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

## 下一条发布证据

下一次更新必须补充：公网 Agent 注册响应（不记录 API Key）、一场真实整局、三场暗局日报、应用重启后的房间回读、数据库备份恢复回读，以及 HTTPS 入口。
