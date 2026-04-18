# AI 术语普及 — 技术设计（MVP）

> 本文档与 [`PRD.md`](PRD.md) 对齐，定义技术栈、目录结构、路由、API、AI 集成与安全要点，便于实现与评审。

---

## 1. 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite | SPA，响应式布局 |
| 样式 | Tailwind CSS | 工具类优先，少自定义全局 CSS |
| 路由 | React Router v6 | 三页：`/`、`/explain`、`/goodbye` |
| 后端 | Node.js + Express（或 Hono，二选一并写死一种） | 提供 `/api/define`，CORS 允许前端源 |
| AI | **阿里云百炼** + **通义千问** 模型 | 官方平台：<https://bailian.console.aliyun.com/>；API Key 在控制台创建，**仅服务端**配置；**不使用 DeepSeek** |
| 语音 | **浏览器 Web Speech API**（`SpeechRecognition` / `webkitSpeechRecognition`） | 仅前端；识别结果写入输入框；无服务端转写、不消耗百炼调用额度 |

---

## 2. 总体架构

```text
浏览器 (移动端/桌面)
    │  HTTPS（生产）
    ▼
静态前端 (Vite build / CDN)
    │  fetch POST /api/define
    ▼
Node API 服务
    │  读取百炼 API Key（见 §10），调用百炼/通义千问开放接口
    ▼
阿里云百炼（通义千问等）
```

- 前端不保存、不传输供应商 Key。
- MVP **无强制登录**；无服务端会话库（可选后续增加速率限制标识）。

---

## 3. 推荐目录结构

```text
AI术语普及/
├─ PRD.md
├─ AGENTS.md
├─ tech-design.md
├─ README.md                 # 本地启动、环境变量、部署（实现阶段补充）
├─ .env（本地创建，勿提交）   # 变量见 README
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ index.css
│     ├─ pages/
│     │  ├─ HomePage.tsx
│     │  ├─ ExplainPage.tsx
│     │  └─ GoodbyePage.tsx
│     ├─ components/         # SearchBar（含右侧话筒）、TermCard、EngagementBar（点赞/转发/浏览，见 §5.2）、FavoritesDrawer 或 FavoritesOverlay（我的收藏列表，见 §5.3）、Layout 等
│     ├─ services/
│     │  └─ api.ts           # defineTerm、fetchStats、postStatsEvent（见 §5.2）
│     ├─ data/
│     │  └─ terms.json       # 本地词池（30～80+ 条）
│     └─ utils/
│        ├─ shuffle.ts       # Fisher–Yates，首页取 3 条
│        └─ favoritesStorage.ts  # 我的收藏：读/写 localStorage、上限 100、FIFO（见 §5.3）
│
└─ backend/
   ├─ package.json
   ├─ tsconfig.json
   └─ src/
      ├─ index.ts            # 启动 HTTP 服务；挂载 `/api/define` 与 `/api/stats`（§5.2）
      ├─ routes/
      │  ├─ define.ts         # POST /api/define
      │  └─ stats.ts         # GET/POST /api/stats*（§5.2）
      ├─ services/
      │  ├─ aiProvider.ts    # 封装百炼/智谱调用与 JSON 解析
      │  └─ knownTermDefinitions.ts  # 少数专名人工摘编（先于 LLM）
      └─ middlewares/
         └─ globalDefineRateLimit.ts  # POST /api/define 全局限流（DEFINE_GLOBAL_RPM）
```

---

## 4. 前端路由

| 路径 | 组件 | 行为要点 |
|------|------|----------|
| `/` | `HomePage` | 搜索框回车提交；**话筒**走 Web Speech API，识别文本写入输入框（默认用户再回车确认，与 PRD 一致）；挂载时从 `terms.json` **随机**出 3 卡（1 主推 + 2 偏旧，规则见 §7；点过主推后 session 顺延下一日期档）；**「我的收藏」入口**；点击后在**路由仍为 `/`** 时打开 **抽屉或全屏层** 展示收藏列表（见 §5.3）；**互动条**见 §5.2 |
| `/explain` | `ExplainPage` | 读取 `searchParams.term`（中/英均可）；`useEffect` 请求 `/api/define`；展示 loading / error / **专业中文、专业英文、通俗中文** 三块正文；释义成功后 **打勾** 收藏/取消（见 §5.3）；**互动条** + 统计上报见 §5.2 |
| `/goodbye` | `GoodbyePage` | 静态文案 + 可选链回 `/` |

**说明**：使用 query 参数便于刷新与简单分享；若 term 缺失则重定向首页或提示。

### 4.1 语音输入（浏览器）

- 使用 **Web Speech API**；实现前做 **特性检测**，不支持时隐藏话筒或置灰并提示。
- **HTTPS**：除 `localhost` 外需安全上下文，与生产部署一致。
- **语言**：`lang` 可设为 `zh-CN` 或与用户界面一致；用户说英文术语时依赖识别引擎能力。
- **隐私**：音频识别由浏览器/系统提供商处理，**不经过本应用后端**（除非后续产品改为服务端 ASR）。

---

## 5. API 规格

### 5.1 `POST /api/define`

**Request**

- Header：`Content-Type: application/json`
- Body：

```json
{
  "term": "string"
}
```

**校验（服务端）**

- `term` 必须为字符串；trim 后长度 `1～64`（上限可配置，防止滥用）。
- 可剔除危险控制字符或极端重复字符（按实现微调）。

**Response 200**

```json
{
  "ok": true,
  "term": "Token",
  "professionalZh": "……",
  "professionalEn": "……",
  "plainZh": "……"
}
```

- `professionalZh`：专业定义（中文）；`professionalEn`：同一术语的专业定义（英文）；`plainZh`：通俗解释（仅中文）。

**Response 4xx / 5xx（示例）**

```json
{
  "ok": false,
  "error": "INVALID_TERM | RATE_LIMIT | UPSTREAM_TIMEOUT | UPSTREAM_ERROR | PARSE_ERROR",
  "message": "用户可见的简短中文说明"
}
```

- **429** `RATE_LIMIT`：全局限流触发时返回；响应头可带 `Retry-After`（秒）。环境变量 `DEFINE_GLOBAL_RPM`：每分钟整进程允许次数（默认 `60`），`0` 关闭；多实例各自计数。
- `message` 不得包含 API Key、原始堆栈或供应商内部错误全文。

### 5.2 互动统计：`/api/stats`（点赞 / 转发 / 浏览）

与 [`PRD.md`](PRD.md) §5.6 对齐；行为以 `backend/src/routes/stats.ts`、`backend/src/services/statsStore.ts` 与前端 `HomePage` / `ExplainPage` / `EngagementBar` 为准。

**前端展示（与 PRD 一致）**：点赞、转发为**符号按钮**（视觉参照微信小视频底部点赞/转发）；浏览为英文 **`views`** 加数字，不用图标。

**计数范围**

| 场景 | 建议键 | 说明 |
|------|--------|------|
| 解释页 | `term`（normalize 与 `/api/define` 一致） | **`views` 按词条**；**`likes` / `shares` 与全站 `site` 桶一致**（`GET ?term=` 返回的 likes/shares 同 `?scope=home`）。 |
| 首页 | `homeViews` + 全站 `site.likes` / `site.shares` | 首页 PV 单独计 `homeViews`。**实现要点**：从 `ExplainPage` 点「继续」导航回 `/` 时 **不**调用首页 `view` 递增（`sessionStorage` 等）；直接访问 `/`、刷新、外链进入仍递增。 |

**推荐 API（可微调，但需同步改 PRD/AGENTS）**

1. `GET /api/stats?term=<string>`  
   - Response 200：`{ "ok": true, "term": "…", "views": number, "likes": number, "shares": number }`  
   - 无记录时各字段为 `0`。

2. `GET /api/stats?scope=home`（或与 `term` 互斥）  
   - Response 200：`{ "ok": true, "homeViews": number }`（若产品仅需单字段；字段名实现时可与前端类型 `TStats` 对齐）。

3. `POST /api/stats/event`  
   - Body：`{ "kind": "view" | "share" | "like", "scope"?: "home", "term"?: string, "likeOn"?: boolean }`  
   - `kind=view`：`term` 有值时增加该词 `views`；`scope=home` 时增加 `homeViews`（须满足 PRD：非「从解释页【继续】返回」）。  
   - `kind=share`：全站 `site.shares++`（与 `term` 无关）；前端同一会话内仅应上报一次成功转发（`sessionStorage` `SITE_SHARE_SESSION_KEY`）。  
   - `kind=like`：全站 `site.likes` 随 `likeOn` 增减（与 `term` 无关）；前端用 `localStorage` `SITE_LIKED_STORAGE_KEY` 统一首页与解释页已赞态。  
   - Response：`{ "ok": true }`。

**存储（MVP）**

- 进程内 `Map` + 可选 **JSON 文件持久化**（环境变量如 `STATS_STORE_PATH`，未设置则重启清零）即可；后续可换 Redis/DB **无需改 PRD**。

**前端挂载点**

- `HomePage.tsx`：进入页（`useEffect`）发 `view` + `GET` 拉取 `home` 统计；展示互动条。  
- `ExplainPage.tsx`：在 **`defineTerm` 成功**后发 `view`（`term`）并 `GET` 拉取该 `term` 统计；点赞/转发按钮触发 `POST` 与 Share/clipboard。

**安全**

- `term` 长度与 `/api/define` 一致；对 `POST` 做简单 rate limit（可选中间件）。  
- 响应中不泄露内部路径或 Key。

### 5.3 我的收藏（纯前端）

与 [`PRD.md`](PRD.md) §5.7 对齐：**无后端 API**；数据仅存用户浏览器（推荐 **`localStorage`**）。

**职责划分**

| 区域 | 行为要点 |
|------|----------|
| `ExplainPage` | 在 **`defineTerm` 成功**且正文展示后，渲染**打勾**控件；切换收藏时读/写 §5.3 存储；**打勾**图标与 `EngagementBar` 点赞图标**不得复用**同一图形，避免与 §5.6 混淆。 |
| `HomePage` | **「我的收藏」**入口；打开 **抽屉或全屏层**（`/` 不变）；列表数据来自同一存储；列表项可跳转 `/explain?term=`；列表内 **打勾** 取消收藏。 |

**存储格式（建议）**

- 单一键（如 `FAVORITES_STORAGE_KEY`）下存 **JSON 数组**，元素为 **字符串** `term`，与解释页 URL / 收藏时使用的字符串**一致**（建议对 `term` 做与路由相同的 **trim**，同词不同空白视为同一项时可在实现里归一化）。
- **顺序**：数组从前往后为 **从旧到新**（队首最旧、队尾最新）。**新收藏**追加到**队尾**；若长度将大于 **100**，在追加前从**队首**移除多余项，使长度 ≤ 100。
- **不要求**时间戳字段。
- **去重**：同一 `term` 再次收藏时应**不产生重复条目**（可将已存在项移至队尾视为「最新」，或保持幂等 noop，产品上与 PRD「最旧淘汰」一致即可；实现任选一种并保证上限 100）。

**非目标**

- 后端持久化、同步、账号维度存储：不做。

---

## 6. AI 调用设计

### 6.1 Prompt 目标

单次请求生成 **严格 JSON**（无 Markdown 围栏），便于解析：

```json
{
  "professionalZh": "通行定义的摘编，2～5 句，可照搬或忠实缩写，禁止扩展发挥",
  "professionalEn": "Same definition, condensed excerpt in English, 2～5 sentences",
  "plainZh": "仅复述 professional 已写明的含义，2～5 句，禁止新增比喻或论断"
}
```

系统/开发者指令中要求：

- 用户 `term` 可为中文或英文输入；**全部分段仅允许 IT / AI / ML / 软件工程语境**（禁止按物理、日常生活等其它学科解释；如 Temperature 须为采样温度而非热力学温度）。**专业段**仅输出与权威/通行定义等价的摘编；**通俗段**不得超出专业段信息边界。
- `professionalZh` 与 `professionalEn` 须 **同一概念、同一信息边界**。
- 不输出与 JSON 无关的前缀后缀；`temperature` 宜低（如 0.1）以提高稳定性。

### 6.2 解析与重试

- 解析失败时最多重试 **2** 次（可调）；仍失败则返回 `PARSE_ERROR`。
- 设置 **整体超时**（如 25～40s），超时返回 `UPSTREAM_TIMEOUT`。

### 6.3 供应商备注（阿里云百炼 · 通义千问）

- **平台名称**：**阿里云百炼**（大模型服务平台）；控制台：<https://bailian.console.aliyun.com/>；密钥与模型开通均在控制台完成。
- **调用方式**：按 **百炼** 当前文档使用 **HTTP API** 或 **官方 SDK**（端点与鉴权以控制台与最新开放文档为准）。模型选用文档推荐的对话模型（如 `qwen-turbo` / `qwen-plus` 等，以控制台与 README 为准）。
- `aiProvider.ts` 封装对百炼/智谱侧接口的调用：入参 `term`，出参解析为 `professionalZh` / `professionalEn` / `plainZh`。
- `knownTermDefinitions.ts`：对易被模型张冠李戴的专名（如 OpenClaw）在调用 LLM **之前**返回人工摘编的三段正文，与模型输出字段一致。
- 日志仅记录 `error` 类型与 requestId（若有），**不记录**完整 API Key 与完整 prompt。

---

## 7. 首页词池与推荐三卡

- 文件：`frontend/src/data/terms.json`；推荐 `{ "label": "RAG", "addedAt": "2026-04-01" }`（ISO 日期）；仍兼容纯字符串数组（无日期则视为最旧）。
- **随机三卡**：从 **`addedAt` 从新到旧** 各日期档依次尝试，在 **sessionStorage** 中排除用户已点过的「主推」词（`HOME_USED_HOT_TERMS_KEY`），选出 **1** 条作为本屏 **hot**；另 **2** 条优先为 **`addedAt` 严格早于 hot** 的词条；不足则补足；最后 **洗牌**。每次 `HomePage` **挂载**重算。
- 用户**仅当点击的那张卡等于本屏 hot** 时记入排除；下次回首页主推顺延到下一日期档（例如唯一最新「长上下文」被点后，主推改为次新档如 MCP）。若排除已占满所有档则回退到绝对最新并 **清空** 该 session 记录。
- 若全体同日期或词池 ≤3 条，退化为纯随机取满 3（或全量）。
- 词池条目建议 **≥30**。

---

## 8. 动效（实现建议）

- 优先 **CSS**：`transition`（transform、box-shadow、opacity）。
- 页面进入：父级 `animate-in` 类或 `@keyframes` 淡入 + 轻微 `translateY`。
- 避免引入重型动画库（非必须不用 Framer Motion）。

---

## 9. 本地开发与代理

- **开发**：前端 `vite` 默认端口（如 5173），后端（如 3001）。
- **Vite `server.proxy`**：将 `/api` 代理到后端，避免 CORS 与混合端口问题。

生产环境（当前实现：**Cloudflare Pages + Railway**）：

- 前端构建时注入 **`VITE_API_BASE_URL`**（Railway API 根，HTTPS，无尾斜杠），请求走 `apiUrl("/api/…")` 见 `frontend/src/utils/apiBase.ts`。
- 后端 **`CORS_ORIGINS`**：英文逗号分隔的 Pages（或自定义域）origin；未设置时开发态为 `origin: true`。
- 亦可同源：反向代理 `/api` → Node（则 `VITE_API_BASE_URL` 可留空）。

---

## 10. 环境变量

| 变量 | 说明 |
|------|------|
| `BAILIAN_API_KEY` | 在 [百炼控制台](https://bailian.console.aliyun.com/) 创建并复制的 API Key，**勿提交真实值** |
| `BAILIAN_MODEL` | 可选；默认使用代码内约定模型（如 `qwen-turbo`，与控制台可用模型一致） |
| `PORT` | 后端端口，默认 `3001`；Railway 等平台自动注入 |
| `CORS_ORIGINS` | （生产推荐）允许的前端 origin 列表，逗号分隔 |
| `STATS_STORE_PATH` | （可选）互动计数 JSON 持久化路径；未设置则仅内存，重启清零 |
| `VITE_API_BASE_URL` | **仅前端构建**：后端 API 根 URL；本地开发留空，走 Vite 代理 |

环境变量键名见 README；若官方 SDK 仍要求特定环境变量名，可在后端启动处将 `BAILIAN_API_KEY` **映射**为 SDK 所需变量，**仓库与文档统一使用 `BAILIAN_*` / `ZHIPU_*`**。

若需公网转发链接给他人，需将前后端部署到可访问 **HTTPS** 的环境（语音与分享场景依赖安全上下文）。

---

## 11. 安全清单

- [ ] 仓库内无真实 Key
- [ ] 响应头不暴露内部实现细节
- [ ] `term` 长度与频率限制（可选 IP 级 rate limit）
- [ ] 依赖定期审计（`npm audit`）

---

## 12. 文档同步

变更 API、字段、路由或 AI 行为时，更新本文件，并在 [`AGENTS.md`](AGENTS.md) 中若有冲突一并修订。
