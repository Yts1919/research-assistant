#!/usr/bin/env python3
"""论文精读工具：提取论文全文/元数据，并把精读卡片写入右侧面板。

用法：
  python tools/paper.py --pdf 论文.pdf --out 论文.txt    # 提取全文(保存到out) + 打印元数据/摘要预览
  python tools/paper.py --doi 10.xxxx                     # 用 Crossref 取元数据 + 摘要
  python tools/paper.py --write-card [面板json路径] --card 卡片.json   # 把精读卡片写入面板
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

from _common import load_config

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
UA = {"User-Agent": "research-assistant/1.0"}


def extract_pdf(path):
    import fitz  # PyMuPDF
    doc = fitz.open(path)
    text = "\n".join(p.get_text() for p in doc)
    meta = doc.metadata or {}
    return text, meta


def fetch_crossref(doi):
    from urllib.parse import quote

    doi = (doi or "").strip()
    if doi.startswith("http"):
        doi = doi.split("doi.org/")[-1]
    r = requests.get(f"https://api.crossref.org/works/{quote(doi)}", headers=UA, timeout=25)
    r.raise_for_status()
    it = r.json()["message"]
    year = ""
    for k in ("published-print", "published-online", "issued"):
        if it.get(k) and it[k].get("date-parts"):
            year = it[k]["date-parts"][0][0]
            break
    abstract = re.sub(r"<[^>]+>", " ", it.get("abstract") or "")
    abstract = " ".join(abstract.split())
    return {
        "title": (it.get("title") or [""])[0],
        "authors": "; ".join(f"{a.get('given','')} {a.get('family','')}".strip() for a in it.get("author", [])),
        "venue": (it.get("container-title") or [""])[0],
        "year": str(year),
        "doi": it.get("DOI", ""),
        "url": it.get("URL", ""),
        "abstract": abstract,
    }


def paper_panel_path():
    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg, dict) else {}
    return (node.get("paper_json_path") or "").strip() or os.getenv("PAPER_PANEL_JSON", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default="", help="PDF 文件路径")
    ap.add_argument("--doi", default="", help="DOI")
    ap.add_argument("--out", default="", help="把提取的全文保存到该文件")
    ap.add_argument("--write-card", action="store_true", help="把精读卡片写入面板 JSON（配合 --card）")
    ap.add_argument("--card", default="", help="精读卡片 JSON 文件（含 title/sections 等字段）")
    ap.add_argument("--panel", default="", help="面板 JSON 路径（默认读 config 的 panel.paper_json_path）")
    a = ap.parse_args()

    if a.write_card:
        if not a.card:
            print("[paper] --write-card 需要 --card 卡片JSON文件", file=sys.stderr)
            return
        card = json.loads(Path(a.card).read_text(encoding="utf-8-sig"))
        data = {"updated": time.time(), **card}
        path = a.panel or paper_panel_path()
        if not path:
            print("[paper] 未配置 panel.paper_json_path，请用 --panel 指定路径", file=sys.stderr)
            return
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"[paper] 精读卡片已写入 {path}", file=sys.stderr)
        return

    text = ""
    if a.pdf:
        try:
            text, meta = extract_pdf(a.pdf)
            print(f"# {meta.get('title', '')}".strip())
            print(f"[meta] {json.dumps(meta, ensure_ascii=False)}")
        except Exception as e:  # noqa: BLE001
            print(f"[warn] PDF 提取失败: {e}", file=sys.stderr)
            return
    elif a.doi:
        try:
            m = fetch_crossref(a.doi)
            print(f"# {m['title']}")
            print(f"作者: {m['authors']} | {m['year']} | {m['venue']}")
            print(f"DOI: {m['doi']} | URL: {m['url']}")
            if m.get("abstract"):
                print(f"摘要: {m['abstract']}")
        except Exception as e:  # noqa: BLE001
            print(f"[warn] DOI 元数据获取失败: {e}", file=sys.stderr)
            return
    else:
        print("[paper] 请提供 --pdf 或 --doi", file=sys.stderr)
        return

    if text:
        if a.out:
            Path(a.out).write_text(text, encoding="utf-8")
            print(f"[paper] 全文已保存 {a.out}（{len(text)} 字符）", file=sys.stderr)
        print(f"[paper] 全文预览:\n{text[:1200]}")


if __name__ == "__main__":
    main()
