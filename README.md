## 海龟汤游戏（通义千问版）

一个基于 **通义千问 API** 的海龟汤（水平思考推理）网页游戏，采用 Cloudflare Pages 的 **Full‑stack 模式**（前端 + Functions 一体化）：

- 前端：React + Vite
- 后端：Cloudflare Pages Functions（`functions/` 目录）——对接通义千问兼容 OpenAI 的对话接口

> 你要求把免费 API Key **直接写死到代码里**：我会照做，但这会导致任何人都能滥用你的 Key（哪怕是“免费额度”也可能被耗尽/封禁）。强烈建议后续改为 Cloudflare Workers 的 Secret（或环境变量）来存放。

### 目录结构

- `functions/`：Cloudflare Pages Functions（真正线上使用的后端）
  - `_shared/hostPrompt.ts`：主持人系统提示词
  - `_shared/turtleSoups.ts`：海龟汤题库
  - `_shared/qianwenClient.ts`：通义千问 API 调用封装（内含写死的免费 Key）
  - `api/turtle-soups.ts`：`GET /api/turtle-soups` 题库列表
  - `api/turtle-soups/[id].ts`：`GET /api/turtle-soups/:id` 单题详情
  - `api/turtle-soups/[id]/ask.ts`：`POST /api/turtle-soups/:id/ask` 向主持人提问
- `frontend/`：前端单页应用（React + Vite）
  - `src/styles/theme.css`：样式文件

### Cloudflare 部署（Full‑stack Pages，一键线上构建）

#### 1. 在 Cloudflare Pages 里创建项目

- 选择 **Connect to Git**，绑定 GitHub 仓库（例如 `maple150/turtle-soup`）
- 构建配置：
  - **Build command**：`cd frontend && npm install && npm run build`
  - **Build output directory**：`frontend/dist`
- Pages 会自动识别根目录下的 `functions/` 作为后端 Functions，提供 `/api/...` 接口

#### 2. 访问

- 构建完成后，会得到一个形如 `https://xxx.pages.dev` 的地址
- 直接打开该地址即可使用海龟汤游戏，前端会通过同域的 `/api` 与 Functions 后端通信，无需额外配置 `VITE_API_BASE_URL`

### 功能简介

- 固定题库 + AI 主持人：后端内置多道海龟汤题目，并利用通义千问作为主持人自动判断玩家提问的「是 / 否 / 无关」并适时给出提示。
- 主持人提示词、题库、前端样式均拆分到独立文件，方便扩展与维护。


