# -*- coding: utf-8 -*-
"""
build_standalone.py
把 model-hub 多文件站点打包成一个自包含的 HTML，并整理成可直接部署到
EdgeOne Pages（腾讯云国际版，免备案）的 dist/ 目录。

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
SCAFFOLD = [
    'llms.txt', 'robots.txt', 'sitemap.xml', 'edgeone.json',
    'baidu_verify_codeva-TgpH2v8bf3.html',
]

# 搜索引擎站点所有权验证标签（按平台要求填入，会自动注入 <head>）
VERIFY_META_TAGS = [
    '<meta name="baidu-site-verification" content="codeva-TgpH2v8bf3" />',
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
        # 5. <noscript> 纯文本榜单兜底，注入到空的 #view 容器内
        noscript = make_noscript(items)
        html, n_ns = re.subn(r'(<div id="view"[^>]*>)\s*</div>',
                              lambda m: m.group(1) + noscript + '</div>', html, count=1)
        if n_ns == 0:
            print('[!] 未找到空的 #view 容器，noscript 兜底未注入（不影响主流程）')
    else:
        print('[!] 未解析到 TOP50，跳过 JSON-LD / noscript 注入')
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
    print('     JSON-LD 条目：%d 条 / noscript 兜底：%s'
          % (len(items), '已注入' if items else '未注入'))
    print('     外部依赖：零（完全自包含，无第三方字体/CDN，规避 PIPL 数据出境风险）')
    print('     部署脚手架已拷入 dist/：%s' % ('、'.join(copied) if copied else '无'))


if __name__ == '__main__':
    main()
