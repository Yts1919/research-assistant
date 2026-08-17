#!/usr/bin/env python3
"""分节写作工具：草稿拼接 / 初始化。

用法：
  python tools/section.py --init "论文标题" --out 草稿.json          # 初始化空草稿
  python tools/section.py --concat 草稿.json --out paper.md          # 拼接各节为全文 Markdown

草稿 JSON 结构（与右侧「写作」面板一致）：
  {"title": "…", "argument": "整体一句话论证",
   "sections": [{"id":"引言", "argument":"本节一句话论证", "draft":"草稿"}, …],
   "ledger": {"symbols": {"σ":"应力", …}, "terms": {"磁记忆":"metal magnetic memory", …}}}
"""
import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def do_init(title, out):
    draft = {"title": title, "argument": "", "sections": [], "ledger": {"symbols": {}, "terms": {}}}
    out = out or "draft.json"
    Path(out).write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[section] 已初始化草稿 {out}")


def do_concat(draft_json, out):
    d = json.loads(Path(draft_json).read_text(encoding="utf-8"))
    lines = [f"# {d.get('title', '')}", ""]
    if d.get("argument"):
        lines.append(f"> 一句话论证：{d['argument']}")
        lines.append("")
    for s in d.get("sections", []):
        lines.append(f"## {s.get('id', '')}")
        lines.append("")
        if s.get("argument"):
            lines.append(f"> 本节论证：{s['argument']}")
            lines.append("")
        lines.append(s.get("draft", ""))
        lines.append("")
    out = out or "paper.md"
    Path(out).write_text("\n".join(lines), encoding="utf-8")
    n = len(d.get("sections", []))
    print(f"[section] 全文已拼接 {out}（{n} 节）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--init", default="", help="初始化空草稿（标题）")
    ap.add_argument("--concat", default="", help="拼接草稿为全文（草稿.json）")
    ap.add_argument("--out", default="", help="输出文件路径")
    a = ap.parse_args()

    if a.init:
        do_init(a.init, a.out)
    elif a.concat:
        do_concat(a.concat, a.out)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
