---
name: rednote-studio
description: 用小红书图文工作台把 Markdown 长图文改写成一组小红书图片卡片：在 Cursor 里接入工作台 MCP、导入文章、写初稿、按编辑台实测排版逐页修到达标，最后交出编辑台链接。用户说「用这篇文章生成图文」「做成小红书卡片」「转成小红书图文」，或提到 rednote-studio、图文工作台、卡片稿、deckId 时使用。
---

# 小红书图文工作台

卡片稿由当前对话的模型亲自写，工作台负责清洗、章节对账、排版测高和保存，用户最后在编辑台里精修和导出。

| 项目 | 值 |
|---|---|
| 工作台地址 | `<WEB_URL>`，本地开发是 `http://localhost:18473/` |
| 后端 API | `<WEB_URL>/api`，本地开发是 `http://localhost:18472/api` |
| 账号 | 后端 `.env` 里的 `ADMIN_USERNAME` |
| 密码 | 后端 `.env` 里的 `ADMIN_PASSWORD` |
| MCP 服务名 | `rednote-studio` |
| MCP 程序 | 本 skill 目录下的 `scripts/rednote-studio-mcp.mjs`（单文件，只需要 Node 20+） |

下文的 `<WEB_URL>`、`<ADMIN_USERNAME>`、`<ADMIN_PASSWORD>` 换成你自己部署的工作台地址和管理员账号。

## 第一步：确认 MCP 已接入

用 `GetDynamicTools` 搜索 `rednote-studio`。能找到带 `import_article`、`submit_draft`、`get_layout` 这些工具的命名空间，就直接跳到「生成流程」。

找不到时帮用户接入：

1. 运行 `node -v`，确认是 20 或更高版本；没有 Node 就让用户先装 Node 20+。
2. 确认本 skill 所在目录的绝对路径，记为 `SKILL_DIR`。
3. 在 `~/.cursor/mcp.json` 的 `mcpServers` 里合并加入下面这段（文件不存在就新建，已有的其他服务原样保留）：

```json
{
  "mcpServers": {
    "rednote-studio": {
      "command": "node",
      "args": ["SKILL_DIR/scripts/rednote-studio-mcp.mjs"],
      "env": {
        "RCS_API_URL": "<WEB_URL>/api",
        "RCS_USERNAME": "<ADMIN_USERNAME>",
        "RCS_PASSWORD": "<ADMIN_PASSWORD>"
      }
    }
  }
}
```

4. 请用户打开 Cursor 设置里的 MCP 页面，确认 `rednote-studio` 已启用、状态是绿点；不是绿点就点一下刷新。然后再用 `GetDynamicTools` 确认工具能找到。
5. 如果启动日志里报找不到 `node`（通过 nvm 装的 Node 常见），把 `command` 换成 `which node` 输出的绝对路径。

## 生成流程

复制这份清单跟踪进度：

```
- [ ] 用 memecub 给文章配表情包，另存一份 Markdown
- [ ] 导入文章，拿到 deckId
- [ ] get_draft_brief 读规则和原文
- [ ] submit_draft 交初稿
- [ ] 有漏节就 supplement_chapters 补齐
- [ ] 在浏览器里打开编辑台并登录
- [ ] get_layout / revise_blocks 修到排版全部达标
- [ ] 把编辑台链接交给用户
```

**0. 配表情包**：卡片上的图片块只能引用原文里的配图，所以表情包要在导入前插进 Markdown。做法见下面的「配表情包」一节。用户说了不要表情包，或者文章已经导入过、不打算重新导入，就跳过这一步。

**1. 导入**：文章没导入过，就用 `import_article` 传本地 Markdown 的绝对路径（配过表情包的，传另存的那一份）；导入过的，用 `list_articles` 找到 articleId。导入结果会给出 deckId 和配图数量。

**2. 读规则**：`get_draft_brief` 返回内容很长，会存成文件，要完整读完。规则里定了内容类型、张数、主题、组件用法和初稿 JSON 格式，严格照着写。

**3. 交初稿**：`submit_draft` 的 `draft` 参数直接传 JSON 对象，不要包成字符串。返回里列出漏掉的核心章节时，用 `supplement_chapters` 只补这几节，每个 h2 都要写 `sources`。

**4. 打开编辑台**：测高只能在浏览器里做。用 `cursor-ide-browser` 的 `browser_navigate` 打开返回里的 `editorUrl`（形如 `<WEB_URL>/decks/<deckId>`）。遇到登录页就用上面的账号密码填表登录，账号密码不知道时再问用户。

**5. 修排版**：用 `get_layout` 读实测结果，再用 `revise_blocks` 按块 id 只改有问题的页。它的返回会附上改完后的实测排版，照着继续改，直到没有装不下和过空的页。如果连续两轮都改不动，就停下来，把情况告诉用户。

**6. 交付**：把 `editorUrl` 交给用户，提醒他在编辑台里精修和导出。

## 配表情包

表情包来自 [memecub](https://memecub.com/zh/developers)，直接调它的 REST 接口，不用装东西，也不用 Key：

```bash
curl -s "https://memecub.com/api/v1/search?q=<关键词，需 URL 编码>&limit=8&min_size=480"
```

返回的 `data` 里每张图都带 `width`、`height`、`license` 和现成的 `markdown`（形如 `![无语](https://...jpg)`）。

1. 把原文复制一份，放在原文同一目录，文件名加上 `-表情包` 后缀。原文不动。
2. 通读文章，挑 3 到 5 处情绪最明显的句子：吐槽、踩坑、反转、惊喜、终于搞定。讲概念、讲步骤、列数据的段落不配，代码块和截图前后也不配。
3. 每处按这句话的情绪想一个短关键词去搜，比如「无语」「崩溃」「震惊」「得意」「打工人」，从结果里挑最贴切的一张，把它的 `markdown` 单独成段插在这句话所在段落的后面。
4. 必须满足下面几条，否则工作台会把图丢掉或者排版难看：
   - `min_size=480` 不能省。长边不到 480px 的图会被工作台当成小图过滤掉。
   - 一个 h2 章节最多配 1 张，两张表情包之间至少隔一段正文，也不要紧挨着原文截图。
   - 优先选 `kind` 是 `meme` 的静态图，不用 `gif`；不选带脏话的（`profane` 为 true）。
   - 用户说这是商业稿时，搜索带上 `commercial=true`，只用 `license.commercial_use` 为 true 的图。
5. 写初稿时，表情包的 image 块图注填空字符串，不要描述画面；每张表情包都放在它所在原文章节对应的那页，同一张不重复用。

## 修版经验

- 第一次实测通常比预估多出 3 到 4 页，组件实际渲染出来比估算的高。最常见的情况是某一页最后一个提示框（callout）单独挤到了下一页，形成一张几乎全空的续页。处理办法是删掉这个提示框，把它的意思写进本页导语，或者并进上一条步骤的文字里。
- 页面过空时，补一个和本页内容相关的提示框，或者给已有条目补一句细节，不要硬凑内容。
- 想少几页，就压缩条目数量（比如路线图从 4 条压成 2 条），或者合并同一章节里内容相近的块。
- 只修几页时用 `revise_blocks`，不要整份重新 `submit_draft`。整份重交会让排版从头再测，还可能弄丢已经修好的页。
- 截图的图注要用原文里紧挨着这张图的说法，否则服务端校验会把图注清空。补了两次还是被清空，就别再重试，告诉用户到编辑台里手动填。
- `get_layout` 提示编辑台在后台、测量暂停时，用 `browser_navigate` 带上 `position: "active"` 重新打开同一个链接，把标签页切到前台，再调用 `get_layout`。
- 要整份重写已有的稿子：用 `get_deck` 读出当前稿（格式和初稿 JSON 相同），改完后整份 `submit_draft` 交回，再走一遍修排版。

## 文案要求

用户反复强调过下面这些要求，写稿和修稿时都要遵守：

- 语句自然连贯，逻辑承接合理，页与页之间要有承上启下，避免过于生硬、结构化的电报体。
- 主语完整，用词完整，比如写「切换」，不写「切」。
- 语序用正序，禁止倒装。
- 段落不要老是以冒号开头。
- 大标题（h2）上方不写引题（label）。
- 大标题和组件条目都写成完整的整句，比如「它拖不出连续线条，只好点了 270 多下」，不要写成「拖不出连续线条，一下下点了 270 多下」这样缺主语的半句。

## 交付时怎么汇报

先说结果，再说细节：

- 一共多少张（含封面），排版是否全部达标，平均填充率多少。
- 用的内容类型、主题和强调色，封面标题是什么。
- 用了几张截图、几张表情包，分别放在哪几页。
- 初稿实测排成了几张，改了几轮，为了收页数删掉或改写了哪些内容。
- 还需要用户手动处理的地方，比如被清空的图注。
- 编辑台链接，用 Markdown 链接的形式给出。

## 常见问题

| 现象 | 处理 |
|---|---|
| 工具报「连不上工作台后端」 | 用 `curl -s -o /dev/null -w "%{http_code}" <WEB_URL>/api/auth/me` 检查，返回 401 说明服务正常；连不上说明工作台服务或内网穿透没开，请用户联系工作台维护者 |
| 工具报「工作台返回 401」或账号错误 | 检查 `mcp.json` 里的 `RCS_USERNAME`、`RCS_PASSWORD` 是否和上面一致；管理员改过密码的话，向维护者要新密码 |
| 导入后提示配图抓取失败 | 服务端只能抓公网图片链接。Markdown 里的本地图片路径抓不到，需要先把图片换成公网链接再导入 |
| `get_layout` 提示编辑台没打开 | 按「生成流程」第 4 步打开并登录编辑台，标签页留在前台 |
| MCP 状态是红点 | 看 MCP 日志：找不到 `node` 就改成绝对路径；找不到 `.mjs` 就检查 `args` 里的路径 |
