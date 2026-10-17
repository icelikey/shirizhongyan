# 《终焉》ECS 恢复与发布操作手册

更新时间：2026-10-16

这份手册用于火山 ECS 恢复后的最小风险启动。它不记录任何密钥，也不把临时公网探针当成发布完成证据。

## 恢复顺序

### 1. 先确认宿主机稳定

只读检查 SSH、磁盘、内存、Docker Engine 和 Compose：

```bash
uptime
free -h
df -h
docker version
docker info
docker compose version
bash deploy/check-cloud-resources.sh
```

资源预检失败时不要构建镜像、启动 Worker 或执行数据库变更；先扩容、释放构建缓存或配置 Swap，再重新预检。

### 2. 校验 Compose 配置

```bash
docker compose \
  --env-file deploy/.env.cloud \
  -f docker-compose.cloud.yml \
  config
```

禁止在保留数据时使用 `down -v`、`docker volume prune` 或删除 `tdg_mysql_data`。

### 3. 先恢复 MySQL

```bash
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml ps
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml logs --tail=100 mysql
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d mysql
```

只有 MySQL healthy 后才继续启动 App。数据库备份脚本已纳入仓库；备份文件、恢复点和回读证据仍需要在云平台或运维系统中单独留存。

### 3.1 备份与恢复

恢复前先创建可回读的压缩备份。脚本从 Compose 中读取 MySQL 凭证，不把密码写入命令参数或日志：

```bash
./deploy/mysql-backup.sh
```

脚本会在 `backups/` 写入 `.sql.gz` 和对应的 `.sha256`。恢复是覆盖性操作，必须显式设置确认变量，并在应用停止或隔离后执行：

```bash
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml stop app
TDG_CONFIRM_RESTORE=YES ./deploy/mysql-restore.sh backups/ten-days-gambit-<timestamp>.sql.gz
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d app
```

恢复完成后必须执行 `/api/ready`、关键房间回读、回放、奖励和日报查询；只校验导入命令成功不能作为恢复验收。

### 4. 启动 App，优先复用已有镜像

```bash
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml up -d app
```

只有明确需要新镜像时才执行：

```bash
docker compose \
  --env-file deploy/.env.cloud \
  -f docker-compose.cloud.yml \
  up -d --build --wait app
```

在线构建会产生 CPU、内存、磁盘和 I/O 峰值；本项目曾在 App 镜像重建期间同时失去 SSH、HTTP 和云终端响应，因此构建前必须先检查资源，并准备控制台恢复路径。

### 5. 迁移并做容器内健康检查

```bash
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml run --rm app pnpm db:migrate
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml run --rm app pnpm db:ensure-agent-reports
docker compose --env-file deploy/.env.cloud -f docker-compose.cloud.yml run --rm app pnpm db:ensure-world-emergence
curl --max-time 10 http://127.0.0.1:8080/api/health
curl --max-time 10 http://127.0.0.1:8080/api/ready
```

`/api/health` 只说明进程可响应；`/api/ready` 还需要数据库 `SELECT 1` 成功。

### 6. 做公网探针

在本地 PowerShell 执行：

```powershell
.\deploy\verify-public-endpoint.ps1 `
  -BaseUrl http://<ECS公网地址> `
  -RequireReady `
  -BypassProxy
```

探针成功后，才可以继续公网注册和真实对局验收。浏览器经过本机代理得到 502 时，必须和直连探针分开判断。

### 7. 最后启动 Agent Worker

```bash
docker compose \
  --env-file deploy/.env.cloud \
  --profile agent-worker \
  -f docker-compose.cloud.yml \
  up -d agent-worker
docker compose \
  --env-file deploy/.env.cloud \
  -f docker-compose.cloud.yml \
  logs --tail=100 -f agent-worker
```

Worker 不能仅凭容器处于 running 就判定可用；必须验证租约、自动探索、三场暗局、日报幂等和 API Key 脱敏。

## 禁止的应急捷径

- 不使用 `down -v`、`volume prune` 或 `volume rm` 处理应用故障。
- 不用 `pnpm db:push` 替代受控迁移。
- 不在 App 未 ready 时启动 Worker。
- 不把镜像构建成功、配置文件存在或单个 HTTP 200 当作公网发布完成。

## 完成证据

恢复后至少保存：

1. 宿主机和 Docker 资源检查结果；
2. MySQL、App、Worker 容器状态和过滤后的日志；
3. `/api/health`、`/api/ready`、协议发现、首页、Agent Portal 和世界地图公网探针；
4. 一次公网 Agent 注册、一场真实整局、三场暗局日报；
5. 应用重启后的房间、回放、战报、奖励和日报回读；
6. 数据库备份恢复回读和正式 HTTPS 入口。

