# 本地运行指南

## 一、前置要求

| 工具 | 版本 | 检查命令 |
|---|---|---|
| Node.js | 20 及以上 | `node -v` |
| pnpm | 10 及以上 | `pnpm -v`，没有就执行 `corepack enable` |
| Docker | 任意较新版本 | `docker -v`，只用来跑 PostgreSQL；已有 PostgreSQL 可以不装 |

## 二、准备 API Key

| Key | 是否必需 | 说明 |
|---|---|---|
| `LLM_API_KEY` | 必需 | 任意 OpenAI 兼容协议的模型，默认配置是 DeepSeek，在 https://platform.deepseek.com 获取 |
| `GEMINI_API_KEY` | 可选 | 只有 AI 封面图要用，在 https://aistudio.google.com 获取；国内网络需要配 `GEMINI_PROXY` |

不用内置 AI、只通过 MCP 让 Cursor 里的模型写稿时，`LLM_API_KEY` 也可以先不填。

## 三、安装和配置

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
```

`.env` 里至少要改这几项：

| 字段 | 说明 |
|---|---|
| `DATABASE_URL` | 用下一步的 Docker 数据库就不用改 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 首次启动且用户表为空时，用它创建管理员 |
| `JWT_SECRET` | 换成一串随机字符 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 换模型厂商只改这三项 |

## 四、启动数据库并建表

```bash
docker compose up -d postgres
pnpm --filter @rcs/shared build
pnpm db:push
```

`packages/shared` 要先构建一次，前后端都从它的 `dist` 引用类型和常量。之后改了 shared 的代码，可以开一个终端跑 `pnpm --filter @rcs/shared dev` 自动重新构建。

## 五、启动项目

```bash
pnpm dev
```

它会同时启动后端（`http://localhost:18472`）和编辑台（`http://localhost:18473`）。也可以分两个终端分别执行 `pnpm dev:server` 和 `pnpm dev:web`。

## 六、快速体验

1. 打开 http://localhost:18473 ，用管理员账号登录
2. 点击新建，粘贴一篇带配图的 Markdown 长文
3. 进入编辑台后点击生成，观察初稿生成和逐轮修版
4. 在卡片上直接改字，或者点选一块给 AI 写批注
5. 点击导出，下载整组 PNG

## 七、接入 Cursor（可选）

仓库根目录的 `.cursor/mcp.json` 已经配好了本地 MCP 服务，用 Cursor 打开本仓库并启用 `rednote-studio` 即可。MCP 默认读取 `apps/server/.env` 里的端口和管理员账号。

要在别的项目里用，复制 `.cursor/skills/rednote-studio/` 整个目录，按其中 `SKILL.md` 的说明配置。修改 `apps/mcp` 的代码后执行 `pnpm --filter @rcs/mcp bundle` 重新打包。

## 八、常见问题

1. 启动后端报 `Cannot find module '@rcs/shared'`：shared 还没构建，执行 `pnpm --filter @rcs/shared build`
2. 登录提示用户名或密码不正确：管理员只在用户表为空时创建，改 `.env` 不会改已有账号；可以清空 `User` 表后重启
3. `pnpm db:push` 连不上数据库：确认 `docker compose ps` 里 postgres 是 healthy，端口 5432 没被本机其他 PostgreSQL 占用
4. 导入后配图抓取失败：服务端只能抓公网图片，本地路径的图片要先换成公网链接；抓取失败的配图可以在编辑台里点重试
5. 一直停在测量排版：编辑台标签页需要在前台，浏览器会暂停后台页面的渲染
6. 生成封面图超时：国内网络访问 Google 需要配置 `GEMINI_PROXY` 或可用的 `GEMINI_BASE_URL`
7. 想通过内网穿透访问开发环境：启动前设置环境变量 `TUNNEL_HOST=你的穿透域名`，并把域名加进 `.env` 的 `CORS_ORIGIN`

## 九、端口汇总

| 服务 | 端口 |
|---|---|
| 编辑台（Vite） | 18473 |
| 后端 API | 18472 |
| PostgreSQL | 5432 |
