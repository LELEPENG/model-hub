# -*- coding: utf-8 -*-
"""
MODEL HUB · 封面工厂 · 批量导出
用法:
    python export_covers.py                # 按 cover-data.js 里的 COVER.rank 导出 6 张
    python export_covers.py --rank 8       # 临时指定今天的名次（不改数据文件）
    python export_covers.py --rank 8 --out out/day08
依赖: 本机 Chrome（自动探测），无需安装任何 Python 包
"""
import argparse
import json
import os
import re
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def png_size(path):
    with open(path, "rb") as f:
        if f.read(8) != PNG_SIG:
            return None
        f.read(8)
        w, h = struct.unpack(">II", f.read(8))
        return w, h


def read_presets():
    """从 cover-data.js 里读 PRESETS（不引入 node/python 依赖，正则提取）"""
    src = open(os.path.join(HERE, "cover-data.js"), encoding="utf-8").read()
    m = re.search(r"const\s+PRESETS\s*=\s*(\[.*?\]);", src, re.S)
    if not m:
        raise SystemExit("cover-data.js 里找不到 PRESETS")
    raw = m.group(1)
    raw = re.sub(r"//.*", "", raw)
    raw = raw.replace("'", '"')
    raw = re.sub(r"([{,]\s*)([A-Za-z_]\w*)\s*:", r'\1"\2":', raw)  # 裸键加引号
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)  # 去尾逗号
    return json.loads(raw)


def read_rank():
    src = open(os.path.join(HERE, "cover-data.js"), encoding="utf-8").read()
    m = re.search(r"rank:\s*(\d+)", src)
    return int(m.group(1)) if m else 1


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    raise SystemExit("找不到 Chrome/Edge，请手动改 CHROME_CANDIDATES")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rank", type=int, default=None, help="今天的名次 1-20")
    ap.add_argument("--out", default=None, help="输出目录（默认 covers/out）")
    ap.add_argument("--only", default=None, help="只导指定 id，如 xhs-3x4")
    args = ap.parse_args()

    rank = args.rank or read_rank()
    presets = read_presets()
    if args.only:
        presets = [p for p in presets if p["id"] == args.only]
        if not presets:
            raise SystemExit("没有匹配的 preset: " + args.only)

    outdir = os.path.join(HERE, args.out) if args.out else os.path.join(HERE, "out")
    os.makedirs(outdir, exist_ok=True)

    chrome = find_chrome()
    cover_url = "file:///" + os.path.join(HERE, "cover.html").replace("\\", "/")

    ok, fail = 0, 0
    print("今天讲第 %d 名 · 共 %d 个尺寸" % (rank, len(presets)))
    for p in presets:
        w, h, s = p["w"], p["h"], p["s"]
        url = "%s?w=%d&h=%d&s=%s&rank=%d&_=%d" % (cover_url, w, h, s, rank, os.getpid())
        out = os.path.join(outdir, "day%02d_rank%02d_%s.png" % (rank, rank, p["id"]))
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--disable-application-cache",
            "--disk-cache-size=1",
            "--user-data-dir=" + os.path.join(outdir, ".chrome-tmp"),
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--default-background-color=00000000",
            "--window-size=%d,%d" % (w, h),
            "--virtual-time-budget=4000",
            "--screenshot=" + out,
            url,
        ]
        try:
            subprocess.run(cmd, capture_output=True, timeout=90)
        except subprocess.TimeoutExpired:
            print("  [超时] %s" % p["id"])
            fail += 1
            continue
        if os.path.exists(out):
            size = png_size(out)
            kb = os.path.getsize(out) // 1024
            expect = (w, h)
            flag = "OK " if size == expect else "尺寸异常!"
            print("  [%s] %-10s %sx%s  %4dKB  实际=%s" % (flag, p["id"], w, h, kb, size))
            ok += 1 if size == expect else 0
            fail += 0 if size == expect else 1
        else:
            print("  [失败] %s 未生成文件" % p["id"])
            fail += 1

    print("\n完成: 成功 %d · 失败 %d · 输出目录 %s" % (ok, fail, outdir))
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
