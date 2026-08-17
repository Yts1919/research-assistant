#!/usr/bin/env python3
"""一键部署 DSH Web 悬浮窗。

自动完成：
  1. 查找 DSH 前端 dist 目录（或 --dist 手动指定）
  2. 复制 web/*.js 到 dist
  3. 在 dist/index.html 注入 <script defer> 标签（幂等，可重复运行）
  4. 更新 config.json 的 panel/figure/citation 各 json 路径指向 dist

用法：
  python deploy.py                 # 自动查找 dist
  python deploy.py --dist <路径>    # 手动指定 dist 目录
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent

# 注入的脚本顺序（core 和 export 必须在前）
SCRIPTS = [
    "dsh-panels-core.js",
    "dsh-export.js",
    "papers-panel.js",
    "paper-panel.js",
    "review-panel.js",
    "section-panel.js",
    "figure-panel.js",
    "citation-panel.js",
    "polish-panel.js",
    "prereview-panel.js",
    "proposal-panel.js",
    "reformat-panel.js",
]

# config.json 的 panel 段 key → 面板 JSON 文件名
PANEL_PATHS = {
    "json_path": "papers-panel.json",
    "paper_json_path": "paper-panel.json",
    "review_json_path": "review-panel.json",
    "section_json_path": "section-panel.json",
    "polish_json_path": "polish-panel.json",
    "prereview_json_path": "prereview-panel.json",
    "proposal_json_path": "proposal-panel.json",
    "reformat_json_path": "reformat-panel.json",
}


def find_dist():
    """自动查找 DSH 前端 dist 目录（优先返回最近修改的那个）。"""
    candidates = []
    base_dirs = []
    la = os.environ.get("LOCALAPPDATA", "")
    if la:
        base_dirs.append(Path(la) / "npm-cache" / "_npx")
    base_dirs.append(Path.home() / ".npm" / "_npx")
    for base in base_dirs:
        if not base.exists():
            continue
        for p in base.glob("*/node_modules/@deepseek-ai/dsh-web-frontend/dist"):
            if (p / "index.html").exists():
                candidates.append(p)
    if not candidates:
        return None
    return max(candidates, key=lambda p: (p / "index.html").stat().st_mtime)


def inject(index_html):
    html = Path(index_html).read_text(encoding="utf-8")
    # 移除旧注入（带 ?v= 的 defer 脚本），保证幂等
    html = re.sub(r'[ \t]*<script defer src="/[^"]+\.js\?v=\d+"></script>\r?\n?', "", html)
    tags = "\n".join(f'    <script defer src="/{s}?v=1"></script>' for s in SCRIPTS)
    if "</body>" in html:
        html = html.replace("</body>", tags + "\n  </body>")
    else:
        html += "\n" + tags + "\n"
    Path(index_html).write_text(html, encoding="utf-8")


def update_config(dist):
    cfg_path = ROOT / "config.json"
    if not cfg_path.exists():
        print("[deploy] 未找到 config.json，跳过路径配置（请先复制 config.example.json 为 config.json 并填 Key）")
        return False
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

    panel = cfg.setdefault("panel", {})
    for key, fname in PANEL_PATHS.items():
        panel[key] = str((dist / fname).resolve())

    fig = cfg.setdefault("figure", {})
    fig["json_path"] = str((dist / "figure-panel.json").resolve())
    fig["output_dir"] = str((dist / "assets" / "figures").resolve())

    cit = cfg.setdefault("citation", {})
    cit["json_path"] = str((dist / "citation-panel.json").resolve())
    cit["formats_json"] = str((dist / "custom-formats.json").resolve())

    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main():
    ap = argparse.ArgumentParser(description="一键部署 DSH Web 悬浮窗")
    ap.add_argument("--dist", default="", help="DSH 前端 dist 目录（不填则自动查找）")
    a = ap.parse_args()

    dist = Path(a.dist) if a.dist else find_dist()
    if not dist or not (dist / "index.html").exists():
        print("[deploy] ✗ 未找到 DSH 前端 dist/index.html")
        print("  请手动指定：python deploy.py --dist <dsh-web-frontend/dist 的完整路径>")
        sys.exit(1)
    print(f"[deploy] ✓ 找到 dist: {dist}")

    web = ROOT / "web"
    copied = 0
    for js in web.glob("*.js"):
        (dist / js.name).write_bytes(js.read_bytes())
        copied += 1
    print(f"[deploy] ✓ 已复制 {copied} 个脚本到 dist")

    inject(dist / "index.html")
    print("[deploy] ✓ 已注入 <script> 标签到 index.html")

    if update_config(dist):
        print("[deploy] ✓ 已更新 config.json 各 json 路径")

    print("\n完成！请在 DSH 网页界面按 Ctrl+F5 强刷即可看到悬浮窗。")


if __name__ == "__main__":
    main()
