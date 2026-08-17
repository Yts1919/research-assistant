#!/usr/bin/env python3
"""文献综述工具：领域概况统计 / 导出 Markdown·Word / 参考文献转 GB/T 7714。

用法：
  python tools/review.py --stats [papers.json]                       # 领域概况统计（默认读检索结果面板）
  python tools/review.py --export review.json [--format md|docx] [--out 文件]   # 导出综述
  python tools/review.py --refs review.json                          # 参考文献转 GB/T 7714（就地+写回面板）
"""
import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

from _common import load_config

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def papers_path():
    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg, dict) else {}
    return (node.get("json_path") or "").strip()


def review_path():
    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg, dict) else {}
    return (node.get("review_json_path") or "").strip()


def _load_papers(path):
    path = path or papers_path()
    if not path or not Path(path).exists():
        print("[review] 未找到检索结果 JSON，请先检索或指定 papers.json", file=sys.stderr)
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data if isinstance(data, list) else data.get("papers", [])


def do_stats(path):
    papers = _load_papers(path)
    if not papers:
        return

    years = Counter()
    for p in papers:
        y = str(p.get("year", "")).strip()
        if y.isdigit():
            years[y] += 1
    print("=== 发文趋势（年份 → 篇数）===")
    for y in sorted(years):
        print(f"  {y}: {years[y]}")

    authors = Counter()
    for p in papers:
        for a in (p.get("authors") or []):
            if a.strip():
                authors[a.strip()] += 1
    print("\n=== 高产作者 TOP 10 ===")
    for a, c in authors.most_common(10):
        print(f"  {a}: {c}")

    venues = Counter()
    for p in papers:
        v = str(p.get("venue") or "").strip()
        if v:
            venues[v] += 1
    print("\n=== 主要期刊 TOP 10 ===")
    for v, c in venues.most_common(10):
        print(f"  {v}: {c}")

    print("\n=== 高被引 TOP 10 ===")
    for p in sorted(papers, key=lambda x: (x.get("citations") or 0), reverse=True)[:10]:
        print(f"  [被引 {p.get('citations')}] {str(p.get('title',''))[:60]} ({p.get('year','')}, {p.get('venue','')})")


def do_export(review_json, fmt, out):
    review = json.loads(Path(review_json).read_text(encoding="utf-8"))
    title = review.get("title", "")
    sections = review.get("sections", [])
    refs = review.get("references", [])

    if fmt == "md":
        lines = [f"# {title}", ""]
        for s in sections:
            lines.append(f"## {s.get('heading', '')}")
            lines.append("")
            lines.append(s.get("body", ""))
            lines.append("")
        if refs:
            lines.append("## 参考文献")
            lines.append("")
            for r in refs:
                lines.append(f"[{r.get('id')}] {r.get('text', '')}")
        out = out or "review.md"
        Path(out).write_text("\n".join(lines), encoding="utf-8")
        print(f"[review] 已导出 {out}")
    elif fmt == "docx":
        _write_docx(title, sections, refs, out or "review.docx")
        print(f"[review] 已导出 {out or 'review.docx'}")


def _xml_escape(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _write_docx(title, sections, refs, out):
    """纯标准库生成 .docx（ZIP+XML，不依赖 python-docx/lxml）。"""
    import zipfile

    def para(text, size=None, bold=False):
        rpr = ""
        if bold or size:
            rpr = "<w:rPr>"
            if bold:
                rpr += "<w:b/>"
            if size:
                rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
            rpr += "</w:rPr>"
        return '<w:p><w:r>' + rpr + '<w:t xml:space="preserve">' + _xml_escape(text) + "</w:t></w:r></w:p>"

    body = [para(title, size=32, bold=True)]
    for s in sections:
        body.append(para(s.get("heading", ""), size=28, bold=True))
        for line in (s.get("body", "") or "").split("\n"):
            if line.strip():
                body.append(para(line))
    if refs:
        body.append(para("参考文献", size=28, bold=True))
        for r in refs:
            body.append(para(f"[{r.get('id')}] {r.get('text', '')}"))

    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
                + "".join(body) + "<w:sectPr/></w:body></w:document>")
    content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                     '<Default Extension="xml" ContentType="application/xml"/>'
                     '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                     '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>')

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)


def do_refs_gbt(review_json):
    import importlib.util
    spec = importlib.util.spec_from_file_location("cite", Path(__file__).parent / "cite.py")
    cite = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cite)

    review = json.loads(Path(review_json).read_text(encoding="utf-8"))
    changed = 0
    for r in review.get("references", []):
        m = re.search(r"10\.\d{4,9}/[^\s\"'）)\]》]+", r.get("text", ""))
        if not m:
            continue
        doi = m.group(0).rstrip(".,;")
        try:
            p = cite.fetch_by_doi(doi)
            r["text"] = cite.fmt(p, "gb7714")
            changed += 1
        except Exception:  # noqa: BLE001
            continue
    Path(review_json).write_text(json.dumps(review, ensure_ascii=False), encoding="utf-8")
    print(f"[review] 参考文献已转 GB/T 7714（{changed} 条）")
    # 同步写回面板
    rp = review_path()
    if rp:
        import time
        data = {"updated": time.time(), **review}
        Path(rp).parent.mkdir(parents=True, exist_ok=True)
        Path(rp).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"[review] 面板已更新 {rp}")


def do_check(review_json):
    review = json.loads(Path(review_json).read_text(encoding="utf-8"))
    sections = review.get("sections", [])
    refs = review.get("references", [])
    ref_ids = {int(r.get("id")) for r in refs if str(r.get("id", "")).isdigit()}
    body = "\n".join(s.get("body", "") for s in sections)
    cited = {int(m) for m in re.findall(r"\[(\d+)\]", body)}
    dangling = sorted(cited - ref_ids)
    missing = sorted(ref_ids - cited)
    print(f"[review] 引用检查：正文引用 {len(cited)} 处，参考文献 {len(ref_ids)} 条")
    if dangling:
        print(f"  ✗ 正文引用但文末缺失: {dangling}")
    if missing:
        print(f"  ✗ 文末有但正文未引用: {missing}")
    if not dangling and not missing:
        print("  ✓ 引用与参考文献一一对应")


def do_save(review_json, out):
    review = json.loads(Path(review_json).read_text(encoding="utf-8"))
    out = out or ("review_draft_" + time.strftime("%Y%m%d_%H%M%S") + ".json")
    Path(out).write_text(json.dumps(review, ensure_ascii=False), encoding="utf-8")
    print(f"[review] 草稿已保存 {out}")


def do_load(draft_file):
    review = json.loads(Path(draft_file).read_text(encoding="utf-8"))
    rp = review_path()
    if not rp:
        print("[review] 未配置 panel.review_json_path，无法载入面板", file=sys.stderr)
        return
    data = {"updated": time.time(), **review}
    Path(rp).parent.mkdir(parents=True, exist_ok=True)
    Path(rp).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"[review] 草稿已载入面板 {rp}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", nargs="?", const="", default=None, help="领域概况统计（可选 papers.json 路径）")
    ap.add_argument("--export", default="", help="导出综述（review.json）")
    ap.add_argument("--format", default="md", choices=["md", "docx"], help="导出格式")
    ap.add_argument("--out", default="", help="导出文件路径")
    ap.add_argument("--refs", default="", help="参考文献转 GB/T 7714（review.json）")
    ap.add_argument("--check", default="", help="引用完整性检查（review.json）")
    ap.add_argument("--save", default="", help="保存草稿（review.json，--out 指定文件名）")
    ap.add_argument("--load", default="", help="载入草稿到面板（草稿.json）")
    a = ap.parse_args()

    if a.stats is not None:
        do_stats(a.stats)
    elif a.export:
        do_export(a.export, a.format, a.out)
    elif a.refs:
        do_refs_gbt(a.refs)
    elif a.check:
        do_check(a.check)
    elif a.save:
        do_save(a.save, a.out)
    elif a.load:
        do_load(a.load)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
