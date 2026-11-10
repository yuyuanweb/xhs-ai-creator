# AI 小红书图文工作台

把一篇 Markdown 长图文改写成一组可以直接发布的 3:4 小红书图片卡片：AI 负责压缩改写，浏览器按真实测高排版，人工在编辑台里精修，最后在浏览器里一键导出整组 PNG。

## 核心能力

+ 文章导入：解析 Markdown，原文配图自动转存，按章节切分
+ AI 初稿：一次生成封面和全部内容页，按原文章节清单对账，漏掉的章节自动追问补写
+ 测高驱动的修版 Agent：每一轮都在浏览器里实测每页填充率，模型按体检结果增量打补丁，越改越差时退回最好的一版
+ MCP 接入：Cursor 里的任意模型都能通过 MCP 直接给工作台写稿和修版
+ 在线编辑：在卡片上直接改字、给 AI 写批注、单块或按页重新生成、撤销重做、拖放素材
+ 主题和封面：手帐、暗夜、波普、瑞士、论文五套主题，可选 Gemini 生成 AI 封面图
+ 浏览器内导出：导出前检测溢出，整组卡片打包成 ZIP

## 技术栈

| 层 | 技术 |
|---|---|
| 工程 | pnpm workspace monorepo、TypeScript |
| 后端 | NestJS 11、Prisma 6、PostgreSQL、JWT |
| 前端 | React 19、Vite 6、React Router 7、Zustand |
| AI | OpenAI 兼容协议（DeepSeek / 通义等）、Gemini 生图、MCP |
| 导出 | modern-screenshot、JSZip |

## 目录结构

```
apps/
  server/    NestJS 后端：文章、卡片稿、提示词、AI 初稿和修版、封面图
  web/       React 编辑台：渲染、测高分页、修版 Agent 循环、编辑器、导出
  mcp/       MCP 服务：让 Cursor 里的模型直接给工作台写稿
packages/
  shared/    前后端共用的类型、常量、主题和校验规则
.cursor/skills/rednote-studio/   打包好的 MCP 程序和配套 Cursor Skill
```

## 快速开始

需要 Node 20+、pnpm 10 和 Docker（只用来跑 PostgreSQL）。

```bash
pnpm install
docker compose up -d postgres
cp apps/server/.env.example apps/server/.env   # 填上 LLM_API_KEY 和管理员账号密码
pnpm --filter @rcs/shared build
pnpm db:push
pnpm dev
```

打开 http://localhost:18473 ，用 `.env` 里的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

详细步骤和常见问题见 [本地运行指南](docs/LOCAL_SETUP.md)。

## 部署

```bash
cp apps/server/.env.example apps/server/.env   # 改掉 JWT_SECRET 和管理员密码
docker compose --profile deploy up -d --build
```

一个容器同时提供 API 和编辑台，访问 `http://<服务器地址>:18472`。需要域名时在前面加一层 Nginx 反向代理，并把域名写进 `.env` 的 `CORS_ORIGIN` 和 `WEB_ORIGIN`。
