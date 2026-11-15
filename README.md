# &#x670d;&#x52a1;&#x5668;&#x5230;&#x671f;&#x63d0;&#x9192;&#x7cfb;&#x7edf;

&#x8fd9;&#x662f;&#x4e00;&#x4e2a;&#x5355;&#x7ba1;&#x7406;&#x5458;&#x7684;&#x670d;&#x52a1;&#x5668;&#x5230;&#x671f;&#x63d0;&#x9192;&#x7cfb;&#x7edf;&#xff0c;&#x4f7f;&#x7528; Vue 3&#x3001;Vite&#x3001;TypeScript&#x3001;Element Plus&#x3001;Node.js&#x3001;Fastify&#x3001;SQLite&#x3001;node-cron &#x548c; Telegram Bot API&#x3002;

## &#x5df2;&#x5b9e;&#x73b0;

- &#x7ba1;&#x7406;&#x5458;&#x767b;&#x5f55;&#x548c;&#x4f1a;&#x8bdd;&#x8ba4;&#x8bc1;
- &#x670d;&#x52a1;&#x5668;&#x6dfb;&#x52a0;&#x3001;&#x7f16;&#x8f91;&#x3001;&#x67e5;&#x8be2;&#x548c;&#x5220;&#x9664;
- &#x670d;&#x52a1;&#x5546;&#x548c;&#x5730;&#x533a;&#x53ef;&#x641c;&#x7d22;&#x3001;&#x53ef;&#x521b;&#x5efa;&#x65b0;&#x503c;
- IP &#x5730;&#x5740;&#x53ef;&#x9009;
- &#x5317;&#x4eac;&#x65f6;&#x95f4;&#x548c; UTC &#x4e24;&#x79cd;&#x663e;&#x793a;&#x65f6;&#x533a;
- &#x5230;&#x671f;&#x5269;&#x4f59;&#x65f6;&#x95f4;&#x8ba1;&#x7b97;
- &#x5230;&#x671f;&#x63d0;&#x9192;&#x3001;&#x5931;&#x8d25;&#x91cd;&#x8bd5;&#x548c; Telegram &#x901a;&#x77e5;
- &#x63d0;&#x9192;&#x8ba1;&#x5212;&#x53bb;&#x91cd;&#x548c;&#x53d1;&#x9001;&#x5386;&#x53f2;
- &#x7cfb;&#x7edf;&#x8bbe;&#x7f6e;&#x548c;&#x4e2d;&#x6587;&#x7ba1;&#x7406;&#x540e;&#x53f0;

## &#x73af;&#x5883;&#x8981;&#x6c42;

- Node.js 20 &#x6216;&#x66f4;&#x9ad8;&#x7248;&#x672c;
- npm 10 &#x6216;&#x66f4;&#x9ad8;&#x7248;&#x672c;
- Ubuntu &#x670d;&#x52a1;&#x5668;&#x3001;Nginx &#x548c; systemd

## &#x672c;&#x5730;&#x5b89;&#x88c5;&#x548c;&#x542f;&#x52a8;

&#x5728;&#x9879;&#x76ee;&#x6839;&#x76ee;&#x5f55;&#x6267;&#x884c;&#xff1a;

~~~bash
npm install
cp .env.example apps/backend/.env
npm run db:migrate
npm run dev
~~~

Windows PowerShell&#xff1a;

~~~powershell
Copy-Item .env.example apps/backend/.env
~~~

&#x524d;&#x7aef;&#x5730;&#x5740;&#x4e3a; http://localhost:5173&#xff0c;&#x540e;&#x7aef;&#x5065;&#x5eb7;&#x68c0;&#x67e5;&#x4e3a; http://localhost:3000/api/health&#x3002;

## &#x6570;&#x636e;&#x5e93;&#x548c;&#x7ba1;&#x7406;&#x5458;

&#x6267;&#x884c;&#x6570;&#x636e;&#x5e93;&#x8fc1;&#x79fb;&#xff1a;

~~~bash
npm run db:migrate
~~~

&#x521b;&#x5efa;&#x7ba1;&#x7406;&#x5458;&#x65f6;&#xff0c;&#x4e34;&#x65f6;&#x5728; apps/backend/.env &#x4e2d;&#x52a0;&#x5165; ADMIN_USERNAME &#x548c; ADMIN_PASSWORD&#xff0c;&#x7136;&#x540e;&#x6267;&#x884c;&#xff1a;

~~~bash
npm run admin:create
~~~

&#x6210;&#x529f;&#x540e;&#x5220;&#x9664;&#x8fd9;&#x4e24;&#x4e2a;&#x4e34;&#x65f6;&#x73af;&#x5883;&#x53d8;&#x91cf;&#x3002;&#x5bc6;&#x7801;&#x4f7f;&#x7528; Node.js scrypt &#x54c8;&#x5e0c;&#x4fdd;&#x5b58;&#x3002;

## &#x670d;&#x52a1;&#x5668;&#x7ba1;&#x7406;

- GET /api/servers &#x67e5;&#x8be2;&#x670d;&#x52a1;&#x5668;
- POST /api/servers &#x6dfb;&#x52a0;&#x670d;&#x52a1;&#x5668;
- PATCH /api/servers/:id &#x7f16;&#x8f91;&#x670d;&#x52a1;&#x5668;
- DELETE /api/servers/:id &#x5220;&#x9664;&#x670d;&#x52a1;&#x5668;&#x5e76;&#x6e05;&#x7406;&#x63d0;&#x9192;&#x5386;&#x53f2;
- POST /api/servers/:id/renew &#x7eed;&#x8d39;&#x5e76;&#x751f;&#x6210;&#x65b0;&#x63d0;&#x9192;&#x4ee3;&#x6b21;

&#x65f6;&#x95f4;&#x5728;&#x6570;&#x636e;&#x5e93;&#x4e2d;&#x7edf;&#x4e00;&#x4f7f;&#x7528; UTC&#xff0c;&#x540e;&#x53f0;&#x53ef;&#x9009;&#x5317;&#x4eac;&#x65f6;&#x95f4;&#x6216; UTC&#x3002;

## &#x63d0;&#x9192;&#x9891;&#x7387;

&#x5728;&#x540e;&#x53f0;&#x7cfb;&#x7edf;&#x8bbe;&#x7f6e;&#x4e2d;&#x4fee;&#x6539;&#x63d0;&#x9192;&#x89c4;&#x5219;&#x3002;&#x9ed8;&#x8ba4;&#x89c4;&#x5219;&#x4e3a;&#x5230;&#x671f;&#x524d; 7&#x3001;3&#x3001;2&#x3001;1 &#x5929;&#x548c;&#x5230;&#x671f;&#x5f53;&#x5929;&#xff0c;&#x6bcf;&#x6761;&#x89c4;&#x5219;&#x53ef;&#x8bbe;&#x7f6e;&#x6bcf;&#x5929; 1 &#x5230; 24 &#x6b21;&#x3002;&#x591a;&#x6b21;&#x63d0;&#x9192;&#x4f1a;&#x5728;&#x5bf9;&#x5e94;&#x7684; 24 &#x5c0f;&#x65f6;&#x7a97;&#x53e3;&#x5185;&#x5e73;&#x5747;&#x5206;&#x5e03;&#x3002;

&#x670d;&#x52a1;&#x5668;&#x505c;&#x673a;&#x540e;&#x79ef;&#x7d2f;&#x591a;&#x6761;&#x8fc7;&#x671f;&#x8ba1;&#x5212;&#x65f6;&#xff0c;&#x8c03;&#x5ea6;&#x5668;&#x4f1a;&#x5408;&#x5e76;&#x65e7;&#x8ba1;&#x5212;&#xff0c;&#x53ea;&#x53d1;&#x9001;&#x6700;&#x65b0;&#x7684;&#x4e00;&#x6761;&#x3002;

## Telegram &#x901a;&#x77e5;

&#x914d;&#x7f6e; TELEGRAM_BOT_TOKEN&#x3001;TELEGRAM_CHAT_ID &#x548c; REMINDER_SCHEDULER_ENABLED=true&#x3002;&#x6d4b;&#x8bd5;&#x63a5;&#x53e3;&#x4e3a; POST /api/telegram/test&#x3002;&#x6d88;&#x606f;&#x4f7f;&#x7528;&#x4e2d;&#x6587;&#x5e76;&#x6309;&#x540e;&#x53f0;&#x9009;&#x62e9;&#x7684;&#x65f6;&#x533a;&#x663e;&#x793a;&#x3002;

## &#x6784;&#x5efa;&#x548c; Ubuntu &#x90e8;&#x7f72;

~~~bash
npm run build
systemctl restart server-expiry-reminder
~~~

Nginx &#x63d0;&#x4f9b; apps/frontend/dist &#x9759;&#x6001;&#x6587;&#x4ef6;&#xff0c;&#x5e76;&#x5c06; /api &#x8f6c;&#x53d1;&#x5230; 127.0.0.1:3000&#x3002;

## &#x5b89;&#x5168;&#x63d0;&#x793a;

&#x4e0d;&#x8981;&#x5c06; Bot Token&#x3001;Chat ID &#x548c;&#x7ba1;&#x7406;&#x5458;&#x5bc6;&#x7801;&#x5199;&#x5165;&#x6e90;&#x7801;&#x6216;&#x63d0;&#x4ea4;&#x5230; Git&#x3002;&#x542f;&#x7528; HTTPS &#x540e;&#x5c06; SESSION_COOKIE_SECURE &#x8bbe;&#x4e3a; true&#x3002;