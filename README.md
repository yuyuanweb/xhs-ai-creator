# AI 小红书爆文创作工具

> 本项目为教学项目，提供完整文字教程 + 简历写法 + 面试题解 + 答疑服务，帮你提升项目能力，给简历增加亮点！
>
> ⭐️ 加入项目系列学习：[加入编程导航](https://www.codefather.cn/vip)

## 一、项目介绍

这是一套以 **AI 内容生产和浏览器排版引擎** 为核心的全栈项目教程，基于 TypeScript 全栈（NestJS + Prisma + React + MCP）。你只需要导入一篇 Markdown 长文，AI 就会写出卡片初稿，编辑台在浏览器里真实测量每一页的排版，修版 Agent 一轮轮修改到排版达标，最后一键导出一组可以直接发布到小红书的 3:4 图片卡片。

![](https://pic.yupi.icu/pine/01-01-cards.png)

### 为什么做这个项目？

1）需求真实。小红书图文笔记的正文最多 1000 字，一篇几千字的教程或测评放不下，只能做成图片。手工排十几张卡片很费时间，还要压缩文字、挑截图、检查有没有装不下。一篇 4000 字、35 张截图的教程，完整转成 3:4 卡片会有 43 页，而一篇笔记最多只能放 18 张图。

2）技术有深度。难点不在增删改查，而在排版。AI 模型不知道一段文字渲染出来有多高，按字数估算分页，排出来的页不是装不下，就是空了半页。本项目把测高放在浏览器里做，让修版 Agent 拿着真实测量结果去改内容。

3）紧跟 AI 工具。除了内置模型，项目还提供 MCP 服务。Codex、Claude、Cursor 可以直接调用本项目导入文章、写初稿和修版。

### 8 大核心能力

1）**文章导入，配图自动转存**

上传 Markdown 文件，或者直接粘贴正文。后端用 markdown-it 把文章解析成一个个内容块，图片单独拆出来，分页时才能单独定位。原文配图会下载保存到自己的服务器上，避免图床失效或防盗链。原文再按二级、三级标题拆成章节单元，后面用来检查 AI 有没有漏写。

![](https://pic.yupi.icu/pine/01-03-create-dialog.png)

2）**AI 写初稿，不漏章节、不编内容**

AI 模型按固定的 JSON 格式写出封面和全部内页。后端用代码清洗初稿，图注里出现原文没有的名称或数字就清空。再按章节对账，发现漏写的核心章节就追问 AI 补写，按原文顺序插回去。换模型厂商只改接口地址、Key 和模型名三项。

![](https://pic.yupi.icu/pine/06-11-chapter-gap.png)

3）**浏览器里真实测高，排版体检一目了然**

编辑台在屏幕外按真实样式渲染每一块内容，量出高度以后再装进一张张 1080×1440 的卡片。说明文字和它下面的截图必须留在同一页。排版体检会标出哪一页装不下、哪一页偏空，每一页的填充率可以直接看到。

![](https://pic.yupi.icu/pine/01-05-layout-report.png)

4）**测高驱动的修版 Agent**

修版 Agent 拿着排版体检结果，按内容块提交增量补丁。每改一轮就重新测量、打分，越改越差就退回到最好的一版。过空的页面由代码自动补截图，不让模型靠缩小字号把内容塞进页面。实测一份 14 张、5 页偏空的卡片稿，两轮修改以后变成 11 张，全部达标。

![](https://pic.yupi.icu/pine/01-06-before-after.png)

5）**MCP 接入，外部 AI 工具直接写稿**

项目自带 MCP 服务，Codex、Claude、Cursor 可以调用导入文章、读取写稿规则、交初稿、补章节、读取排版、修改内容块这些工具。外部 AI 工具读到的排版结果，同样来自编辑台在浏览器里的真实测量。MCP 服务用 esbuild 打成单文件，可以随 Cursor Skill 分发。

![](https://pic.yupi.icu/pine/08-05-tool-flow.png)

6）**5 套主题，一键切换**

手帐、暗夜、波普、瑞士、论文五套主题，每套还有几种强调色。换主题只换 CSS 变量，不改卡片内容。编辑台、缩略图、手机预览和导出共用同一套渲染组件，看到什么就导出什么。

![](https://pic.yupi.icu/pine/01-07-themes.png)

7）**卡片上直接编辑**

在卡片上点击文字就能直接修改，改完自动重新测高。编辑器支持撤销重做、拖放贴纸、给 AI 写批注、单独重写一块、按页重新生成。人工改过的页会被标出来，不会被 AI 随意覆盖。选中封面以后，还可以调用 Gemini 生成一张封面插图。

![](https://pic.yupi.icu/pine/01-08-inline-edit.png)

8）**浏览器内一键导出**

导出在浏览器里完成，不需要后端再起一个无头浏览器。每张卡片导出成 2160×2880 的高清 PNG，打包成一个 ZIP，按发布顺序编号。导出前会检查有没有内容被裁切。

![](https://pic.yupi.icu/pine/01-12-export-zip.png)

完成这套教程后，不只会做一个小红书图文工具，还能把「结构化输出、代码校验、测量驱动的 Agent、MCP 接入」这套做法用到别的 AI 应用里。

## 二、项目收获

本项目选题新颖，紧跟 AI 内容生产和 AI 工具接入的趋势。区别于增删改查的烂大街项目，这套教程讲解的是一个已经能够运行的完整项目，重点不是带你照着代码从零敲一遍，而是把每个关键决策背后的动机、替代方案和踩坑讲清楚，给你的简历和求职大幅增加竞争力！

TypeScript 全栈项目，学完后会在 monorepo 工程、浏览器排版、AI 结构化输出、修版 Agent、MCP 接入 5 个方向获得完整实践：

![](https://pic.yupi.icu/pine/01-13-tech-stack.png)

从这个项目中你可以学到：

- 如何用 pnpm workspace 组织 monorepo，让编辑台、后端和 MCP 服务共用一套类型和规则？
- 如何用 NestJS + Prisma 搭建后端，实现 JWT 登录认证和统一的接口返回格式？
- 如何设计卡片内容模型，为什么不让 AI 直接输出 HTML？
- 如何用 CSS 变量实现多套主题，让编辑台、缩略图和导出共用一套渲染组件？
- 如何在浏览器里真实测量内容高度，用装箱算法完成分页，再做排版体检？
- 如何用 modern-screenshot 和 JSZip 在浏览器里导出高清图片？
- 如何用 OpenAI 兼容协议接入 AI 模型，用结构化输出拿到可以直接渲染的 JSON？
- 如何用代码规则清洗 AI 的输出，发现漏写的章节就追问补写？
- 如何设计测高驱动的修版 Agent，用打分和回退避免越改越差？
- 如何开发 MCP 服务，让 Codex、Claude、Cursor 调用你的应用？
- 如何实现卡片上直接编辑、撤销重做和按页重新生成？
- 如何调用 Gemini 生成图片，以及国内网络怎么配置代理？
- 如何用 Docker 和 docker-compose 把项目部署到云服务器？

此外，还能学会很多方案对比、问题排查和 AI 应用工程化的方法。教程还整理了扩展思路，有能力的同学可以继续做下去，拉开和别人的区分度。

### 编程导航系列项目优势

满满的项目正反馈：

![](https://pic.yupi.icu/1/%E7%BC%96%E7%A8%8B%E5%AF%BC%E8%88%AA%2026%20%E5%B9%B4%E6%8A%A5%E5%96%9C%E6%88%AA%E5%9B%BE.png)

除视频教程外，编程导航的项目还提供：

| 教程资料                     | 求职助力                       |
| ---------------------------- | ------------------------------ |
| 详细的文字教程 / 直播笔记    | ⭐️ 现成的简历写法，直接写满简历 |
| 完整的项目源码               | ⭐️ 项目相关面试题解和真实面经   |
| 1 对 1 答疑解惑 + 专属交流群 | ⭐️ 项目扩展思路，拉开区分度     |
| 前端 + Java 后端万用项目模板 | ⭐️ 从学项目到拿 Offer 一条龙    |

![](https://pic.yupi.icu/1/%E9%B1%BC%E7%9A%AE%E9%A1%B9%E7%9B%AE%E5%AE%9E%E6%88%98%E7%9A%84%E4%BC%98%E5%8A%BF%E5%A4%A7.jpeg)

## 三、更多介绍

该项目功能完整，涵盖文章导入、卡片渲染、测高分页、整组导出、AI 初稿、修版 Agent、MCP 接入、在线编辑、AI 封面图 9 大模块。

![](https://pic.yupi.icu/pine/01-15-feature-map.png)

本项目由三个应用和一个共享包组成。编辑台是 React 应用，负责渲染卡片、测高分页、修版循环、在线编辑和导出。后端是 NestJS 服务，负责登录、文章导入、配图转存、卡片稿保存，以及调用 AI 模型和 Gemini。MCP 服务通过 stdio 把这些能力包装成工具，给外部 AI 工具调用。内容模型、主题和排版规则放在 `packages/shared`，三边共用同一份代码。

![](https://pic.yupi.icu/pine/01-16-architecture.png)

项目的核心业务流程：导入文章 → AI 写初稿 → 浏览器测高分页 → 修版 Agent 改到排版达标 → 人工精修 → 导出一组 PNG。

![](https://pic.yupi.icu/pine/01-14-business-flow.png)

## 四、快速运行

> 完整的保姆级步骤请参考仓库里的 [本地运行指南](docs/LOCAL_SETUP.md)。

### 前置条件

- Node.js >= 20
- pnpm >= 10（没有就执行 `corepack enable`）
- Docker（只用来跑 PostgreSQL；本机已经装了 PostgreSQL 可以不装）
- 一个 [DeepSeek API Key](https://platform.deepseek.com/)（✅ 写初稿和修版需要；只通过 MCP 让外部 AI 工具写稿时可以先不填）
- 一个 [Gemini API Key](https://aistudio.google.com/)（🔧 可选，只有 AI 封面图要用；国内网络需要再配 `GEMINI_PROXY`）

### 1. 克隆项目

```bash
git clone https://github.com/yuyuanweb/xhs-ai-creator.git
cd xhs-ai-creator
```

### 2. 安装依赖并配置环境变量

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
```

`.env` 里至少改这几项：`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`JWT_SECRET`，要用内置 AI 时再填 `LLM_API_KEY`。换模型厂商只改 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`。

### 3. 启动数据库并建表

```bash
docker compose up -d postgres
pnpm --filter @rcs/shared build
pnpm db:push
```

共享包要先构建一次，前后端都从它的构建产物里引用类型和常量。

### 4. 启动项目

```bash
pnpm dev
```

后端在 [http://localhost:18472](http://localhost:18472)，编辑台在 [http://localhost:18473](http://localhost:18473)。用 `.env` 里的管理员账号登录。

### 5. 部署

服务器上安全组放开 `18472`，不要放开 `5432`。然后：

```bash
cp apps/server/.env.example apps/server/.env
# 生产环境必改：JWT_SECRET、ADMIN_PASSWORD、LLM_API_KEY

docker compose --profile deploy up -d --build
```

浏览器打开 `http://你的公网IP:18472`。一个容器同时提供 API 和编辑台。需要域名时在前面加一层 Nginx 反向代理，并把域名写进 `.env` 的 `CORS_ORIGIN` 和 `WEB_ORIGIN`。

## 加入项目学习

编程导航已有 **近 30 套项目教程！** 每个项目的学习重点不同，从 0 到 1 带做，有大量完整的 **AI 应用开发 + AI 编程 + 全栈项目**，零基础也能学！

详细请见：[https://codefather.cn/course](https://www.codefather.cn/course)（在该页面右侧有教程推荐和学习建议）

![](https://pic.yupi.icu/1/%E9%A1%B9%E7%9B%AE%E6%95%99%E7%A8%8B.png)

欢迎加入 [编程导航](https://www.codefather.cn/vip)，加入后不仅可以全程跟学本项目，往期 **近 30 套原创项目教程** 也都可以无限回看。还能享受更多原创技术资料、学习和求职指导、上百场面试回放视频，开启你的编程起飞之旅~

🧧 助力新项目学习，给大家发放 **限时编程导航优惠券**，扫码即可领券加入。加入三天内不满意可全额退款，欢迎加入体验，名额有限，速来学习！

![](https://pic.yupi.icu/1/437345684-56411098-b60e-4267-8ba2-4ebc5d416afc.png)

1 天不到 1 块钱，绝对是对自己最值的投资！成为编程导航会员后，可以解锁近 30 套项目的教程和资料，PC 网站和 APP 都可以学习，如图：

![](https://pic.yupi.icu/1/image-20250120113756426-20250422160856746.png)
