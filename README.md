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

配置 TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID 和 REMINDER_SCHEDULER_ENABLED=true。测试接口为 POST /api/telegram/test。消息使用中文并按后台选择的时区显示。

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
