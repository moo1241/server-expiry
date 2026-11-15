# 服务器到期提醒系统

这是一个单管理员的服务器到期提醒系统，使用 Vue 3、Vite、TypeScript、Element Plus、Node.js、Fastify、SQLite、node-cron 和 Telegram Bot API。

## 已实现

- 管理员登录和会话认证
- 服务器添加、编辑、查询和删除
- 服务商和地区可搜索、可创建新值
- IP 地址可选
- 北京时间和 UTC 两种显示时区
- 到期剩余时间计算
- 到期提醒、失败重试和 Telegram 通知
- 提醒计划去重和发送历史
- 系统设置和中文管理后台

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Ubuntu 服务器、Nginx 和 systemd

## 本地安装和启动

在项目根目录执行：

~~~bash
npm install
cp .env.example apps/backend/.env
npm run db:migrate
npm run dev
~~~

Windows PowerShell：

~~~powershell
Copy-Item .env.example apps/backend/.env
~~~

前端地址为 http://localhost:5173，后端健康检查为 http://localhost:3000/api/health。

## 数据库和管理员

执行数据库迁移：

~~~bash
npm run db:migrate
~~~

创建管理员时，临时在 apps/backend/.env 中加入 ADMIN_USERNAME 和 ADMIN_PASSWORD，然后执行：

~~~bash
npm run admin:create
~~~

成功后删除这两个临时环境变量。密码使用 Node.js scrypt 哈希保存。

## 服务器管理

- GET /api/servers 查询服务器
- POST /api/servers 添加服务器
- PATCH /api/servers/:id 编辑服务器
- DELETE /api/servers/:id 删除服务器并清理提醒历史
- POST /api/servers/:id/renew 续费并生成新提醒代次

时间在数据库中统一使用 UTC，后台可选北京时间或 UTC。

## 提醒频率

在后台系统设置中修改提醒规则。默认规则为到期前 7、3、2、1 天和到期当天，每条规则可设置每天 1 到 24 次。多次提醒会在对应的 24 小时窗口内平均分布。

服务器停机后积累多条过期计划时，调度器会合并旧计划，只发送最新的一条。

## Telegram 通知

### 1. 创建 Telegram Bot

在 Telegram 中打开 `@BotFather`，发送 `/newbot`，按提示设置机器人名称和用户名。完成后会得到一串 Bot Token，只保存到服务器的 `apps/backend/.env`，不要提交到 GitHub。

### 2. 获取 Chat ID

先在 Telegram 中打开刚创建的机器人并发送一条消息，例如 `/start`。然后在 Ubuntu 服务器执行下面的命令，把 `你的BOT_TOKEN` 替换为实际 Token：

~~~bash
curl "https://api.telegram.org/bot你的BOT_TOKEN/getUpdates"
~~~

在返回的 JSON 中找到 `message.chat.id`。个人聊天通常是正数，群组聊天通常是负数。把这个值作为 `TELEGRAM_CHAT_ID`。

### 3. 配置服务器环境变量

编辑后端环境文件：

~~~bash
cd /opt/server-expiry-reminder
nano apps/backend/.env
~~~

加入或修改下面三项。不要把真实 Token 和 Chat ID 发到公开仓库：

~~~env
TELEGRAM_BOT_TOKEN=你的BOT_TOKEN
TELEGRAM_CHAT_ID=你的CHAT_ID
REMINDER_SCHEDULER_ENABLED=true
~~~

保存后重启服务：

~~~bash
systemctl restart server-expiry-reminder
systemctl is-active server-expiry-reminder
~~~

### 4. 测试机器人

登录管理后台，打开左侧的 Telegram 页面，确认“机器人配置”和“调度器状态”均已启用，然后发送测试消息。也可以先检查接口：

~~~bash
curl -sS http://127.0.0.1:3000/api/telegram/status
~~~

返回 `configured: true` 和 `schedulerEnabled: true` 后，服务器到期提醒任务会按照后台设置的提醒规则自动发送。消息使用中文，并按后台选择的北京时间或 UTC 显示。

## 构建和 Ubuntu 部署

~~~bash
npm run build
systemctl restart server-expiry-reminder
~~~

Nginx 提供 apps/frontend/dist 静态文件，并将 /api 转发到 127.0.0.1:3000。

## 安全提示

不要将 Bot Token、Chat ID 和管理员密码写入源码或提交到 Git。启用 HTTPS 后将 SESSION_COOKIE_SECURE 设为 true。
## 域名访问配置

如果使用域名访问，先在域名服务商添加 DNS A 记录：

~~~text
主机记录：@
记录类型：A
记录值：服务器公网 IP
~~~

等待 DNS 解析生效后，在 Ubuntu 服务器执行：

~~~bash
cd /opt/server-expiry-reminder
cp deploy/nginx/server-expiry-reminder.http.conf /etc/nginx/sites-available/server-expiry-reminder
nano /etc/nginx/sites-available/server-expiry-reminder
ln -sfn /etc/nginx/sites-available/server-expiry-reminder /etc/nginx/sites-enabled/server-expiry-reminder
nginx -t
systemctl reload nginx
~~~

测试域名：

~~~bash
curl -i http://你的域名/api/health
~~~

在 apps/backend/.env 中设置：

~~~env
SESSION_COOKIE_SECURE=true
~~~

然后重启后端：

~~~bash
systemctl restart server-expiry-reminder
~~~

使用服务器 IP 访问时不需配置域名证书。HTTPS 需要你提前准备证书文件，并在 Nginx 配置中填写证书和私钥路径。

## Nginx HTTPS 配置说明

HTTPS 模板包含默认拒绝站点和真实域名站点。默认拒绝站点用来拦截通过服务器 IP 的请求，使用 ssl_reject_handshake 不需要填写证书。

真实域名站点才提供页面和 API，只需在这一段中填写：

~~~nginx
server_name YOUR_DOMAIN;

ssl_certificate /etc/ssl/server-expiry/fullchain.pem;
ssl_certificate_key /etc/ssl/server-expiry/privkey.pem;
~~~

复制 HTTPS 模板后，直接编辑文件替换域名和证书位置：

~~~bash
cp deploy/nginx/server-expiry-reminder.manual-https.conf /etc/nginx/sites-available/server-expiry-reminder
nano /etc/nginx/sites-available/server-expiry-reminder
~~~

在编辑器中把 `YOUR_DOMAIN` 替换为实际域名，把证书路径替换为实际文件路径。修改后执行：

~~~bash
nginx -t
systemctl reload nginx
~~~

## GitHub Releases 更新步骤

每次发布新版本时，在 GitHub 的 Releases 页面下载实际版本的安装包，例如 server-expiry-reminder-v1.1.0.zip。把实际文件名填入下面的 RELEASE_ZIP 变量后，再更新 Ubuntu 服务器。

1. 将新压缩包上传到服务器的 /root/ 目录。
2. 进入项目目录并手动备份数据库。
3. 停止 systemd 服务。
4. 将新安装包解压到项目目录。压缩包不包含 apps/backend/.env，现有环境变量会保留。
5. 安装新依赖、执行数据库迁移并重新构建。
6. 启动服务并检查健康接口。
7. 如果更新包包含 Nginx 配置变更，在检查配置后重载 Nginx。

~~~bash
cd /opt/server-expiry-reminder
RELEASE_ZIP=server-expiry-reminder-vX.Y.Z.zip
npm run db:backup
systemctl stop server-expiry-reminder
unzip -o "/root/$RELEASE_ZIP" -d /opt/server-expiry-reminder
npm install --jobs=1 --no-audit --no-fund
npm run db:migrate
npm run build
systemctl start server-expiry-reminder
systemctl is-active server-expiry-reminder
curl -i http://127.0.0.1:3000/api/health
~~~

如果更新了 Nginx 配置，再执行：

~~~bash
nginx -t
systemctl reload nginx
~~~

更新失败时，先查看日志，不要删除数据库文件：

~~~bash
systemctl status server-expiry-reminder --no-pager -l
journalctl -u server-expiry-reminder -n 80 --no-pager
~~~
