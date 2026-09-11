# EdgeOne Pages 部署执行手册（从当前控制台到上线）

> 当前状态（2026-09-11）：
> - EdgeOne 国际版账号已注册完成；
> - GitHub 仓库 `LELEPENG/model-hub` 已推送，内含 `dist/index.html` + `edgeone.json` + `llms.txt` + `robots.txt` + `sitemap.xml`；
> - 已进入 **EdgeOne 控制台 → Service Dashboard → Makers** 标签页，看到 "Activate Now" 按钮。
>
> 目标：完成激活、部署、验证、收录提交。

---

## 执行顺序总览

| 步骤 | 目标 | 预计耗时 | 关键产出 |
|---|---|---|---|
| 1 | 激活 EdgeOne Makers/Pages | 1 分钟 | 服务开通 |
| 2 | 创建项目并导入 GitHub 仓库 | 2–3 分钟 | 项目与仓库关联 |
| 3 | 配置构建设置 | 1 分钟 | 输出目录指向 `dist` |
| 4 | 首次部署 | 1–2 分钟 | 获得默认访问域名 |
| 5 | 访问验证 | 3–5 分钟 | 确认页面、安全头、JSON-LD、noscript |
| 6 | 更新 `sitemap.xml` 真实域名 | 5 分钟 | 站点地图可用 |
| 7 | 提交搜索引擎 / AI 爬虫收录 | 10–15 分钟 | 被 Bing/百度索引 |
| 8 | 配置监控与回滚 | 5 分钟 | 上线后可持续运维 |

---

## Step 1：激活 EdgeOne Makers/Pages 服务

### 操作方法
1. 在当前页面（EdgeOne Service Dashboard → Makers）点击蓝色 **"Activate Now"** 按钮。
2. 若出现服务协议/条款页面，勾选同意并继续。
3. 若出现套餐选择，选择 **Free / 免费档**。

### 操作要点
- "Makers" 就是 EdgeOne Pages 服务在国际版控制台里的名称。
- 激活过程**不需要绑信用卡**（你注册时也没绑卡）。

### 注意事项
- 不要误点成 EdgeOne 主服务（Website security acceleration）的 14 天试用或付费套餐。
- 如果页面长时间转圈，刷新一下；国际版控制台偶尔需要多等几秒。

---

## Step 2：创建项目并导入 GitHub 仓库

### 操作方法
1. 激活成功后，进入 Makers 项目列表页，点击 **"Create Project" / "新建项目" / "+"**。
2. 选择 **"Import from Git"** 或 **"Connect GitHub"**。
3. 如果提示绑定 GitHub，点击授权，登录你的 GitHub 账号，授权 EdgeOne 访问仓库。
4. 在仓库列表中找到并选择 **`LELEPENG/model-hub`**。
5. 点击 **"Import" / "开始导入"**。

### 操作要点
- 授权时 GitHub 会问你允许 EdgeOne 访问哪些仓库；可以直接选 **"All repositories"**（只读+部署用），或只选 `model-hub`。
- 如果仓库列表没刷新出来，等 10 秒或重新授权一次。

### 注意事项
- 一定要选 `LELEPENG/model-hub`，不要选成之前误创建的 Copilot Space 或其他仓库。
- 仓库必须是包含 `dist/index.html` 的那个；如果仓库是空的或只有命令文本，部署会失败。

---

## Step 3：配置构建设置

### 操作方法
项目创建后，会进入构建配置页，按下面填写：

| 配置项 | 填写内容 | 说明 |
|---|---|---|
| **Project name** | `model-hub`（或你喜欢） | 会影响默认域名前缀 |
| **Framework preset** | **None / Static / Other** | 本站是预打包好的纯静态 HTML |
| **Build command** | **留空** | 不需要再构建 |
| **Output directory** | **`dist`** | 这就是 build_standalone.py 的输出目录 |
| **Root directory** | 默认 `/`（留空） | 不需要改 |
| **Install command** | 留空 | 没有 npm 依赖 |

填完后点击 **"Deploy" / "开始部署"**。

### 操作要点
- **Output directory 必须填 `dist`**，因为 `index.html`、`edgeone.json`、`llms.txt` 等部署文件都在这个目录下。
- 如果填成根目录 `/`，EdgeOne 会找不到入口文件，部署后访问会 404。

### 注意事项
- 不要勾选任何 "Use build cache" 或高级构建选项，保持默认即可。
- 如果框架列表里没有 "None"，选 **"Static HTML"** 或 **"Other"**。

---

## Step 4：首次部署与获取域名

### 操作方法
1. 点击 Deploy 后，等待构建完成（通常 1–2 分钟）。
2. 构建成功后，页面会显示一个 **默认域名**，格式类似：
   ```
   https://model-hub-xxxxxx.edgeone.app/
   ```
3. 点击域名或复制到浏览器打开。

### 操作要点
- 首次部署成功后，EdgeOne 会自动分配免费 SSL 证书，地址是 `https://`。
- 默认域名不用购买、不用备案。

### 注意事项
- 如果构建失败，先看日志里的错误信息，常见原因：
  - Output directory 填错 → 找不到 `index.html`。
  - `edgeone.json` 格式错误 → 安全头解析失败。
  - 仓库没推上来 → 空仓库。
- 如果看到 404，检查 `dist/index.html` 是否真的在仓库里。

---

## Step 5：访问验证（必做）

打开默认域名后，逐项检查：

| 检查项 | 操作方法 | 预期结果 |
|---|---|---|
| 页面渲染 | 浏览器打开域名 | 看到深色仪表盘 + 离子场动画 + Top50 榜单 |
| 强制 HTTPS | 地址栏 | 显示 🔒 安全，URL 以 `https://` 开头 |
| 零外部请求 | F12 → Network → 刷新 | 除当前域名外，**没有第三方请求** |
| 安全响应头 | F12 → Network → 点主请求 → Headers → Response Headers | 能看到 `content-security-policy`、`x-content-type-options`、`referrer-policy`、`x-frame-options`、`permissions-policy` |
| JSON-LD | 右键 → 查看网页源代码，搜 `application/ld+json` | 有 1 个脚本块，内含 50 条 `ListItem` |
| noscript 兜底 | 浏览器设置里禁用 JavaScript 后刷新 | 页面显示纯文本 Top50 榜单 |
| llms.txt | 访问 `https://你的域名/llms.txt` | 返回站点说明文本 |
| robots.txt | 访问 `https://你的域名/robots.txt` | 返回 Allow: / 等内容 |

### 注意事项
- 如果安全头没出现，回到 EdgeOne 控制台 → 项目设置 → 检查 `edgeone.json` 是否被读取。
- `edgeone.json` 的 header value 不能有中文字符，本站都是 ASCII，一般没问题。

---

## Step 6：更新 `sitemap.xml` 真实域名

### 操作方法
1. 本地打开 `model-hub/sitemap.xml`。
2. 把 `<loc>https://model-hub.example.com/</loc>` 里的 `model-hub.example.com` 替换为你的 EdgeOne 默认域名（例如 `model-hub-xxxxxx.edgeone.app`）。
3. 保存后重新打包并推送：
   ```bash
   cd J:/WorkBuddy/2026-09-07-23-25-37/model-hub
   python build_standalone.py
   git add .
   git commit -m "更新 sitemap 真实域名"
   git push
   ```
4. 等待 EdgeOne 自动重新部署（约 1 分钟）。

### 操作要点
- 也可以不运行 `build_standalone.py`，直接改 `dist/sitemap.xml` 然后 push，但改源码再打包更规范。
- 自定义域名的话，填自定义域名。

### 注意事项
- 如果不改 sitemap，搜索引擎提交的地图里就是 `example.com`，白提交。

---

## Step 7：提交搜索引擎 / AI 爬虫收录

### 操作方法
按顺序提交：

1. **Bing Webmaster Tools**（重点，AI 搜索多走 Bing）
   - 打开 https://www.bing.com/webmasters
   - 添加你的 EdgeOne 域名。
   - 验证方式：选 URL 前缀验证，上传指定 HTML 文件到 `dist/` 目录，或添加 DNS TXT 记录。
   - 验证通过后，提交 `https://你的域名/sitemap.xml`。

2. **百度搜索资源平台**（大陆流量入口）
   - 打开 https://ziyuan.baidu.com/
   - 添加站点 → 验证网站（推荐 HTML 文件验证）。
   - 在 "普通收录" 里提交 sitemap 链接。

3. **Google Search Console**（顺手）
   - 打开 https://search.google.com/search-console
   - 添加域名或 URL 前缀，验证后提交 sitemap。

4. **llms.txt 曝光**
   - 确保 `https://你的域名/llms.txt` 可访问。
   - 在 robots.txt 里已经允许爬虫访问，无需额外操作。

### 操作要点
- Bing 是 ChatGPT/Copilot 搜索的重要索引源，**务必优先提交**。
- 百度对未备案域名的收录速度会慢一些，但国际版域名仍可被收录。

### 注意事项
- 验证文件（如 Bing 或百度的 HTML 文件）需要放到 `dist/` 目录下并重新打包 push。
- 每次添加验证文件后，都要 `python build_standalone.py` + `git push` 才会生效。

---

## Step 8：配置监控与回滚

### 操作方法
1. **Uptime 监控（免费）**
   - 注册 UptimeRobot 免费版：https://uptimerobot.com/
   - 添加监控，输入你的 EdgeOne 域名，选择 HTTPS，5 分钟检测一次。
   - 异常时邮件/微信通知。

2. **EdgeOne 控制台回滚**
   - 进入项目 → Deployments / 部署记录。
   - 每次 push 都会生成一个部署版本。
   - 如果新版出问题，点击历史版本 → **Rollback** 即可回退。

3. **本地备份**
   - 每次发布前保留上一个 `dist/index.html` 副本（或在 Git 里打 tag）。

### 注意事项
- EdgeOne 免费套餐每日手动 Purge Cache 限制 10 次，更新后如果缓存未刷新，优先等 1–2 分钟或用小版本号策略（改 `data.js` 后 bump DATA_VERSION）。
- 不要依赖实时 Purge，内容更新后自然失效即可。

---

## 后续变现建议（暂不执行，先积累流量）

等日均 UV 稳定后再开启：

| 阶段 | 变现方式 | 是否需备案 |
|---|---|---|
| 初期 | 打赏 / 赞助 / 私域引流 | 否 |
| 中期 | 淘宝联盟 / 京东联盟（相关内容带货） | 否 |
| 后期 | 知识付费 / 代部署建站 / AI 咨询 | 否 |
| 可选 | 百度联盟 / 国内广告 | **是**（需备案，与免备案路线冲突） |

> 当前路线：**不备案**，所以变现阶段避开百度联盟等强制备案渠道。

---

## 常见问题速查

**Q：部署后访问 404？**
A：检查 Output directory 是否填了 `dist`，以及 `dist/index.html` 是否存在于 GitHub 仓库中。

**Q：安全响应头没生效？**
A：检查 `dist/edgeone.json` 是否为合法 JSON，key/value 是否含中文，header 总数是否超过 30 个。

**Q：修改内容后网站没更新？**
A：本地改源码 → `python build_standalone.py` → `git add .` → `git commit` → `git push`，EdgeOne 会自动重新部署。

**Q：想绑定自己的域名？**
A：EdgeOne 国际版支持自定义域名且**不需要备案**。项目设置 → Custom Domain → 按提示添加 CNAME 解析即可。
