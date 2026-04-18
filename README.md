# AI 术语普及

独立 Web 应用：极简首页查询 AI 术语，展示**专业定义（中文 → 英文）**与**通俗解释（仅中文）**；**我的收藏**为纯前端能力（术语存于本机浏览器，不上传服务端），产品规则见 [`PRD.md`](PRD.md) §5.7，实现约定见 [`tech-design.md`](tech-design.md) §5.3。协作与验收还可参考 [`AGENTS.md`](AGENTS.md)。

## 环境要求

- Node.js 18+
- 阿里云 [百炼](https://bailian.console.aliyun.com/) API Key（通义千问兼容模式）

## 配置

1. 在项目根目录创建 `.env`（或仅在 `backend/.env` 中配置，二者均可被后端读取），变量见下文列表。
2. 填写：

   - `LLM_PROVIDER`：`bailian`（默认）或 `zhipu`。若本机连百炼超时、但海龟汤项目用智谱正常，可设 `zhipu` 并配置下方智谱变量。  
   - **百炼**（`LLM_PROVIDER=bailian`）：`BAILIAN_API_KEY`、`BAILIAN_MODEL`（默认 `qwen-turbo-latest`）、可选 `BAILIAN_BASE_URL`、`BAILIAN_JSON_OBJECT`  
   - **智谱**（`LLM_PROVIDER=zhipu`）：`ZHIPU_API_KEY`、`ZHIPU_MODEL`（默认 `glm-4-flash`）、可选 `ZHIPU_BASE_URL`（默认与海龟汤一致：`…/v4/chat/completions`）、`ZHIPU_JSON_OBJECT`  
   - `HTTPS_PROXY`：可选，Node 出站走本地 HTTP 代理（与 `backend/src/services/aiProvider.ts` 中 `upstreamFetch` 一致）  
   - `PORT`：可选，默认 `3001`  
   - `STATS_STORE_PATH`：可选，互动计数（views / 点赞 / 转发）持久化 JSON 文件路径；不设则仅内存，**重启后端清零**
   - `DEFINE_GLOBAL_RPM`：可选，**全局限流**——整台后端进程每分钟最多允许多少次 `POST /api/define`（默认 `60`）。设为 `0` 关闭。多副本时每个副本单独计数，严格全局需放在网关/Nginx 上再做一层。

**切勿**将真实 Key 提交到 Git。

### 限流阈值怎么定（`DEFINE_GLOBAL_RPM`）

- **粗算**：`RPM ≈ 预期峰值并发用户数 × 人均每分钟查询次数`。例：20 人同时用、每人每分钟查 2 个词 → 约 `40`，再留余量可设 `60～120`。
- **按成本**：看百炼/智谱单价与月预算，反推「每分钟最多允许多少次模型调用」（注意人工摘编词条仍会计入本次实现的计数，若需排除可再改代码）。
- **按上游限额**：控制台若有 QPM 上限，总 RPM 应 **低于** 官方限额并预留重试空间。
- **上线后**：看监控与账单，**偏小**则用户常看到「请稍后再试」，**偏大**则费用与被打爆风险高；从默认 `60` 微调即可。

## 本地开发

终端 1 — 后端：

```bash
cd backend
npm install
npm run dev
```

终端 2 — 前端（Vite 会将 `/api` 代理到 `http://localhost:3001`）：

```bash
cd frontend
npm install
npm run dev
```

浏览器打开控制台提示的地址（一般为 `http://localhost:5173`）。

### 若页面提示无法连接上游 / `NETWORK_ERROR`

后端终端若出现 **`[define-network]`** 且含 **`Connect Timeout`** / **`fetch failed`**，说明本机 **Node 无法经当前代理访问**百炼或智谱域名（与模型名无关）。请检查：

- 在同一台电脑终端执行：`curl -I https://dashscope.aliyuncs.com`（或 PowerShell：`Invoke-WebRequest -Uri https://dashscope.aliyuncs.com -Method Head`）是否成功。
- 公司网络/防火墙是否拦截出境 HTTPS；是否需配置 **系统代理** 或 Node 使用的代理（可查阅 `HTTP_PROXY` / `HTTPS_PROXY` 与 Node 版本说明）。
- 国际地域账号：在 `.env` 设置 `BAILIAN_BASE_URL=https://dashscope-intl.aliyuncs.com`（或文档中的其它兼容模式根地址）。
- 智谱：确认 `HTTPS_PROXY` 与 **PAC / 公司 Zscaler** 或本机 Clash 的 HTTP 端口一致，并重启后端。
- 百炼连接超时：多为链路问题，优先尝试上述 `BAILIAN_BASE_URL` 国际根地址或更换网络。
- 直连仍超时、但本机 Clash/V2Ray 等 **系统代理能访问外网**：在 `.env` 增加 `HTTPS_PROXY=http://127.0.0.1:端口`（与代理软件「HTTP 代理端口」一致），**重启后端**；后端已用 `undici` 按该变量走代理。

## 生产部署：Cloudflare Pages + Railway（推荐）

架构：**前端**托管在 **Cloudflare Pages**，**API（Express）**托管在 **Railway**；无需自有 VPS。密钥只在 Railway 环境变量中配置。

### 1. Railway（后端）

1. [Railway](https://railway.app/) 新建项目 → **Deploy from GitHub**（或 CLI），选择本仓库。
2. 服务设置里将 **Root Directory** 设为 **`backend`**。
3. **Variables** 中添加与本地 `.env` 相同的后端变量（至少 `BAILIAN_API_KEY` 或智谱一套；`LLM_PROVIDER` 等）。**不要**把 Key 写进代码。
4. 添加 **`CORS_ORIGINS`**：你的 Pages 完整源，例如 `https://你的项目.pages.dev`；若有自定义域，多个用英文逗号分隔、**无尾斜杠**。
5. 部署完成后记下 **公网 HTTPS 根 URL**（如 `https://xxx.up.railway.app`），供下一步使用。
6. **说明**：未挂持久卷时 `STATS_STORE_PATH` 在容器重启后可能丢失；可暂用默认内存统计，或日后接 Railway Volume。

Nixpacks 会根据 `backend/package.json` 安装依赖；请在 Railway **Settings → Deploy** 中确认 **Custom Start Command** 为 `npm run start`（或留空使用默认 `npm start`），并在 **Build** 阶段执行 `npm run build`（可在 **Build Command** 填 `npm run build`，**Watch Paths** 按需设置）。Railway 会注入 **`PORT`**。

健康检查：可指向 `GET /health`。

### 2. Cloudflare Pages（前端）

1. Cloudflare **Workers & Pages** → **Create** → **Pages** → 连接同一 Git 仓库。
2. **Build configuration**（项目根在仓库根时）：
   - **Build command**：`cd frontend && npm install && npm run build`
   - **Build output directory**：`frontend/dist`
3. **Environment variables**（Production）：
   - **`VITE_API_BASE_URL`** = Railway 的 API 根地址，**与浏览器地址同协议 HTTPS**，**不要**尾斜杠，例如 `https://xxx.up.railway.app`
4. 保存并部署；用 **`https://…pages.dev`**（或自定义域）访问。

本地打生产包预览（可选）：

```bash
cd frontend
set VITE_API_BASE_URL=https://你的-railway-根地址
npm run build
npx vite preview
```

（PowerShell 可用 `$env:VITE_API_BASE_URL="..."`。）

### 3. 安全与联调

- **切勿**将 `.env` 提交到 Git；部署平台只填 **Variables / Secrets**。
- 生产务必设置 **`CORS_ORIGINS`**，勿长期依赖「允许任意来源」。
- 语音输入、微信内打开需 **HTTPS**；Pages 与 Railway 默认均为 HTTPS。

更完整的变量说明见仓库根目录 **`.env.example`**。

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS v4、React Router；**我的收藏**等客户端状态使用 `localStorage`（与后端无接口）  
- 后端：Express、TypeScript，调用百炼 **OpenAI 兼容接口**（`compatible-mode/v1/chat/completions`）
