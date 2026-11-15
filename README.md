# 服务器到期提醒系统部署手册

本手册用于在 Ubuntu 服务器上部署服务器到期提醒系统。系统使用 Node.js、SQLite、Nginx 和 systemd，运行时不需要 Docker、Redis 或 MySQL。

## 1. 环境要求

- Ubuntu 服务器
- Node.js 20 或更高版本
- npm 10 或更高版本
- Nginx
- systemd
- 一个已经准备好的域名
- HTTPS 证书文件

检查 Node.js 和 npm：

~~~bash
node --version
npm --version
~~~

## 2. 创建目录并上传安装包

先在 Ubuntu 服务器执行：

~~~bash
mkdir -p /opt/server-expiry-reminder
~~~

从 GitHub Releases 下载运行安装包，例如 `server-expiry-reminder-v0.1.3-runtime.zip`，然后上传到 `/opt/server-expiry-reminder`。

可以使用服务器面板的文件上传功能，也可以在 Windows PowerShell 中执行：

~~~powershell
$SERVER_IP = "服务器公网IP"
$PACKAGE = "server-expiry-reminder-v0.1.3-runtime.zip"
scp ".\$PACKAGE" "root@${SERVER_IP}:/opt/server-expiry-reminder/"
~~~

## 3. 安装项目

登录 Ubuntu 后执行：

~~~bash
cd /opt/server-expiry-reminder
PACKAGE=server-expiry-reminder-v0.1.3-runtime.zip
unzip -o "$PACKAGE" -d /opt/server-expiry-reminder
npm install --jobs=1 --no-audit --no-fund
cp -n .env.example apps/backend/.env
nano apps/backend/.env
~~~

在 `apps/backend/.env` 中至少确认以下配置。域名和 HTTPS 配置完成后，再使用 `SESSION_COOKIE_SECURE=true`：

~~~env
HOST=127.0.0.1
PORT=3000
CORS_ORIGIN=https://你的域名
SESSION_COOKIE_SECURE=true
REMINDER_SCHEDULER_ENABLED=false
~~~

执行数据库迁移并构建前端和后端：

~~~bash
npm run db:migrate
npm run build
~~~

## 4. 创建管理员账号

在项目目录执行。密码至少 8 位：

~~~bash
read -r -p "管理员用户名: " ADMIN_USERNAME
read -r -s -p "管理员密码: " ADMIN_PASSWORD
echo
export ADMIN_USERNAME ADMIN_PASSWORD
npm run admin:create
unset ADMIN_USERNAME ADMIN_PASSWORD
~~~

## 5. 配置 systemd 服务

如果系统中还没有运行用户，先创建运行用户：

~~~bash
if ! id server-reminder >/dev/null 2>&1; then
  useradd --system --home /opt/server-expiry-reminder --shell /usr/sbin/nologin server-reminder
fi
install -d -o server-reminder -g server-reminder /opt/server-expiry-reminder/apps/backend/data
install -d -o server-reminder -g server-reminder /opt/server-expiry-reminder/apps/backend/backups
chown -R server-reminder:server-reminder /opt/server-expiry-reminder/apps/backend/data /opt/server-expiry-reminder/apps/backend/backups
chown root:server-reminder /opt/server-expiry-reminder/apps/backend/.env
chmod 640 /opt/server-expiry-reminder/apps/backend/.env
~~~

安装并启动服务：

~~~bash
install -m 644 deploy/systemd/server-expiry-reminder.service /etc/systemd/system/server-expiry-reminder.service
systemctl daemon-reload
systemctl enable --now server-expiry-reminder
sleep 2
systemctl is-active server-expiry-reminder
curl -i http://127.0.0.1:3000/api/health
~~~

返回 `HTTP/1.1 200 OK` 表示后端正常运行。

## 6. 配置 Telegram 通知

### 创建机器人

在 Telegram 中打开 `@BotFather`，发送 `/newbot`，按提示完成创建并保存 Bot Token。不要把 Token 提交到 GitHub。

### 获取 Chat ID

打开刚创建的机器人并发送 `/start`，然后在服务器执行下面的命令，把 `你的BOT_TOKEN` 替换为真实 Token：

~~~bash
curl "https://api.telegram.org/bot你的BOT_TOKEN/getUpdates"
~~~

在返回内容中找到 `message.chat.id`，将它作为 Chat ID。个人聊天通常是正数，群组聊天通常是负数。

编辑环境变量：

~~~bash
nano /opt/server-expiry-reminder/apps/backend/.env
~~~

加入或修改：

~~~env
TELEGRAM_BOT_TOKEN=你的BOT_TOKEN
TELEGRAM_CHAT_ID=你的CHAT_ID
REMINDER_SCHEDULER_ENABLED=true
~~~

重启服务：

~~~bash
systemctl restart server-expiry-reminder
systemctl is-active server-expiry-reminder
~~~

登录管理后台，打开 Telegram 页面，发送测试消息。到期提醒会按照后台设置的规则发送，消息使用中文，并按后台选择的北京时间或 UTC 显示。

如果服务器还没有安装 Nginx，先执行：

~~~bash
apt update
apt install -y nginx
systemctl enable --now nginx
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
rm -f /etc/nginx/sites-enabled/default
~~~

## 7. 配置域名和 Nginx

先在域名服务商添加 DNS A 记录：

~~~text
主机记录：@
记录类型：A
记录值：服务器公网 IP
~~~

把 HTTPS 证书文件放到服务器，例如：

~~~text
/etc/ssl/server-expiry/fullchain.pem
/etc/ssl/server-expiry/privkey.pem
~~~

复制 Nginx HTTPS 配置并编辑：

~~~bash
cd /opt/server-expiry-reminder
cp deploy/nginx/server-expiry-reminder.manual-https.conf /etc/nginx/sites-available/server-expiry-reminder
nano /etc/nginx/sites-available/server-expiry-reminder
~~~

在文件中替换以下内容：

~~~nginx
server_name YOUR_DOMAIN;

ssl_certificate /etc/ssl/server-expiry/fullchain.pem;
ssl_certificate_key /etc/ssl/server-expiry/privkey.pem;
~~~

如果 `nginx -t` 提示 `duplicate default server`，先关闭 Ubuntu 自带的默认站点：

~~~bash
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
~~~

把 `YOUR_DOMAIN` 替换为真实域名，把证书路径替换为实际路径，然后启用配置：

~~~bash
ln -sfn /etc/nginx/sites-available/server-expiry-reminder /etc/nginx/sites-enabled/server-expiry-reminder
nginx -t
systemctl reload nginx
systemctl restart server-expiry-reminder
~~~

访问：

~~~text
https://你的域名
~~~

## 8. 手动备份数据库

系统不会自动创建在线备份。需要备份时，在项目目录执行：

~~~bash
cd /opt/server-expiry-reminder
npm run db:backup
~~~

备份文件位于：

~~~text
/opt/server-expiry-reminder/apps/backend/backups/
~~~

请把重要备份手动下载到其他设备保存。

## 9. 更新版本

从 GitHub Releases 下载新版本安装包并上传到服务器的 `/root/` 目录，然后执行：

~~~bash
cd /opt/server-expiry-reminder
RELEASE_ZIP=server-expiry-reminder-vX.Y.Z-runtime.zip
npm run db:backup
systemctl stop server-expiry-reminder
unzip -o "/root/$RELEASE_ZIP" -d /opt/server-expiry-reminder
npm install --jobs=1 --no-audit --no-fund
npm run db:migrate
npm run build
install -m 644 deploy/systemd/server-expiry-reminder.service /etc/systemd/system/server-expiry-reminder.service
systemctl daemon-reload
systemctl start server-expiry-reminder
systemctl is-active server-expiry-reminder
curl -i http://127.0.0.1:3000/api/health
~~~

安装包不包含 `apps/backend/.env`，原有配置会保留。更新失败时不要删除数据库，先查看日志：

~~~bash
systemctl status server-expiry-reminder --no-pager -l
journalctl -u server-expiry-reminder -n 80 --no-pager
~~~

如果更新了 Nginx 配置，再执行：

~~~bash
nginx -t
systemctl reload nginx
~~~
