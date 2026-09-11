# -*- coding: utf-8 -*-
"""
build_standalone.py
把 model-hub 多文件站点打包成一个自包含的 HTML，并整理成可直接部署到
EdgeOne Pages（腾讯云国际版，免备案）或 Cloudflare Pages（免费、免备案、国内可公开访问）
的 dist/ 目录。两套响应头配置（edgeone.json / _headers）一并拷入 dist/，互不影响。

用法：
    python build_standalone.py
输出（dist/，可直接作为 EdgeOne Pages 的「输出目录」）：
    dist/index.html         单文件（CSS / JS 全部内联，零外部依赖）
    dist/llms.txt           AI 爬虫说明（自动拷贝）
    dist/robots.txt         爬虫协议（自动拷贝）
    dist/sitemap.xml        站点地图（自动拷贝）
    dist/edgeone.json       安全响应头配置（EdgeOne 用，替代 Cloudflare 的 _headers）

生产化增强（2026-09-11）：
  - 不再依赖任何第三方字体/CDN（已改用系统字体栈，消除 PIPL 数据出境风险与渲染阻塞）。
  - 自动从 data.js 的 TOP50 生成：
      * <head> 内的 JSON-LD（ItemList 结构化数据，喂给 Google / Bing / Perplexity / ChatGPT）
      * #view 内的 <noscript> 纯文本榜单兜底（保证不执行 JS 的爬虫也能读到完整排名）
    从而缓解「列表由 JS 运行时生成、AI 搜索爬虫可能漏收」的问题。
"""
import io
import json
import os
import re
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(BASE, 'dist')

CSS_FILES = ['styles.css']
JS_FILES = ['data.js', 'app.js', 'intro.js', 'ions.js', 'fx.js']
# 部署脚手架：随打包一起拷进 dist/，使 dist/ 成为可直接部署的目录
# 同时兼容 EdgeOne（edgeone.json）与 Cloudflare Pages（_headers），各自忽略对方格式
SCAFFOLD = [
    'llms.txt', 'robots.txt', 'sitemap.xml', 'edgeone.json', '_headers',
]

# 搜索引擎站点所有权验证标签（按平台要求填入，会自动注入 <head>）
VERIFY_META_TAGS = [
    # 示例：'<meta name="baidu-site-verification" content="codeva-xxx" />',
    # 示例：'<meta name="google-site-verification" content="xxx" />',
]


def read(name):
    with io.open(os.path.join(BASE, name), encoding='utf-8') as f:
        return f.read()


LOCAL = r'(?:styles\.css|data\.js|app\.js|intro\.js|ions\.js|fx\.js)'


def clean_query(html):
    """去掉本地资源的 ?v= 版本号（打包后已无缓存问题）"""
    return re.sub(r'\b(src|href)=("' + LOCAL + r')\?v=[^"]*"',
                  lambda m: '%s=%s"' % (m.group(1), m.group(2)), html)


# ---------------------------------------------------------------------------
# 从 data.js 解析 TOP50，生成 JSON-LD 与 noscript 兜底
# ---------------------------------------------------------------------------
def extract_top50(text):
    """提取 const TOP50 = [ ... ]; 里的条目，返回 [{rank,name,vendor,score,...}]。"""
    m = re.search(r'const TOP50 = (\[.*?\n\];)', text, re.S)
    if not m:
        return []
    block = m.group(1)
    items, depth, start = [], 0, None
    for i, ch in enumerate(block):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                items.append(block[start + 1:i])
                start = None

    out = []
    for e in items:
        def g(pat):
            mm = re.search(pat, e)
            return mm.group(1) if mm else ''
        out.append({
            'rank': int(g(r'rank:\s*(\d+)') or 0),
            'name': g(r"name:\s*'([^']*)'"),
            'vendor': g(r"vendor:\s*'([^']*)'"),
            'score': g(r'score:\s*([\d.]+)'),
            'scoreNote': g(r"scoreNote:\s*'([^']*)'"),
            'ctx': g(r"ctx:\s*'([^']*)'"),
            'price': g(r"price:\s*'([^']*)'"),
            'modality': g(r"modality:\s*'([^']*)'"),
            'accent': g(r"accent:\s*'([^']*)'"),
            'open': 'open' in e or '开源' in e,
        })
    return out


def make_jsonld(items):
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "全球 Top50 大模型排名（2026.09）",
        "description": ("model-hub 编辑性整理的全球大模型综合排名，数据核实于 2026-09-11，"
                        "覆盖文本/图像/视频多模态与本地部署/云端 API 场景。"),
        "itemListOrder": "Descending",
        "numberOfItems": len(items),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": it["rank"],
                "name": "%s（%s）" % (it["name"], it["vendor"]),
            }
            for it in items
        ],
    }
    return ('<script type="application/ld+json">'
            + json.dumps(ld, ensure_ascii=False) + '</script>')


def make_noscript(items):
    rows = []
    for it in items:
        rows.append("<li>#%d %s — %s（评分 %s｜上下文 %s｜%s）</li>" % (
            it["rank"], it["name"], it["vendor"],
            it["score"] or '-', it["ctx"] or '-', it["price"] or '-'))
    return (
        '<noscript><div id="ssr" style="max-width:880px;margin:0 auto;padding:24px;'
        'color:#cdd6e4;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\','
        '\'Microsoft YaHei\',sans-serif">'
        '<h2 style="color:#fff">全球 Top50 大模型排名（2026.09，数据核实于 2026-09-11）</h2>'
        '<ol>' + ''.join(rows) + '</ol>'
        '<p style="color:#8aa">本页为交互式页面，以上为纯文本榜单摘要；'
        '完整交互榜单请在支持 JavaScript 的浏览器中打开。</p></div></noscript>'
    )


def make_prerendered_rank(items):
    """预渲染榜单 HTML：直接输出 <ol> 内容到 #view，供爬虫/无 JS 读取。
       运行时 JS 检测到已有内容则跳过重建，只做增强。"""
    rows = []
    for it in items:
        medal = ' top' + str(it["rank"]) if it["rank"] <= 3 else ''
        accent = it.get('accent', '#6b8afd')
        rows.append(
            '<li class="rank-row%s" data-rank="%s" style="--ac:%s">'
            '<div class="rk">%d</div>'
            '<div class="rbody">'
            '<div class="rhd">'
            '<span class="rnm">%s</span>'
            '<span class="rvd">%s</span>'
            '</div>'
            '<div class="rtags">'
            '<span class="tag free">开源权重</span>'
            '<span class="tag">%s</span>'
            '<span class="tag">%s</span>'
            '<span class="tag">%s</span>'
            '</div></div>'
            '<div class="rscore">'
            '<div class="sn">%s</div>'
            '<div class="sbar"><i style="width:%s%%;background:%s"></i></div>'
            '<div class="sl">综合分</div>'
            '</div>'
            '<div class="rgo">›</div>'
            '</li>' % (
                medal, it["rank"], accent,
                it["rank"],
                it["name"], it["vendor"],
                it["modality"] or '-',
                it["ctx"] or '-',
                it["price"] or '-',
                it["score"],
                float(it["score"]),
                accent
            ))
    return '<ol>%s</ol>' % ''.join(rows)


def main():
    html = clean_query(read('index.html'))

    css = '\n'.join(read(f) for f in CSS_FILES)
    js = '\n\n'.join(
        '/* ===== %s ===== */\n%s' % (f, read(f)) for f in JS_FILES
    )

    for f in JS_FILES:
        if '</script' in read(f).lower():
            sys.exit('[X] %s 里含 </script，内联会截断，请先处理' % f)

    # 用 lambda 做替换，避免 CSS/JS 里的反斜杠被 re 当成反向引用
    # 1. CSS：link → <style>
    html, n_css = re.subn(r'<link rel="stylesheet" href="styles\.css"[^>]*>',
                          lambda m: '<style>\n' + css + '\n</style>', html)

    # 2. JS：五个 <script src> → 一个内联 <script>
    pat_js = (r'<script src="data\.js"[^>]*>\s*</script>\s*'
              r'(?:<script src="(?:app|intro|ions|fx)\.js"[^>]*>\s*</script>\s*)+')
    html, n_js = re.subn(pat_js, lambda m: '<script>\n' + js + '\n</script>', html)

    # 3. 兜底：上面的正则没匹配上时（结构变动），逐个删掉再追加到 </body> 前
    if n_js == 0:
        for f in JS_FILES:
            html = re.sub(r'<script src="%s"[^>]*>\s*</script>' % re.escape(f), '', html)
        html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')

    if n_css == 0:
        sys.exit('[X] 没找到 styles.css 的 link 标签，打包中止')

    # 4. 搜索引擎站点验证标签 + 结构化数据 JSON-LD（均注入 <head>）
    head_inject = []
    if VERIFY_META_TAGS:
        head_inject.extend(VERIFY_META_TAGS)
    items = extract_top50(read('data.js'))
    if items:
        head_inject.append(make_jsonld(items))
        # 5. 预渲染 Top50 榜单 HTML（SEO：爬虫无需执行 JS 即可读到完整排名）
        #    直接替换 <div id="view"></div> 为含预渲染榜单的内容
        #    noscript 嵌入在预渲染内容内部：JS 禁用时显示，启用时隐藏
        prerendered = make_prerendered_rank(items)
        prerender_html = (
            '<div id="view" data-prerendered="rank">'
            '<div class="lab-intro">'
            '<b>排序方法：</b>以 airankings（7 家独立榜单聚合，2026-09-09）为基准，'
            '交叉校验 llm-stats 综合指数与 BenchLM BenchAlign v5.2，归一化成本站综合分（满分 100）。'
            '<b>点任意一行</b>看它的优势、最适合干什么、以及别拿它干什么。'
            '</div>'
            '<div class="rank-tools">'
            '<button class="chip" data-rf="all">全部 50</button>'
            '<button class="chip" data-rf="open">仅开源权重</button>'
            '<button class="chip" data-rf="free">有免费档</button>'
            '<button class="chip" data-rf="cn">国产模型</button>'
            '</div>'
            + prerendered +
            '<div class="callout" style="margin-top:20px">'
            '<b>怎么读这个榜：</b>综合分只做横向对比，不代表任何官方分数。'
            '真要落地，先看 <b>适不适合你的场景</b>，再看价格——第 8 名的 Kimi K3 用 30% 的价格保留了 96% 的顶配能力，'
            '对大多数人比第 1 名更实用。'
            '</div>'
            '<noscript>' + re.sub(r'<noscript>', '', make_noscript(items), count=1) + '</noscript>'
            '</div>'
        )
        html, n_prerender = re.subn(r'<div id="view"[^>]*>[^<]*(</div>)',
                                    lambda m: prerender_html, html, count=1)
        if n_prerender == 0:
            print('[!] 未找到 #view 容器，预渲染榜单未注入（不影响主流程）')
    else:
        print('[!] 未解析到 TOP50，跳过 JSON-LD / 预渲染注入')
    if head_inject:
        html = html.replace('</head>', '\n'.join(head_inject) + '\n</head>', 1)

    # 6. 资料库 / 静态托管平台需要的根标记
    html = html.replace('<html lang="zh-CN"', '<html lang="zh-CN" data-sp-mode="scroll"', 1)

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'index.html')
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(html)

    # 7. 把部署脚手架一并拷进 dist/，使 dist/ 成为可直接部署的目录
    copied = []
    for s in SCAFFOLD:
        src = os.path.join(BASE, s)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(DIST, s))
            copied.append(s)

    size = os.path.getsize(out) / 1024.0
    print('[OK] 已生成 %s  (%.1f KB)' % (out, size))
    print('     内联 CSS %d 个 / JS %d 个' % (len(CSS_FILES), len(JS_FILES)))
    print('     JSON-LD 条目：%d 条 / noscript 兜底：%s / 预渲染榜单：%s'
          % (len(items), '已注入' if items else '未注入', '已注入' if items else '未注入'))
    print('     外部依赖：零（完全自包含，无第三方字体/CDN，规避 PIPL 数据出境风险）')
    print('     部署脚手架已拷入 dist/：%s' % ('、'.join(copied) if copied else '无'))


if __name__ == '__main__':
    main()
