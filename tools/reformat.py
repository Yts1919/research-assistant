"""格式修改工具：读取 Word/TXT/MD 文档 + 写入格式修改面板。

用法：
  python tools/reformat.py --read "论文.docx" "模板.docx"      # 读取文档内容（供 AI 理解格式与原文）
  python tools/reformat.py --write 结果.json                   # 把格式修改结果写入右侧面板

面板 JSON 结构（写入 /reformat-panel.json）：
  {"title": "论文标题", "preview": "修改后的正文(Markdown)", "note": "修改说明"}
"""
import argparse
import json
import re
import sys
import time
import zipfile
from pathlib import Path

from _common import load_config

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _docx_text(path):
    """纯标准库提取 .docx 正文（不依赖 python-docx/lxml）。"""
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml, re.S)
    return "\n".join(texts)


def do_read(paths):
    for p in paths:
        p = Path(p)
        if not p.exists():
            print(f"[reformat] 路径不存在：{p}")
            continue
        if p.is_dir():
            for f in sorted(p.glob("*.docx")) + sorted(p.glob("*.txt")) + sorted(p.glob("*.md")):
                _dump_file(f)
        elif p.suffix.lower() == ".docx":
            _dump_file(p)
        elif p.suffix.lower() in (".txt", ".md", ".tex"):
            _dump_file(p)
        else:
            print(f"[reformat] 跳过不支持的文件：{p.name}")


def _dump_file(p):
    print(f"\n===== {p.name} =====")
    if p.suffix.lower() == ".docx":
        print(_docx_text(p)[:8000])
    else:
        print(p.read_text(encoding="utf-8", errors="ignore")[:8000])


def do_write(json_file):
    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg, dict) else {}
    path = node.get("reformat_json_path", "").strip()
    if not path:
        print("[reformat] 未配置 panel.reformat_json_path，请在 config.json 填写", file=sys.stderr)
        sys.exit(1)
    data = json.loads(Path(json_file).read_text(encoding="utf-8"))
    data["updated"] = time.time()
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"[reformat] 面板已更新 {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", nargs="*", default=[], help="读取 Word/TXT/MD 文档或文件夹内容")
    ap.add_argument("--write", default="", help="写入面板（格式修改结果 JSON）")
    a = ap.parse_args()

    if a.read:
        do_read(a.read)
    elif a.write:
        do_write(a.write)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
