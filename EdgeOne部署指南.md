# EdgeOne Pages（腾讯云国际版）部署实操指南

> 适用：model-hub 单文件静态站点（`dist/` 目录，已含 `index.html` + 部署脚手架）
> 决策依据：用户选择「**EdgeOne 国际免费档（回源香港 / 免备案 / 大陆访问较稳）**」，
> 与「免费优先、不碰付费与备案」铁律一致。
> 生效日期：2026-09-11

---

## 0. 为什么选 EdgeOne 国际版

| 维度 | Cloudflare Pages | GitHub Pages | **EdgeOne Pages 国际版（选定）** |
|---|---|---|---|
| 费用 | 免费 | 免费 | **免费**（仅邮箱+GitHub，无信用卡/手机号） |
| 备案 | 免备案 | 免备案 | **免备案**（国际版，海外节点） |
| 大陆访问 | 不稳 / 常被限 | 慢 | **较稳**（腾讯有大陆边缘节点，优于前两者） |
| 自定义域名 | 需自行解析 | 需自行解析 | 国际版绑定域名**也免备案** |
| 单账号容量 | 无限 | 1 GB/库 | 总 ≤ 5 GB（足够） |

> 注意区分：EdgeOne **国内版**自定义域名必须 ICP 备案；**国际版**无需备案。本项目用国际版。

---

## 1. 前置条件（一次性准备）

1. **GitHub 账号**（已有则跳过）。
2. **EdgeOne 国际版账号**：访问 https://edgeone.ai/register ，用邮箱（推荐 Gmail/Hotmail）注册，
   或 Google 授权登录；注册后进入腾讯云国际站控制台，**Pages 服务本身免费、无需绑卡**。
3. 本机已生成 `model-hub/dist/` 目录（含 `index.html` `llms.txt` `robots.txt` `sitemap.xml` `edgeone.json`）。
   若改动过数据，先重跑：`python build_standalone.py`。

---

## 2. 准备 GitHub 仓库

把整个 `model-hub` 项目推到 GitHub（EdgeOne 只能从 GitHub 拉取构建，**不提供网页直接上传**）。

```bash
cd model-hub
git init            # 若尚未初始化
git add .
git commit -m "model-hub 单文件站点 + EdgeOne 部署脚手架"
git remote add origin https://github.com/<你的用户名>/model-hub.git
git push -u origin main
```

> 关键：`dist/` 是 EdgeOne 的「输出目录」，里面必须含 `index.html`（站点的入口）。
> `edgeone.json` 已放在 `dist/` 内，用于配置安全响应头（替代 Cloudflare 的 `_headers`）。

---

## 3. 在 EdgeOne 创建 Pages 项目

1. 打开 https://console.tencentcloud.com/edgeone/pages （或控制台左侧菜单 → **Pages**），点击 **立即开通 / 创建项目**。
2. 点击 **绑定 GitHub**，授权并选中刚才的 `model-hub` 仓库。
3. 填写构建配置（重点）：

| 配置项 | 填法 |
|---|---|
| Framework preset（框架） | 选 **None / 纯静态**（或「Other」） |
| Build command（构建命令） | **留空**（本站是预打包好的单文件，无需再构建） |
| Output directory（输出目录） | 填 **`dist`**（构建脚本的输出目录，内含 index.html） |
| Node 版本 | 默认即可（用不到） |

4. 点击 **开始部署 / Deploy**，等待约 1–2 分钟。

---

## 4. 获取访问地址

部署成功后会给出一个 **默认域名**，形如：

```
https://<项目名>.edgeone.app/
```

直接打开即可访问。无需购买域名、无需备案。

### （可选）绑定自定义域名（国际版，仍免备案）

1. 项目页 → **自定义域名** → 填写你的域名（如 `model-hub.example.com`）。
2. 按页面给出的 **CNAME 记录** 到你的域名 DNS 处添加解析。
3. 等待 DNS 生效 + 免费 SSL 证书签发（约 30 分钟）。
4. 国际版绑定域名**不要求 ICP 备案**（与国内版不同）。

> 若计划后续做百度收录，建议绑定一个已备案域名走 EdgeOne 国内版；
> 但那会触发备案流程，与「免备案」取向冲突——**目前阶段维持默认 `*.edgeone.app` 即可**。

---

## 5. 部署后验证（必做）

打开站点后逐项核对：

| 检查项 | 方法 | 预期 |
|---|---|---|
| 页面正常渲染 | 浏览器打开默认域名 | 深色仪表盘 + 离子场 + Top50 榜单 |
| 零外部请求 | DevTools → Network，刷新 | 除本站资源外**无任何第三方请求**（已内联） |
| 安全响应头生效 | `curl -I https://<项目名>.edgeone.app/` | 出现 `content-security-policy`、`x-content-type-options`、`referrer-policy`、`x-frame-options`、`permissions-policy` |
| JSON-LD 结构化数据 | 查看页面源码搜 `application/ld+json` | 1 个脚本块，内含 **50** 条 `ListItem` |
| noscript 兜底 | 禁用 JS 后刷新 | 出现纯文本 Top50 榜单（`<noscript>`） |
| llms.txt 可读 | 访问 `https://<项目名>.edgeone.app/llms.txt` | 返回站点说明文本 |

> 安全头若没出现，先确认 `edgeone.json` 在 `dist/` 根目录且为合法 JSON（key/value 不含中文）。

---

## 6. 提交收录（部署后下一步）

| 平台 | 动作 | 备注 |
|---|---|---|
| **Bing Webmaster Tools** | 提交 sitemap.xml（`/sitemap.xml`）+ 站点 | 国际版 Bing 抓取友好，AI 搜索（Copilot）多走 Bing |
| **百度搜索资源平台** | 普通收录提交（主动推送/手动） | 大陆流量主入口；国际版域名亦可被收，速度略慢 |
| **llms.txt** | 确保 `https://<域名>/llms.txt` 可访问 | 供 ChatGPT/Perplexity 等 AI 爬虫读取站点说明 |
| **Google Search Console** | 提交 sitemap | Google 对 JS 渲染支持最好，顺手提交 |

> 提交 sitemap 前，把 `dist/sitemap.xml` 里的 `https://model-hub.example.com/` 改成真实域名。

---

## 7. 回滚与运维

- **回滚**：EdgeOne 每次部署有历史版本，可在控制台一键回退到上一个部署。
- **更新内容**：只改 `data.js` 等源文件 → 提交 GitHub → EdgeOne 自动重新部署（若开启自动部署）。
- **重打包**：若改了源文件，先本地 `python build_standalone.py` 再 `git push`，避免 dist 与源码不一致。
- **容量**：单账号总容量 ≤ 5 GB，本站不足 1 MB，完全无压力。

---

## 8. 待你拍板后的后续步骤（暂未执行）

- **开启变现**：联盟（淘宝/京东联盟）、赞助、打赏、知识付费、代部署建站 / AI 咨询。
  注意：百度联盟**要求备案**，与免备案取向冲突 → 优先选**不强制备案**的变现渠道（如淘宝/京东联盟、赞助、打赏）。
- **合规复核**：每季度复查一次清单（时效、备案政策、广告法绝对化用语）。

---

## 附：与 Cloudflare Pages 的差异（备查）

- Cloudflare 用根目录 `_headers` 文件配响应头；**EdgeOne 用 `edgeone.json` 的 `headers` 数组**（格式见 `dist/edgeone.json`）。
- EdgeOne 的 header `value` **不支持中文**，本站安全头均为 ASCII，无影响。
- EdgeOne 必须通过 **GitHub 集成** 部署；Cloudflare 也支持 Git 但另有直接上传。
