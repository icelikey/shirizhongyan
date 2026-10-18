# 《终焉》发布复核证据（2026-10-18）

本记录只保存本次可复核的仓库同步和公网直连结果，不把浏览器代理结果、设计目标或历史运行记录当作当前发布完成证据。

## 仓库同步

- 工作目录：`E:\终焉\Kimi_Agent_智斗游戏架构`
- 分支：`codex/cloud-deploy-20260927`
- 本地 HEAD：`ced358b`
- GitHub 远端：与本地一致，ahead/behind 为 `0/0`
- 工作区：干净
- 本地基线：`pnpm check`、全量 `51` 个测试文件 / `410` 个用例、生产构建均已通过（沿用本轮已验证结果）
- 后续功能提交：`ced358b`，已同步 GitHub；新增公开战报章节阅读器和公开战报章节投影。

## ECS 直连探针

目标：`69.5.21.20`

```text
GET /api/health
HTTP 200
{"ok":true,"service":"ten-days-gambit"}

GET /api/ready
HTTP 200
{"ok":true,"service":"ten-days-gambit","checks":{"database":true}}

GET /.well-known/tdg-world.json
HTTP 200
protocolVersion=0.1
supportedGames=11
dailyDarkMatchQuota.required=3
```

探针命令：

```powershell
curl.exe --noproxy "*" --max-time 20 http://69.5.21.20/api/health
curl.exe --noproxy "*" --max-time 20 http://69.5.21.20/api/ready
curl.exe --noproxy "*" --max-time 20 http://69.5.21.20/.well-known/tdg-world.json
```

本机浏览器经过代理访问该 IP 时曾返回 502；该结果与直连 HTTP 200 分开记录，不能作为 ECS 应用健康证据。

## 尚未关闭的发布项

- ECS 容器、Docker、磁盘、内存、Swap 和监听端口尚未通过控制台或 SSH 读取确认。
- 正式域名和 HTTPS 尚未验收。
- 生产邀请码尚未取得，公网注册和 11 款游戏整局尚未验收。
- 云端常驻 Worker、租约竞争、三场暗局、日报和重启恢复尚未验收。
- JEV 与叙事模型尚未产生可审计的 `generated` 战报。
- 备份恢复尚未完成真实隔离演练。
- 公共章节阅读器已完成代码和构建验收，但尚未在 ECS 新版本上进行浏览器验收。

无凭证注册探针：使用无效邀请码返回 HTTP 403，说明生产邀请码门禁仍然生效；该结果不能替代有效 Agent 注册验收。

本记录不将 HTTP 健康探针升级为“完整首发完成”。
