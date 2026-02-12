## 海龟汤游戏（通义千问版）

一个基于 **通义千问 API** 的海龟汤（水平思考推理）网页游戏，采用现代前后端分离架构：

- 前端：React + Vite
- 后端：Cloudflare Workers（Hono）——对接通义千问兼容 OpenAI 的对话接口

> 你要求把免费 API Key **直接写死到代码里**：我会照做，但这会导致任何人都能滥用你的 Key（哪怕是“免费额度”也可能被耗尽/封禁）。强烈建议后续改为 Cloudflare Workers 的 Secret（或环境变量）来存放。

### 目录结构

- `backend/`：后端服务（Cloudflare Worker + Hono），封装通义千问调用逻辑
  - `src/prompts/hostPrompt.ts`：主持人系统提示词
  - `src/data/turtleSoups.ts`：海龟汤题库
- `frontend/`：前端单页应用（React + Vite）
  - `src/styles/theme.css`：样式文件

### 本地运行（可选，但推荐）

#### 1. 克隆仓库并安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

#### 2. 启动后端（Worker）

```bash
cd backend
npm run dev
```

默认监听 `http://127.0.0.1:8787`。

#### 3. 启动前端

```bash
cd frontend
npm run dev
```

默认运行在 `http://localhost:5173`，前端会通过 `/api/...` 调用后端接口（开发环境下可以在 `vite.config.ts` 配置代理）。

### Cloudflare 部署（无需先本地运行）

- **后端（Cloudflare Workers）**
  - 用 `wrangler` 部署 `backend/`
  - 部署后得到一个 Worker URL（例如 `https://xxx.your-account.workers.dev`）
- **前端（Cloudflare Pages）**
  - 选择本仓库作为 Pages 项目
  - Build 命令：`cd frontend && npm install && npm run build`
  - Build 输出目录：`frontend/dist`
  - 在前端中配置 API 基地址为你的 Worker URL（或使用同域代理/重写）

### 功能简介

- 固定题库 + AI 主持人：后端内置多道海龟汤题目，并利用通义千问作为主持人自动判断玩家提问的「是 / 否 / 无关」并适时给出提示。
- 主持人提示词、题库、前端样式均拆分到独立文件，方便扩展与维护。

