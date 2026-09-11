# Cloudflare Pages 部署与搜索引擎收录执行手册

> 生成时间：2026-09-11
> 适用项目：model-hub（大模型一站式接入指南）
> 正式域名：https://model-hub-994.pages.dev/

---

## 一、部署状态确认

| 检查项 | 状态 | 说明 |
|---|---|---|
| Cloudflare Pages 项目 | ✅ 已创建 | 项目名：`model-hub` |
| 绑定的 GitHub 仓库 | ✅ 已连接 | `LELEPENG/model-hub` / `main` 分支 |
| 构建输出目录 | ✅ `dist` | Cloudflare 自动部署 dist/ 内文件 |
| 响应头（CSP/安全头） | ✅ `_headers` | 位于 `dist/_headers`，Cloudflare Pages 自动识别 |
| 站点地图 | ✅ `sitemap.xml` | 已更新为 `https://model-hub-994.pages.dev/` |
| AI 爬虫说明 | ✅ `llms.txt` | 已部署到根目录 |
| 纯文本兜底 | ✅ `<noscript>` | 50 条 Top50 榜单已注入页面 |
| JSON-LD 结构化数据 | ✅ 50 条 | 已注入 `<head>` |

---

## 二、公开访问验证（你自己检查）

在浏览器地址栏输入以下地址，确认都能正常打开：

1. 首页
   ```
   https://model-hub-994.pages.dev/
   ```

2. sitemap
   ```
   https://model-hub-994.pages.dev/sitemap.xml
   ```

3. llms.txt
   ```
   https://model-hub-994.pages.dev/llms.txt
   ```

4. robots.txt
   ```
   https://model-hub-994.pages.dev/robots.txt
   ```

如果以上 4 个地址都能正常访问，说明 Cloudflare Pages 部署完全成功，且站点对公网公开。

---

## 三、百度搜索资源平台收录（下一步操作）

### 1. 删除旧站点

- 打开 https://ziyuan.baidu.com/
- 进入「站点管理」
- 删除旧的 `https://model-hub.edgeone.dev/`（之前因 EdgeOne 国内 401 验证失败）

### 2. 添加新站点

- 点「添加网站」
- 站点地址填：`https://model-hub-994.pages.dev/`
- 协议头选：`https://`
- 站点领域推荐勾选：
  - **信息技术**
  - **工具服务及在线查询**
  - **教育培训**

### 3. 验证方式

- 第三步选择 **「文件验证」**
- 百度会生成一个验证文件，文件名类似：
  ```
  baidu_verify_xxxx.html
  ```
- **把完整文件名发给我**，我会在项目里生成该文件并推送到 GitHub，Cloudflare 会自动重新部署
- 等 1–2 分钟后，点「完成验证」

### 4. 提交 sitemap

验证通过后，在百度后台提交：
```
https://model-hub-994.pages.dev/sitemap.xml
```

---

## 四、Google Search Console 收录

### 1. 添加站点

- 打开 https://search.google.com/search-console
- 选择「网址前缀」
- 填写：`https://model-hub-994.pages.dev/`

### 2. 验证方式

- 选择 **「HTML 标签」** 验证
- Google 会给你一段类似下面的代码：
  ```html
  <meta name="google-site-verification" content="xxxxxxxxxxxxxxxxxxxxxx" />
  ```
- **把整段代码发给我**，我加进 `build_standalone.py` 的 `VERIFY_META_TAGS` 并推送
- 等 1–2 分钟后，点「验证」

### 3. 提交 sitemap

验证通过后，在 Google Search Console 提交：
```
https://model-hub-994.pages.dev/sitemap.xml
```

---

## 五、Bing 站长工具（暂缓）

Bing 对 `*.pages.dev` 共享后缀有站点数量限制，可能会出现：
> "Max limit reached for number of sites registered under this domain"

**处理方案**：
- 百度 + Google 收录先跑起来
- 如果后续需要 Bing，可以绑定一个自定义域名（Cloudflare Pages 支持，免备案），再提交 Bing

---

## 六、后续维护流程

只要内容有更新（例如 `data.js` 里的模型数据），按下面流程操作：

1. 修改源代码文件
2. 本地运行：
   ```bash
   python build_standalone.py
   ```
3. 提交并推送：
   ```bash
   git add -A
   git commit -m "更新说明"
   git push
   ```
4. Cloudflare Pages 会自动重新部署

---

## 七、关键文件说明

| 文件 | 作用 | 平台 |
|---|---|---|
| `dist/index.html` | 单文件站点（CSS/JS 内联） | Cloudflare / EdgeOne 通用 |
| `dist/_headers` | Cloudflare Pages 安全响应头 | Cloudflare Pages |
| `dist/edgeone.json` | EdgeOne Pages 安全响应头 | EdgeOne Pages |
| `dist/sitemap.xml` | 站点地图 | 通用 |
| `dist/robots.txt` | 爬虫协议 | 通用 |
| `dist/llms.txt` | AI 爬虫说明 | 通用 |
| `build_standalone.py` | 打包脚本 | 本地运行 |

---

## 八、当前已知问题

- EdgeOne 国际版默认 `*.edgeone.dev` 域名对国内匿名用户返回 401，因此已放弃用它做百度/Google 验证
- Cloudflare Pages `*.pages.dev` 默认全球公开，国内可访问，适合当前需求
