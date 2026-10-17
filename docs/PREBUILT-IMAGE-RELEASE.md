# 预构建镜像发布与 ECS 运行

本链路把构建和运行分开：推送版本 tag 后，GitHub Actions 在 GitHub runner 上构建并推送 `app` 与 `agent-worker` 到 GHCR；ECS 只拉取已经构建好的镜像并运行。ECS 不执行 Vite build、Docker build 或 `docker compose build`。

## 发布

推荐推送形如 `v2026.10.17` 的 tag：

```bash
git tag v2026.10.17
git push origin v2026.10.17
```

也可以在 GitHub Actions 中手动运行 `Container release`，用于对指定分支或提交生成 SHA 镜像；手动运行不会生成版本 tag 别名，生产环境应优先使用版本 tag。

工作流使用 `GITHUB_TOKEN` 登录 GHCR，并发布两类不可混淆的 tag：

```text
ghcr.io/OWNER/REPOSITORY/app:<git-sha>
ghcr.io/OWNER/REPOSITORY/app:<version-tag>
ghcr.io/OWNER/REPOSITORY/agent-worker:<git-sha>
ghcr.io/OWNER/REPOSITORY/agent-worker:<version-tag>
```

等待 Actions 成功后，在 ECS 创建 `deploy/.env.prebuilt`，参考 [`deploy/prebuilt-release.env.example`](../deploy/prebuilt-release.env.example)。将 `OWNER/REPOSITORY` 和版本 tag 替换为实际值。生产环境建议使用 SHA 镜像值，版本 tag 仅作为发布可读别名。

## ECS 部署

先登录 GHCR。使用有权读取私有包的 token；不要把 token 写入 env 文件或命令历史：

```bash
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
set -a
. ./deploy/.env.prebuilt
set +a
```

在仓库根目录执行拉取，并把镜像映射到现有 Compose 的服务名。由于当前 `docker-compose.cloud.yml` 使用 `build:` 而没有 `image:`，这两个 `docker tag` 是必要的兼容步骤；它们只改本机镜像引用，不会触发构建：

```bash
docker pull "$APP_IMAGE"
docker pull "$AGENT_WORKER_IMAGE"
docker tag "$APP_IMAGE" "${COMPOSE_PROJECT_NAME:-ten-days-gambit}-app:latest"
docker tag "$AGENT_WORKER_IMAGE" "${COMPOSE_PROJECT_NAME:-ten-days-gambit}-agent-worker:latest"
```

执行一次性数据库迁移，再启动服务。迁移失败时停止，不要继续切流：

```bash
docker compose --env-file deploy/.env.prebuilt -f docker-compose.cloud.yml run --rm --no-build app pnpm db:migrate
docker compose --env-file deploy/.env.prebuilt -f docker-compose.cloud.yml --profile agent-worker up -d --no-build
```

若本次不启用常驻 Agent，省略 `--profile agent-worker`。`--no-build` 是发布门禁；任何需要构建的提示都应视为部署失败。

## 健康检查与验收

等待 Compose 健康状态，并分别检查就绪接口：

```bash
docker compose --env-file deploy/.env.prebuilt -f docker-compose.cloud.yml ps
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:${TDG_PORT:-8080}/api/health
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:${TDG_PORT:-8080}/api/ready
```

继续核对日志和实际运行镜像：

```bash
docker compose --env-file deploy/.env.prebuilt -f docker-compose.cloud.yml logs --tail=200 app
docker inspect "${COMPOSE_PROJECT_NAME:-ten-days-gambit}-app" --format '{{.Config.Image}}'
```

只有迁移成功、`health` 与 `ready` 成功、容器状态为 `healthy` 且日志无启动错误时，才允许把流量切到本次发布。公网入口仍需从实际访问网络验证，ECS 本机 HTTP 200 不代表公网验收完成。

## 失败回滚

保留上一版 `deploy/.env.prebuilt`，并为每次发布记录上一版 SHA。当前版本任一迁移、启动或健康检查失败时：

1. 保留失败容器日志和 `docker compose ps` 输出。
2. 将 `APP_IMAGE` 与 `AGENT_WORKER_IMAGE` 改回上一版 SHA 镜像。
3. 重复 `docker pull`、`docker tag`，然后执行 `docker compose ... up -d --no-build`。
4. 重新执行健康检查；若迁移已经改变数据库结构，先确认迁移是否向后兼容，再决定是否恢复数据库备份。

不要删除上一版镜像，直到新版本完成公网验收。此流程不会修改 `docker-compose.cloud.yml`，也不会操作 GitHub 或 ECS 资源。

