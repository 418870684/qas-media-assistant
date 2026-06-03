# QAS Media Assistant

一个接在 QAS Web UI 前面的影视搜索与转存助手。它提供网页界面，支持搜索资源、预览夸克分享目录、查看文件大小、生成 QAS 转存任务，也预留了 Telegram Bot 入口。

## 功能

- 输入片名后调用 QAS 搜索接口，返回候选资源。
- 一键把候选资源填入 QAS 任务表单。
- 直接粘贴夸克分享链接并预览文件。
- 进入分享目录，查看目录内文件。
- 显示原文件名、新文件名、集数、文件大小。
- 创建 QAS 任务，并可选择立即运行。
- 设置 `WEB_PASSWORD` 后，访问页面会先显示登录页，登录成功后才进入主界面。
- 可选 Telegram Bot。

## 环境变量

复制模板：

```bash
cp .env.example .env
```

常用配置：

```env
PORT=8787
PUBLISH_HOST=127.0.0.1
QAS_HOST=http://NAS内网IP:5005
QAS_API_TOKEN=你的QAS_API_TOKEN
WEB_PASSWORD=设置一个长一点的网页密码
DEFAULT_SAVE_ROOT=/影视
SEARCH_DEPTH=0
```

说明：

- `PUBLISH_HOST=127.0.0.1`：推荐给 Lucky 同机反代使用，服务只监听 NAS 本机。
- `PUBLISH_HOST=0.0.0.0`：允许局域网直接访问 `http://NAS内网IP:8787`。
- `QAS_HOST`：容器里能访问到的 QAS 地址。QAS 也在同一台 NAS 时，优先填 NAS 内网 IP，不要填 `127.0.0.1`。
- `WEB_PASSWORD`：远程访问时强烈建议填写。

## 登录与安全

设置 `WEB_PASSWORD` 后：

- 打开页面只显示登录页。
- 登录成功后浏览器会保存一个 HttpOnly 会话 Cookie。
- 刷新页面会保持登录状态。
- 点页面左上角“退出”可以清除登录状态。
- 所有 QAS 操作接口仍会校验登录状态。

## GitHub 镜像发布

本项目通过 GitHub Actions 发布镜像到 GitHub Container Registry：

```text
ghcr.io/418870684/qas-media-assistant:latest
```

发布条件：

- 推送到 `main` 分支会自动发布 `latest`。
- 推送 `v*` 标签会发布对应版本标签。
- 也可以在 GitHub Actions 页面手动运行 `Publish Docker image`。

首次使用 GHCR 时，在 GitHub 仓库里检查：

- `Settings -> Actions -> General -> Workflow permissions` 设为 `Read and write permissions`。
- 镜像发布后，在 GitHub Packages 里把包可见性设为 Public。公开后 NAS 拉镜像不需要登录。

## NAS Docker 部署

在 NAS 上创建目录，例如：

```bash
mkdir -p /volume1/docker/qas-media-assistant
```

NAS 上只需要放这两个文件：

```text
docker-compose.yml
.env
```

`.env` 示例：

```env
PORT=8787
PUBLISH_HOST=127.0.0.1
QAS_HOST=http://NAS内网IP:5005
QAS_API_TOKEN=你的QAS_API_TOKEN
WEB_PASSWORD=设置一个长一点的网页密码
DEFAULT_SAVE_ROOT=/影视
SEARCH_DEPTH=0
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_IDS=
```

启动：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

升级后重建：

```bash
docker compose pull
docker compose up -d
```

停止：

```bash
docker compose down
```

## Lucky 反代建议

推荐架构：

```text
外网域名 HTTPS
  -> Lucky
  -> http://127.0.0.1:8787
  -> QAS Media Assistant
  -> QAS Web UI
```

Lucky 里新增反向代理：

- 监听域名：例如 `qas.example.com`
- 目标地址：`http://127.0.0.1:8787`
- 开启 HTTPS 证书。
- 开启 HTTP 自动跳转 HTTPS。
- 代理超时建议设置到 120 秒以上，读取分享目录时可能比较慢。
- WebSocket 可以开启，当前页面不用也不影响。

远程访问建议：

- 最低配置：Lucky HTTPS + `WEB_PASSWORD`。
- 更安全：Tailscale / ZeroTier / WireGuard + Lucky HTTPS + `WEB_PASSWORD`。
- 不建议：不设密码直接暴露公网。

## 网页使用

搜索：

```text
搜索 凡人修仙传
```

直接粘贴链接：

```text
https://pan.quark.cn/s/xxxx 保存到 /动漫/凡人修仙传
```

查看任务：

```text
任务列表
```

## Telegram Bot

在 `.env` 里填：

```env
TELEGRAM_BOT_TOKEN=你的机器人Token
TELEGRAM_ALLOWED_CHAT_IDS=允许使用的chat_id，多个用英文逗号分隔
```

机器人命令：

```text
/search 凡人修仙传
/tasks
/save 1 /动漫/凡人修仙传
```

## 注意

`.env` 里有 QAS Token 和网页密码，不要上传到公开仓库，也不要发给别人。
