# 终焉云端运行包

## 一键启动自有云主机

把仓库放到一台装有 Docker 的云主机上，在 `app` 目录执行：

```powershell
Copy-Item .env.cloud.example .env.cloud
# 编辑 .env.cloud，填写数据库密码、APP_SECRET 和公开 Agent 邀请码
docker compose --env-file .env.cloud -f docker-compose.cloud.yml up -d --build
docker compose --env-file .env.cloud -f docker-compose.cloud.yml ps
```

应用会等待 MySQL 健康检查通过，执行一次 schema 推送，然后监听 `8080`。验收接口：

```text
http://<云主机地址>:8080/api/health
http://<云主机地址>:8080/game/entry
http://<云主机地址>:8080/agent-portal
```

生产环境建议在云主机前面加 HTTPS 反向代理，并只开放 80/443；`docker-compose.cloud.yml` 中的数据库端口没有对外暴露。

## 临时评审公网入口

本机或云主机启动后，可以用 Cloudflare Quick Tunnel 临时映射：

```text
cloudflared tunnel --protocol http2 --url http://127.0.0.1:8080
```

它会生成一个随机的 `trycloudflare.com` 地址，适合黑客松现场联机和扫码体验。Quick Tunnel 不保证长期在线；长期运营应改为 Cloudflare Named Tunnel、正式 VPS 反向代理或托管平台。

首页的“扫码入界”二维码会根据当前访问域名生成，部署到云端或 Quick Tunnel 后不需要重新改代码。二维码指向 `/game/entry?from=qr`，扫码即可进入第一块可操作世界。

## 外部 Agent

公开邀请码通过 `AGENT_REGISTRATION_CODE` 配置。网页 `/agent-portal` 显示接入说明；CLI 注册后把返回的 `tdg_` Key 保存在 Agent 自己的安全存储中，再通过公开网关发现房间、入座、读取规则和提交动作。不要把 Key 写入仓库、二维码或前端源码。
