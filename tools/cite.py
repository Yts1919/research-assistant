#!/usr/bin/env python3
"""引文工具：DOI 取元数据 + 格式化引文（GB/T 7714 / APA / IEEE / MLA）。

用法：
  python tools/cite.py "10.xxxx/xxxx" [--style gb7714|apa|ieee|mla]
"""
import argparse
import json
import os
import re
import sys
import time
from urllib.parse import quote

import requests

sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "research-assistant/1.0"}


def fetch_by_doi(doi):
    r = requests.get(f"https://api.crossref.org/works/{quote(doi)}", headers=UA, timeout=20)
    r.raise_for_status()
    it = r.json()["message"]
    year = ""
    for k in ("published-print", "published-online", "issued"):
        if it.get(k) and it[k].get("date-parts"):
            year = it[k]["date-parts"][0][0]
            break
    return {
        "title": (it.get("title") or [""])[0],
        "authors": [f"{a.get('given','')} {a.get('family','')}".strip() for a in it.get("author", [])],
        "year": str(year), "venue": (it.get("container-title") or [""])[0],
        "volume": it.get("volume", ""), "issue": it.get("issue", ""), "pages": it.get("page", ""),
        "publisher": it.get("publisher", ""), "doi": it.get("DOI", ""),
    }


def _parts(name):
    name = name.strip()
    if ", " in name:
        l, f = name.split(", ", 1)
        return l.strip(), f.strip()
    ps = name.split()
    return (ps[-1], " ".join(ps[:-1])) if len(ps) > 1 else (ps[0], "")


def _init(f):
    return " ".join(f"{w[0].upper()}." for w in f.split() if w)


def _gb_authors(a, title=""):
    """GB/T 7714 作者列表：中文名用全名、英文名「姓大写+名首字母」，超过 3 个用「等/et al」截断。"""
    def _gb_name(x):
        if any("\u4e00" <= c <= "\u9fff" for c in x):
            return x
        l, f = _parts(x)
        return f"{l.upper()} {''.join(w[0].upper() for w in f.split())}"

    names = [_gb_name(x) for x in a]
    has_cjk = any("\u4e00" <= c <= "\u9fff" for c in (title + "".join(a)))
    etc = "等" if has_cjk else "et al"
    if len(names) > 3:
        return ", ".join(names[:3]) + f", {etc}"
    return ", ".join(names)


def fmt(p, style):
    a = p["authors"]
    vol = p.get("volume", "")
    iss = p.get("issue", "")
    pg = p.get("pages", "")
    if style == "apa":
        # APA 7th：Author, A. A., & Author, B. B. (Year). Title. Journal, Volume(Issue), pages. https://doi.org/xxx
        ps = [f"{l}, {_init(f)}" for l, f in (_parts(x) for x in a)]
        if not ps:
            s = ""
        elif len(ps) == 1:
            s = ps[0]
        elif len(ps) <= 20:
            s = ", ".join(ps[:-1]) + f", & {ps[-1]}"
        else:
            s = ", ".join(ps[:19]) + f", … {ps[-1]}"
        voliss = f"{vol}" if vol else ""
        if iss:
            voliss += f"({iss})"
        pg_part = f", {pg}" if pg else ""
        return f"{s} ({p['year']}). {p['title']}. {p['venue']}, {voliss}{pg_part}. https://doi.org/{p['doi']}"
    if style == "ieee":
        ps = [f"{_init(f)} {l}" for l, f in (_parts(x) for x in a)]
        s = (", ".join(ps[:-1]) + f", and {ps[-1]}") if len(ps) > 1 else (ps[0] if ps else "")
        bits = [f'"{p["title"]},"', p["venue"]]
        if vol:
            bits.append(f"vol. {vol}")
        if iss:
            bits.append(f"no. {iss}")
        if pg:
            bits.append(f"pp. {pg}")
        bits.append(p["year"])
        return f'{s}, ' + ", ".join(bits) + f". doi: {p['doi']}."
    if style == "mla":
        ps = [f"{l}, {f}" for l, f in (_parts(x) for x in a)]
        s = (", ".join(ps[:-1]) + f", and {ps[-1]}") if len(ps) > 1 else (ps[0] if ps else "")
        bits = [f'"{p["title"]}."', p["venue"]]
        if vol:
            bits.append(f"vol. {vol}")
        if iss:
            bits.append(f"no. {iss}")
        bits.append(p["year"])
        if pg:
            bits.append(f"pp. {pg}")
        return f'{s}. ' + ", ".join(bits) + "."
    # gb7714 默认：作者1, 作者2, 作者3, 等. 题名[J]. 刊名, 年, 卷(期): 页码. DOI:xxx.
    s = _gb_authors(a, p["title"])
    voliss = f", {vol}" if vol else ""
    if iss:
        voliss += f"({iss.zfill(2)})"
    pg_part = f": {pg}" if pg else ""
    return f"{s}. {p['title']}[J]. {p['venue']}, {p['year']}{voliss}{pg_part}. DOI:{p['doi']}."


def _citation_cfg():
    from _common import load_config

    cfg = load_config()
    node = cfg.get("citation", {}) if isinstance(cfg, dict) else {}
    return node.get("json_path", "")


def do_append(text, doi, style):
    jp = _citation_cfg()
    if not jp:
        return
    data = {"updated": time.time(), "citations": []}
    if os.path.exists(jp):
        data = json.load(open(jp, encoding="utf-8"))
    data.setdefault("citations", []).append({"text": text, "doi": doi, "style": style})
    data["updated"] = time.time()
    os.makedirs(os.path.dirname(jp), exist_ok=True)
    json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[citation] 已加入引文面板", file=sys.stderr)


def do_remove(idx):
    jp = _citation_cfg()
    if not jp or not os.path.exists(jp):
        return
    data = json.load(open(jp, encoding="utf-8"))
    lst = data.get("citations", [])
    if 0 <= idx < len(lst):
        lst.pop(idx)
    data["citations"] = lst
    data["updated"] = time.time()
    json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[citation] 已删除第 {idx + 1} 条")


def do_clear():
    jp = _citation_cfg()
    if jp:
        json.dump({"updated": time.time(), "citations": []}, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    print("[citation] 已清空")


def _formats_path():
    from _common import load_config

    cfg = load_config()
    node = cfg.get("citation", {}) if isinstance(cfg, dict) else {}
    return node.get("formats_json", "") or _citation_cfg().replace("citation-panel.json", "custom-formats.json")


def _load_formats():
    p = _formats_path()
    if not p or not os.path.exists(p):
        return []
    return json.load(open(p, encoding="utf-8")).get("formats", [])


def do_save_format(name, template):
    p = _formats_path()
    if not p:
        print("[error] 未配置 citation.formats_json")
        return
    data = {"formats": _load_formats()}
    data["formats"] = [f for f in data["formats"] if f["name"] != name] + [{"name": name, "template": template}]
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(data, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[citation] 已保存格式：{name}")


def do_list_formats():
    fs = _load_formats()
    if not fs:
        print("(暂无保存的自定义格式)")
        return
    for i, f in enumerate(fs):
        print(f"{i}. {f['name']}: {f['template']}")


def do_remove_format(name):
    p = _formats_path()
    if not p or not os.path.exists(p):
        return
    data = {"formats": [f for f in _load_formats() if f["name"] != name]}
    json.dump(data, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[citation] 已删除格式：{name}")


def do_scan(paths, style, template):
    """扫描文件夹/PDF 路径（可多个），抓 DOI 转引文并加入面板。只处理 .pdf（论文）。"""
    import glob

    # 展开：支持多路径 + 路径内换行/分号分隔；文件夹→其下所有 .pdf；通配符→匹配 .pdf
    raw = []
    for p in paths:
        for seg in re.split(r"[\n;；]+", str(p)):
            seg = seg.strip().strip('"').strip()
            if seg:
                raw.append(seg)
    pdfs = []
    for p in raw:
        if os.path.isdir(p):
            pdfs.extend(sorted(glob.glob(os.path.join(p, "*.pdf"))))
        elif "*" in p or "?" in p:
            pdfs.extend(sorted(g for g in glob.glob(p) if g.lower().endswith(".pdf")))
        elif p.lower().endswith(".pdf"):
            pdfs.append(p)
        elif not os.path.exists(p):
            print(f"[scan] 路径不存在：{p}")
        else:
            print(f"[scan] 跳过非 PDF：{p}")
    # 去重保序
    seen = set()
    uniq = []
    for p in pdfs:
        k = os.path.abspath(p)
        if k not in seen:
            seen.add(k)
            uniq.append(p)
    pdfs = uniq
    if not pdfs:
        print("[scan] 未找到 PDF 文件（文件夹里请只放论文 PDF）")
        return
    print(f"[scan] 找到 {len(pdfs)} 个 PDF")
    import fitz  # PyMuPDF

    count = 0
    for pdf in pdfs:
        try:
            doc = fitz.open(pdf)
            text = "\n".join(pg.get_text() for pg in doc[:2])
            m = re.search(r"10\.\d{4,9}/[^\s\"'）)\]》]+", text)
            if not m:
                print(f"[scan] {os.path.basename(pdf)} 未在前2页找到 DOI")
                continue
            doi = m.group(0).rstrip(".,;")
            try:
                meta = fetch_by_doi(doi)
                cit = fmt_custom(meta, template) if template else fmt(meta, style)
                do_append(cit, doi, style if not template else "custom")
                print(f"[scan] {os.path.basename(pdf)} → {cit[:60]}")
                count += 1
            except Exception as e:  # noqa: BLE001
                print(f"[scan] {os.path.basename(pdf)} DOI({doi}) 解析失败: {e}")
        except Exception as e:  # noqa: BLE001
            print(f"[scan] {os.path.basename(pdf)} 读取失败: {e}")
    print(f"[scan] 完成，新增 {count} 条引文")


def fmt_custom(p, template):
    """按自定义模板（占位符替换）格式化引文。
    占位符：{authors} {title} {year} {journal} {volume} {issue} {pages} {doi}
    """
    a = p["authors"]
    authors = _gb_authors(a, p["title"])
    subs = {
        "{authors}": authors,
        "{author}": authors,
        "{title}": p.get("title", ""),
        "{year}": p.get("year", ""),
        "{journal}": p.get("venue", ""),
        "{volume}": p.get("volume", ""),
        "{issue}": p.get("issue", ""),
        "{pages}": p.get("pages", ""),
        "{doi}": p.get("doi", ""),
    }
    out = template
    for k, v in subs.items():
        out = out.replace(k, v)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doi", nargs="?", default="")
    ap.add_argument("--style", default="gb7714", choices=["gb7714", "apa", "ieee", "mla"])
    ap.add_argument("--template", default="", help="自定义格式模板（占位符 {authors}/{title}/{year}/{journal}/{volume}/{issue}/{pages}/{doi}）")
    ap.add_argument("--add", action="store_true", help="把格式化结果追加到引文面板")
    ap.add_argument("--remove", type=int, default=-1, help="删除引文面板第 N 条（0 起）")
    ap.add_argument("--clear", action="store_true", help="清空引文面板")
    ap.add_argument("--save-format", action="store_true", help="保存自定义格式（配合 --name --template）")
    ap.add_argument("--list-formats", action="store_true", help="列出已保存的自定义格式")
    ap.add_argument("--remove-format", action="store_true", help="删除自定义格式（配合 --name）")
    ap.add_argument("--name", default="", help="自定义格式名称")
    ap.add_argument("--scan", nargs="*", default=[], help="扫描文件夹/PDF 路径（可多个，空格分隔；文件夹里只取 .pdf）")
    a = ap.parse_args()

    if a.clear:
        do_clear()
        return
    if a.list_formats:
        do_list_formats()
        return
    if a.save_format:
        if not (a.name and a.template):
            print("[error] --save-format 需要 --name 和 --template")
            sys.exit(1)
        do_save_format(a.name, a.template)
        return
    if a.remove_format:
        do_remove_format(a.name)
        return
    if a.remove >= 0:
        do_remove(a.remove)
        return
    if a.scan:
        do_scan(a.scan, a.style, a.template)
        return
    if not a.doi:
        print("[error] 请提供 DOI（或 --scan/--save-format/--remove/--clear）")
        sys.exit(1)
    try:
        p = fetch_by_doi(a.doi)
        text = fmt_custom(p, a.template) if a.template else fmt(p, a.style)
        if a.add:
            do_append(text, a.doi, a.style if not a.template else "custom")
        print(text)
    except Exception as e:  # noqa: BLE001
        print(f"[error] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
