# 灵修AI

> 读经不止于读过。先思考，再领受。

一个**邀请制、无公开注册**的圣经读经灵修工具，面向教会小组 / 门训小组的小范围使用。移动端优先，底部 Tab 导航，可直接嵌入微信小程序的 `web-view`。

## 这个工具解决什么问题

读经的两个真实困境：

1. **读完就忘。** 每天读 4 章，读完不记得讲了什么人、什么时间、什么地点、故事怎么推进。
2. **一开始就看答案。** 打开注释书或 AI，答案立刻摆在面前，自己本来能发现的那一份就被夺走了。

所以这个工具刻意做成**有约束的**：

| 常见读经 App | 灵修AI |
|---|---|
| 打开就给注释解经 | **先思考才解锁**，未达标不给答案 |
| 给标准答案 | 给**因人而异的引导**，基于你自己的提问与笔记 |
| "读完" = 划完进度条 | "读完" = 有观察、有提问、有回应、有祷告 |
| AI 当老师 | AI 当**同行者**，只提问不下结论 |

完整需求见 [`docs/需求规格说明书.md`](docs/需求规格说明书.md)。

---

## 核心功能

### 1. 约束式灵修流程（七个阶段，不可跳跃）

```
观察 → 自己提问 → 默想作答 → 引导揭晓 → 生命实事 → 祷告 → 完成
```

- **观察**：只写你看见的事实，少于 30 字不能进入下一步。
- **自己提问**：不是回答问题，而是你自己提问，至少 2 个。
- **默想作答**：AI 出 4 道思辨题（事实层 / 脉络层 / 要义层 / 处境层），答完后按四个维度评分（观察准确、提问深度、要义把握、个人化），**总分达 60 才解锁引导**。
- **引导揭晓**：AI 先回应*你自己提的问题*，补充你不可能自己看出的知识（原文词义、历史背景、风俗），最后递给你一个更深的问题 —— 不给标准答案、不下神学定论、以问题收尾。流式输出。
- **生命实事 / 祷告**：写下真实发生的事，再把话说回给神。缺一步这次灵修就不算完整。

**所有约束都在服务端强制**，不是前端隐藏。直接打 API 也绕不过去（已验证，见下文自测）。

### 2. 读经

- 中文（新标点和合本简体）与英文（KJV）**逐节对照**
- **长按任意一节** → 录音笔记 / 手写笔记 / 文字笔记 / 标记"这节神对我说话"
- **上下文透视**：该节的前 10 节与后 10 节（自动跨章节边界），以及 AI 分析前文如何铺垫、后文如何回应、脱离上下文最常见的误读、中英译文的用词差异
- 录音自动尝试转写为文字，转写失败也不影响录音留存

### 3. 发现

- **要素梳理**：人物、时间、地点、情节推进、高潮转折、时代背景、**同时期发生了什么**（圣经内线索 + 世界史 / 中国朝代）
- **知识图谱**：人物/地点/事件/主题的关系图，力导向布局，可**导出 PNG**
- **思维导图**：三层脉络树，可**导出 PNG**
- **意境配图**：文生图模型生成场景画面
- **讲道视频**：管理员挂载福音影视网 / B站 / YouTube 链接，可指定经文范围与**片段起始秒数**，点进去直接从讲这节的位置开始播

> 注意：要素梳理里的**核心要义与反思是锁住的**，需要你先在灵修中写下自己的思考才揭晓。人物、地点、背景这类知识性内容不锁 —— 那是工具，不是答案。

### 4. 出题原则

AI 出的题一律是**主观思辨题**，禁止选择题、禁止唯一正确答案。至少两道题用你熟悉的文化载体作桥：华语歌曲、电影、名著、社会热点。

实际生成的例子（创世记 22 章）：

- **事实层**：亚伯拉罕在本章三次说"我在这里"，分别对谁、在什么情境下？
- **脉络层**：从清早出发到献祭再到祝福，哪个动作是真正的转折点？第 13 节的公羊怎样改变了前面全部铺垫的方向？
- **要义层**（桥：电影《沉默》）：《沉默》里人在神看似隐藏时仍要抉择。创 22 中神试验亚伯拉罕又预备公羊，这让你看见神哪一面？
- **处境层**（桥：鸡娃教育热点）：今天很多父母说"我一切都是为了孩子"。若有人拿亚伯拉罕献以撒来赞美这种牺牲，你觉得哪里像、哪里根本不同？你最不敢交给神的是什么？

### 5. 邀请制账号

- 未登录**看不到任何界面**（边缘中间件统一拦截）
- 没有自助注册。用户在 `/apply` 提交手机号 → 管理员在后台审批 → 系统生成初始密码，**只显示一次**，由管理员通过微信/电话线下告知
- 不发短信、不发邮件、不接微信登录
- 首次登录强制改密；登录失败 5 次锁 15 分钟
- **录音与手写笔记严格限本人访问，管理员也看不到** —— 祷告是私密的

---

## 快速开始

前置：Node.js ≥ 18.18

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填 AUTH_SECRET 和 AI_API_KEY
#   生成 AUTH_SECRET： openssl rand -base64 48

# 3. 下载并导入圣经文本（约 2 分钟，会下 31101 节中文 + 英文对照）
npm run bible:fetch
npm run db:init
npm run bible:import

# 4. 创建第一个管理员（界面上没有注册入口，只能这样建）
node scripts/create-admin.mjs 13800000000 你的名字

# 5. 启动
npm run build && npm start
# 开发模式： npm run dev
```

访问 `http://localhost:3000`，用刚才的手机号和密码登录。

## 配置

```ini
AUTH_SECRET=              # 会话签名密钥，部署前必须换成长随机串
AI_BASE_URL=              # OpenAI 兼容端点（当前为阿里百炼 tokenplan）
AI_API_KEY=
AI_MODEL=deepseek-v4-pro          # 主模型：引导对话，质量优先
AI_MODEL_FAST=deepseek-v4.1-flash # 快模型：出题、评分、结构化抽取
AI_MODEL_IMAGE=wan2.7-image       # 文生图，留空则关闭意境配图
AI_MODEL_AUDIO=qwen-audio-3.0-realtime-plus  # 录音转写，留空则只存音频
DEVOTION_UNLOCK_SCORE=60  # 解锁引导所需分数
DAILY_CHAPTERS=4          # 每日默认读经章数
```

换 AI 供应商只改 `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` 三项，代码不用动。

### 关于模型选择（实测数据）

这批模型都是**推理模型**，思考过程本身要烧 1000–2800 token，踩过三个坑：

1. `max_tokens` 给小了，答案会被思考挤掉，返回被截断的 JSON。所以代码里下限锁在 4000，结构化任务给 9000。
2. 截断的 JSON 可能被"最后一个花括号"兜底解析成看似合法但内容缺失的对象（例如四个评分维度只剩一个）—— 那比直接失败更危险，所以 `finish_reason === 'length'` 一律报错。
3. 单次调用 20–70 秒是常态，超时必须给足。

同一段引导 prompt 的实测对比：

| 模型 | 首字 | 总耗时 | 说明 |
|---|---|---|---|
| `deepseek-v4-pro` | 10s | **19s** | 默认主模型，质量最佳 |
| `qwen3.7-plus` | 31s | 34s | 质量接近 |
| `qwen3.8-max` | 101s | 109s | 质量相近但思考过久，不作默认 |
| `deepseek-v4.1-flash` | — | 21s | 默认快模型，JSON 稳定 |
| `glm-5.3` | — | 32s | JSON 不稳定（4 题只出 1 题），不建议 |

### AI 不可用时

内置降级引擎：出题走模板题库，评分走启发式规则（篇幅、是否提出真问题、是否引用经文词句、是否有第一人称的自我涉入）。**功能不中断**，界面会标注"离线评估"。降级原因会打到服务端日志 `[ai:degraded]`，便于排查。

---

## 部署

### 当前线上状态

| 项 | 值 |
|---|---|
| 访问地址 | `https://124.221.115.174/` |
| 证书 | 自签，SAN 含该 IP，有效期至 2036-09 |
| 应用进程 | systemd `lingxiu-ai.service`，已开机自启 |
| 监听 | `127.0.0.1:3210`（不对外暴露，只经 nginx） |
| nginx 配置 | `/etc/nginx/sites-available/lingxiu-ai` |

常用运维命令：

```bash
systemctl status lingxiu-ai        # 状态
systemctl restart lingxiu-ai       # 改完 .env.local 后重启
journalctl -u lingxiu-ai -f        # 实时日志（AI 降级、报错都在这里）
npm run build && systemctl restart lingxiu-ai   # 改完代码后重新发布
```

### 必须用 HTTPS

浏览器只在 HTTPS（或 localhost）下允许 `getUserMedia`。**没有 HTTPS 就无法录音。** 自签证书在用户点「继续访问」并信任之后，页面仍属于 secure context，录音可以正常工作。

### 为什么是自签证书

本机在腾讯云大陆区，**未备案域名走 80 端口会被 DNSPod 替换成拦截页**，Let's Encrypt 的 HTTP-01 验证因此拿不到挑战文件：

```
Detail: Invalid response from https://dnspod.qcloud.com/static/webblock.html?d=...: 566
```

而 Let's Encrypt 本身也不为裸 IP 签发证书。两条路都堵住，所以用自签证书。代价是浏览器首次访问要手动信任。

### 反代必须传 Host 相关头

`next start` 下 `req.url` 的 origin 是应用自己的监听地址，middleware 若用它拼重定向地址，会把用户甩到 `localhost:3210` 上。Next.js 只认 `X-Forwarded-Proto`、**不认** `X-Forwarded-Host`，所以 `src/middleware.ts` 里的 `redirectTo()` 自己按请求头还原外部 origin。反代这三个头缺一不可：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host $host;
```

好处是换域名时代码不用动，跟着实际访问地址走。（顺带一提：middleware 里不能改发相对 `Location`，它内部会对 `Location` 做 URL 解析，相对路径会直接抛 `ERR_INVALID_URL`。）

nginx 里两个刻意的选择：

- 本 server 是 443 的 `default_server` —— 裸 IP 访问不发送 SNI，必须由默认 server 应答。
- `listen` 上保留 `http2` —— 443 的协议选项由 `default_server` 决定，去掉会让本机另外 5 个 HTTP/2 站点一起降级到 HTTP/1.1。

### 想去掉浏览器警告 / 想在微信里用

**微信内置浏览器和小程序 `web-view` 打不开自签证书站点**，它们要求已备案域名 + 后台白名单。要用微信就必须换成域名：

```bash
# 1. 给已备案的主域加一条 A 记录：lingxiu.example.com → 124.221.115.174
# 2. 签发正式证书
certbot certonly --webroot -w /var/www/certbot -d lingxiu.example.com \
  --non-interactive --agree-tos --deploy-hook 'systemctl reload nginx'
# 3. 把 sites-available/lingxiu-ai 里的 server_name 与 ssl_certificate 换成该域名
# 4. 同步改 .env.local 的 APP_URL，然后 systemctl reload nginx
```

备案是按主域生效的，子域不必单独备案。

页面已按 `web-view` 的限制来做：不依赖微信 JS-SDK、不用 `window.open`、Cookie 同站、适配 `safe-area-inset-bottom`。

```html
<web-view src="https://你的域名/"></web-view>
```

注意 `web-view` 内的录音权限受微信版本限制，若不可用，用户仍可用手写或文字笔记。

### 数据与备份

全部数据在 `data/` 下，直接备份这个目录即可：

- `data/lingxiu.db` — SQLite 主库（用户、笔记、灵修、缓存）
- `data/uploads/` — 录音与手写图片
- `data/raw/` — 圣经原始 JSON（可随时重新下载）

---

## 目录结构

```
src/
  middleware.ts          全站鉴权 + 强制改密（Edge 层，未登录看不到任何界面）
  lib/
    schema.sql           16 张表的完整结构
    db.ts                SQLite 连接
    auth.ts              scrypt 密码、JWT 会话、登录限流
    ai.ts                AI 适配层（OpenAI 兼容、流式、推理模型处理）
    prompts.ts           提示词体系 —— 产品的灵魂在这里
    fallback.ts          AI 不可用时的降级引擎
    devotion.ts          七阶段流程、阶段门槛、评分、引导
    insights.ts          结构化抽取 + 缓存
    bible.ts             经文查询、上下文窗口、读经计划
    stats.ts             连续天数（只算"真正读过"的日子）
  components/
    DevotionFlow.tsx     七阶段灵修界面
    Reader.tsx           读经器（长按、中英对照）
    NoteSheet.tsx        长按弹出的笔记面板
    Recorder.tsx         录音
    Handwriting.tsx      手写画板
    KnowledgeGraph.tsx   知识图谱（d3-force）
    Mindmap.tsx          思维导图
    ExploreView.tsx      发现页
    AdminPanel.tsx       管理后台
    BottomTab.tsx        底部 Tab
  app/
    (main)/              需登录的页面，带底部 Tab
    login/  apply/       公开页面
    api/                 全部接口
scripts/
  fetch-bible.mjs        下载经文（并发 + 断点续传）
  import-bible.mjs       导入 SQLite（清理译者补字标签、脚注、Strong 编号）
  init-db.mjs            建库
  create-admin.mjs       创建管理员
docs/
  需求规格说明书.md
```

## 自测结果

已用真实 AI 端到端验证：

**鉴权与隐私**
- 未登录访问 `/`、`/read`、`/devotion`、`/explore`、`/me`、`/admin` 全部 307 跳登录；API 返回 401
- 首次登录未改密时，功能页跳改密页、API 返回 403，改密页本身放行（不成环）
- 成员不能添加讲道资源（403）；录音/手写**管理员访问返回 403**
- 媒体路径做了格式校验，防路径穿越

**约束不可绕过**（直接打 API）
- 什么都没写就要引导 → 403「还没有解锁」
- 观察不足 30 字就推进 → 409 并提示还差几字
- 在观察阶段提交 `answer` → 409「当前阶段不能提交」
- 未解锁就和教练对话 → 403
- 生命实事为空 / 祷告为空 → 拒绝完成

**评分真的能挡住敷衍**

用一段标准的教会套话（"要顺服神，神是好的神，感谢主的恩典，一切荣耀归给神"）作答，得 51 分**未解锁**，AI 给的理由是：

> `personal 30` — 全是"感谢主""阿们"这类正确的话，看不到你自己真实的处境和挣扎。
> `thesis 32` — 没回答三次"我在这里"和转折点在哪，停在情节表层。

换成有真实困惑与自省的作答后得 78 分解锁。

**"读过"的判定**：完成灵修的创世记 22 章 `engaged=1`，只翻过没互动的约翰福音 3 章 `engaged=0`。

**其它**：中英对照逐节正确；上下文窗口正确跨章（约 3:16 → 前到 3:6、后到 3:26）；知识图谱 15 节点 22 边无孤立节点无非法边；思维导图 3 层 20 叶子；洞察缓存二次命中 0.01s；移动端底部 Tab、安全区、`viewport-fit=cover` 均到位。

---

## 版权与使用范围

- 中文经文：**新标点和合本（简体）**；英文经文：**KJV**（公有领域）
- 经文数据来自公开 API，仅供**受邀弟兄姊妹内部学习使用**，请勿公开分发
- 数据源与译本可由管理员替换（改 `scripts/fetch-bible.mjs`）

## 设计上的自我约束

AI 在这个产品里**不做**这些事：

- 不给标准答案，不下神学定论，不做教义裁判
- 不替用户祷告，不替用户决定该怎么做
- 遇到历代解释不同的难处，如实说明有几种思路，不选边站
- 不替用户完成灵修 —— 它只是那个走在旁边、帮你自己看见的同伴
