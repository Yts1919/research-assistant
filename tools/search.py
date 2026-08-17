#!/usr/bin/env python3
"""文献检索：跨 arXiv / OpenAlex / CrossRef / Semantic Scholar / PubMed 检索真实论文。

用法：
  python tools/search.py "关键词" [--sources arxiv,openalex,crossref,pubmed] [--max 10] [--format text|bibtex|ris|csv|json]
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

from _common import load_config

sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "research-assistant/1.0"}


def search_arxiv(q, n):
    r = requests.get("http://export.arxiv.org/api/query",
                     params={"search_query": f"all:{q}", "max_results": n}, headers=UA, timeout=25)
    r.raise_for_status()
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in ET.fromstring(r.text).findall("a:entry", ns):
        abs_url = e.findtext("a:id", "", ns) or ""
        out.append({
            "title": " ".join((e.findtext("a:title", "", ns) or "").split()),
            "authors": [a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)],
            "year": (e.findtext("a:published", "", ns) or "")[:4],
            "venue": "arXiv",
            "abstract": " ".join((e.findtext("a:summary", "", ns) or "").split()),
            "url": abs_url, "doi": "",
            "pdf": re.sub(r"v\d+$", "", abs_url.replace("/abs/", "/pdf/")),
            "source": "arXiv", "citation_count": None, "oa": True,
        })
    return out


def search_openalex(q, n):
    r = requests.get("https://api.openalex.org/works",
                     params={"search": q, "per-page": n}, headers=UA, timeout=25)
    r.raise_for_status()
    out = []
    for w in r.json().get("results", []):
        authors = [((a.get("author") or {}).get("display_name") or "") for a in (w.get("authorships") or [])]
        loc = w.get("primary_location") or {}
        doi = (w.get("doi") or "").replace("https://doi.org/", "")
        pdf_url = loc.get("pdf_url") or ""
        if not pdf_url:
            pdf_url = (w.get("best_oa_location") or {}).get("pdf_url") or ""
        biblio = w.get("biblio") or {}
        pages = ""
        fp = biblio.get("first_page"); lp = biblio.get("last_page")
        if fp and lp:
            pages = f"{fp}-{lp}"
        elif fp:
            pages = str(fp)
        out.append({
            "title": w.get("display_name") or "", "authors": authors,
            "year": str(w.get("publication_year") or ""), "venue": (loc.get("source") or {}).get("display_name", ""),
            "abstract": _inv_abstract(w.get("abstract_inverted_index")),
            "url": f"https://doi.org/{doi}" if doi else "", "doi": doi,
            "pdf": pdf_url,
            "source": "OpenAlex", "citation_count": w.get("cited_by_count"),
            "oa": bool((w.get("open_access") or {}).get("is_oa")),
            "volume": (biblio.get("volume") or ""), "issue": (biblio.get("issue") or ""), "pages": pages,
        })
    return out


def _inv_abstract(idx):
    if not idx:
        return ""
    pos = {}
    for w, ps in idx.items():
        for p in ps:
            pos[p] = w
    return " ".join(pos[i] for i in sorted(pos))


def search_crossref(q, n):
    r = requests.get("https://api.crossref.org/works",
                     params={"query.bibliographic": q, "rows": n}, headers=UA, timeout=25)
    r.raise_for_status()
    out = []
    for it in r.json().get("message", {}).get("items", []):
        year = ""
        for k in ("published-print", "published-online", "issued"):
            if it.get(k) and it[k].get("date-parts"):
                year = it[k]["date-parts"][0][0]
                break
        out.append({
            "title": (it.get("title") or [""])[0],
            "authors": [f"{a.get('given','')} {a.get('family','')}".strip() for a in it.get("author", [])],
            "year": str(year), "venue": (it.get("container-title") or [""])[0],
            "abstract": "", "url": it.get("URL", ""), "doi": it.get("DOI", ""),
            "source": "CrossRef", "citation_count": it.get("is-referenced-by-count"),
            "volume": it.get("volume") or "", "issue": it.get("issue") or "",
            "pages": it.get("page") or "", "publisher": it.get("publisher") or "",
        })
    return out


def search_pubmed(q, n):
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    ids = requests.get(f"{base}/esearch.fcgi",
                       params={"db": "pubmed", "term": q, "retmax": n, "retmode": "json"}, headers=UA, timeout=25).json()["esearchresult"]["idlist"]
    if not ids:
        return []
    res = requests.get(f"{base}/esummary.fcgi",
                       params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"}, headers=UA, timeout=25).json()["result"]
    out = []
    for pid in ids:
        d = res.get(pid, {})
        if d:
            out.append({
                "title": d.get("title", ""), "authors": [a.get("name", "") for a in d.get("authors", [])],
                "year": (d.get("pubdate") or "")[:4], "venue": d.get("fulljournalname", ""),
                "abstract": "", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/", "doi": "",
                "source": "PubMed", "citation_count": None,
            })
    return out


def search_semantic_scholar(q, n):
    r = requests.get("https://api.semanticscholar.org/graph/v1/paper/search",
                     params={"query": q, "limit": n, "fields": "title,authors,year,abstract,url,externalIds,citationCount,venue"},
                     headers=UA, timeout=25)
    if r.status_code == 429:
        return []
    r.raise_for_status()
    out = []
    for d in r.json().get("data", []):
        out.append({
            "title": d.get("title", ""), "authors": [a.get("name", "") for a in d.get("authors", [])],
            "year": str(d.get("year") or ""), "venue": d.get("venue", ""),
            "abstract": d.get("abstract") or "", "url": d.get("url", ""),
            "doi": (d.get("externalIds") or {}).get("DOI", ""),
            "source": "Semantic Scholar", "citation_count": d.get("citationCount"),
        })
    return out


def search_dblp(q, n):
    r = requests.get("https://dblp.org/search/publ/api",
                     params={"q": q, "format": "json", "h": n}, headers=UA, timeout=25)
    r.raise_for_status()
    out = []
    for hit in r.json().get("result", {}).get("hits", {}).get("hit", []):
        info = hit.get("info", {})
        authors = info.get("authors", {}).get("author", [])
        if isinstance(authors, dict):
            authors = [authors]
        out.append({
            "title": info.get("title", ""), "authors": [a.get("text", "") for a in authors],
            "year": str(info.get("year", "")), "venue": info.get("venue", "") or info.get("type", ""),
            "abstract": "", "url": info.get("ee", "") or info.get("url", ""),
            "doi": info.get("doi", ""), "source": "DBLP", "citation_count": None,
        })
    return out


def _scholar_from(base, q, n, label):
    """从某个 Scholar 站点抓取结果，失败/超时/被拦返回空列表。"""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []
    from urllib.parse import quote_plus

    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
    out = []
    try:
        s.get(base + "/", timeout=10)  # 预热，拿 session cookie
        r = s.get(f"{base}/scholar?q={quote_plus(q)}", timeout=15, headers={"Referer": base + "/"})
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        for item in soup.select(".gs_r"):
            t = item.select_one(".gs_rt")
            if not t:
                continue
            title = re.sub(r"^(?:\[[^\]]+\]\s*)+", "", t.get_text(" ", strip=True))
            # 去掉中文字符之间的空格（镜像用 <b> 高亮关键词导致标题被空格切开）
            title = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", title)
            if not title:
                continue
            meta = item.select_one(".gs_a")
            meta = meta.get_text(" ", strip=True) if meta else ""
            parts = [p.strip() for p in re.split(r"\s+[-–—]\s+", meta)]
            authors = [x.strip() for x in re.split(r"[，,]", parts[0]) if x.strip()] if parts else []
            year = ""
            m = re.search(r"\b(19|20)\d{2}\b", meta)
            if m:
                year = m.group(0)
            # venue 取中间那段（"期刊, 年份"），去掉末尾年份；最后一段是出版社/域名
            venue = parts[1] if len(parts) >= 2 else ""
            venue = re.sub(r",?\s*\b(19|20)\d{2}\b\s*$", "", venue).strip()
            link_el = t.select_one("a")
            url = link_el.get("href", "") if link_el else ""
            if url.startswith("/"):
                url = base + url
            if not url:
                url = f"{base}/scholar?q={quote_plus(title)}"
            cite = item.select_one(".gs_fl a[href*='cites=']")
            citations = None
            if cite:
                mc = re.search(r"\d+", cite.get_text())
                if mc:
                    citations = int(mc.group())
            snippet = item.select_one(".gs_rs")
            abstract = snippet.get_text(" ", strip=True) if snippet else ""
            abstract = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", abstract)
            abstract = abstract.strip(" \u2026….·")
            out.append({
                "title": title, "authors": authors,
                "year": year, "venue": venue, "abstract": abstract,
                "url": url, "doi": "", "source": label,
                "citation_count": citations,
            })
            if len(out) >= n:
                break
    except Exception:  # noqa: BLE001
        pass
    return out


def search_scholar(q, n):
    """Google Scholar（仅镜像）：抓取谷歌学术镜像结果，失败返回空。"""
    return _scholar_from("https://scholar.lanfanshu.cn", q, n, "Google Scholar 镜像")


def search_core(q, n):
    r = requests.get("https://api.core.ac.uk/v3/search/works",
                     params={"q": q, "limit": n}, headers=UA, timeout=25)
    if r.status_code != 200:
        return []
    out = []
    for w in r.json().get("results", []):
        out.append({
            "title": w.get("title", ""), "authors": [a.get("name", "") for a in w.get("authors", [])],
            "year": str(w.get("yearPublished") or ""), "venue": w.get("publisher", ""),
            "abstract": w.get("abstract") or "", "url": w.get("downloadUrl", ""),
            "doi": w.get("doi", ""), "source": "CORE", "citation_count": None, "oa": True,
        })
    return out


SOURCES = {
    "arxiv": search_arxiv, "openalex": search_openalex, "crossref": search_crossref,
    "pubmed": search_pubmed, "semantic_scholar": search_semantic_scholar,
    "dblp": search_dblp, "scholar": search_scholar, "core": search_core,
}


def _norm_title(t):
    t = (t or "").lower()
    t = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", t)
    return " ".join(t.split())


def search_related(doi, n):
    """按 DOI 找相似/相关论文：先取标题，再检索同主题论文（S2 推荐尽力而为）。"""
    title = ""
    try:
        r = requests.get(f"https://api.crossref.org/works/{doi}", headers=UA, timeout=20)
        if r.status_code == 200:
            title = (r.json().get("message", {}).get("title") or [""])[0]
    except Exception:  # noqa: BLE001
        pass

    if not title:
        return []

    # 1) 先试 S2 推荐
    try:
        r = requests.get(f"https://api.semanticscholar.org/recommendations/v1/papers/DOI:{doi}",
                         params={"limit": n, "fields": "title,authors,year,abstract,url,externalIds,citationCount,venue"},
                         headers=UA, timeout=15)
        if r.status_code == 200:
            rec = r.json().get("recommendedPapers", [])
            if rec:
                return [{
                    "title": d.get("title", ""), "authors": [a.get("name", "") for a in d.get("authors", [])],
                    "year": str(d.get("year") or ""), "venue": d.get("venue", ""),
                    "abstract": d.get("abstract") or "", "url": d.get("url", ""),
                    "doi": (d.get("externalIds") or {}).get("DOI", ""),
                    "source": "Semantic Scholar 推荐", "citation_count": d.get("citationCount"),
                } for d in rec]
    except Exception:  # noqa: BLE001
        pass

    # 2) 回退：按标题检索同主题论文
    out = search_semantic_scholar(title, n)
    if not out:
        out = search_crossref(title, n)
    return out


def _bib(p):
    a = [str(x).strip() for x in (p.get("authors") or []) if str(x).strip()]
    last = a[0].split()[-1] if a else "x"
    key = f"{last}{p.get('year','')}"
    return f"@article{{{key},\n  title = {{{p.get('title','')}}},\n  author = {{{' and '.join(a)}}},\n  journal = {{{p.get('venue','')}}},\n  year = {{{p.get('year','')}}},\n  doi = {{{p.get('doi','')}}}\n}}\n"


def _pdf(p):
    if p.get("pdf"):
        return p["pdf"]
    if p.get("source") == "CORE":
        return p.get("url") or ""
    return ""


def _panel_path():
    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg, dict) else {}
    return (node.get("json_path") or "").strip() or os.getenv("PAPERS_PANEL_JSON", "")


def _write_panel(papers, query, links):
    path = _panel_path()
    if not path:
        return
    import time

    data = {
        "query": query,
        "updated": time.time(),
        "links": links,
        "papers": [
            {
                "title": p.get("title", ""),
                "authors": p.get("authors", []),
                "year": p.get("year", ""),
                "venue": p.get("venue", ""),
                "source": p.get("source", ""),
                "citations": p.get("citation_count"),
                "doi": p.get("doi", ""),
                "url": p.get("url", ""),
                "abstract": p.get("abstract", ""),
                "abstract_tr": p.get("abstract_tr", ""),
                "partition_cas": p.get("partition_cas", ""),
                "partition_jcr": p.get("partition_jcr", ""),
                "partition_sjr": p.get("partition_sjr", ""),
                "impact_factor": p.get("impact_factor", ""),
                "volume": p.get("volume", ""),
                "issue": p.get("issue", ""),
                "pages": p.get("pages", ""),
                "publisher": p.get("publisher", ""),
                "oa": bool(p.get("oa")),
                "pdf": _pdf(p),
                "bibtex": _bib(p).strip(),
            }
            for p in papers
        ],
    }
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"[panel] 已写入 {path}（{len(papers)} 条）", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"[panel] 写入失败: {e}", file=sys.stderr)


def _has_cjk(s):
    return any("\u4e00" <= c <= "\u9fff" for c in s)


def _llm_translate(text, target):
    cfg = load_config()
    llm = cfg.get("llm", {}) if isinstance(cfg, dict) else {}
    key = (llm.get("api_key") or "").strip() or os.getenv("LLM_API_KEY", "") or os.getenv("DEEPSEEK_API_KEY", "")
    base = (llm.get("base_url") or "https://api.deepseek.com").rstrip("/")
    model = llm.get("model") or "deepseek-chat"
    if not key:
        return ""
    lang = "简体中文" if target == "zh" else "英文"
    prompt = f"把下面这段文字翻译成{lang}，只输出译文，不要解释、不要加引号：\n\n{text}"
    try:
        s = requests.Session()
        s.trust_env = False
        r = s.post(f"{base}/chat/completions",
                   headers={"Authorization": f"Bearer {key}"},
                   json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2},
                   timeout=60)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:  # noqa: BLE001
        return ""


def _translate_papers(papers):
    from concurrent.futures import ThreadPoolExecutor

    def one(p):
        text = (p.get("abstract") or "").strip()
        if not text:
            return
        target = "en" if _has_cjk(text) else "zh"
        out = _llm_translate(text, target)
        if out:
            p["abstract_tr"] = out

    try:
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(one, papers))
    except Exception:  # noqa: BLE001
        pass


def _norm_journal(name):
    n = (name or "").lower()
    n = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", n)
    return " ".join(n.split())


def _load_partition_csv(csv_path, name_col=None, quartile_col=None):
    table = {}
    path = Path(csv_path) if csv_path else None
    if not path or not path.exists():
        return table
    rows = []
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            with open(path, encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            if rows:
                break
        except Exception:  # noqa: BLE001
            continue
    if not rows:
        return table
    headers = [h for h in rows[0].keys() if h]

    def _pick(cands):
        for h in headers:
            hl = h.lower()
            for c in cands:
                if c in hl:
                    return h
        return None

    nc = name_col or _pick(["期刊", "journal", "title", "name", "刊名", "magazine"])
    qc = quartile_col or _pick(["分区", "quartile", "区"])
    if (not nc or not qc) and len(headers) >= 2:
        nc, qc = headers[0], headers[1]
    if not nc or not qc:
        return table
    for row in rows:
        name = (row.get(nc) or "").strip()
        q = (row.get(qc) or "").strip()
        if name and q:
            table[_norm_journal(name)] = q
    return table


def _data_path(fname):
    return Path(__file__).resolve().parent.parent / "data" / fname


def _load_zh2en():
    mapping = {}
    path = _data_path("zh2en.csv")
    if not path.exists():
        return mapping
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                zh = (row.get("中文刊名") or "").strip()
                en = (row.get("英文刊名") or "").strip()
                if zh and en:
                    mapping[_norm_journal(zh)] = _norm_journal(en)
    except Exception:  # noqa: BLE001
        pass
    return mapping


def _load_if(csv_path, name_col="Journal", if_col="IF"):
    table = {}
    path = Path(csv_path) if csv_path else None
    if not path or not path.exists():
        return table
    rows = []
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            with open(path, encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            if rows:
                break
        except Exception:  # noqa: BLE001
            continue
    for row in rows:
        name = (row.get(name_col) or "").strip()
        v = (row.get(if_col) or "").strip()
        if name and v:
            table[_norm_journal(name)] = v
    return table


def _apply_partition(papers):
    cfg = load_config()
    pc = cfg.get("partition", {}) if isinstance(cfg, dict) else {}
    cas = pc.get("cas") or {}
    jcr = pc.get("jcr") or {}
    sjr = pc.get("sjr") or {}
    # 配置路径为空时，回退到插件自带 data/ 下的 CSV（开箱即用）
    cas_csv = cas.get("csv") or str(_data_path("cas.csv"))
    jcr_csv = jcr.get("csv") or str(_data_path("jcr.csv"))
    sjr_csv = sjr.get("csv") or str(_data_path("sjr.csv"))
    cas_table = _load_partition_csv(cas_csv, cas.get("name_col"), cas.get("quartile_col"))
    jcr_table = _load_partition_csv(jcr_csv, jcr.get("name_col"), jcr.get("quartile_col"))
    sjr_table = _load_partition_csv(sjr_csv, sjr.get("name_col"), sjr.get("quartile_col"))
    jcr_if = _load_if(jcr_csv, jcr.get("name_col") or "Journal", jcr.get("if_col") or "IF")
    if not cas_table and not jcr_table and not sjr_table:
        return
    zh2en = _load_zh2en()
    for p in papers:
        venue = p.get("venue") or ""
        key = _norm_journal(venue)
        if not key:
            continue
        keys = [key]
        if _has_cjk(venue) and key in zh2en:
            keys.append(zh2en[key])
        for k in keys:
            if k in cas_table and not p.get("partition_cas"):
                p["partition_cas"] = cas_table[k]
            if k in jcr_table and not p.get("partition_jcr"):
                p["partition_jcr"] = jcr_table[k]
            if k in sjr_table and not p.get("partition_sjr"):
                p["partition_sjr"] = sjr_table[k]
            if k in jcr_if and not p.get("impact_factor"):
                p["impact_factor"] = jcr_if[k]


def _fetch_doi(doi):
    from urllib.parse import quote as _q

    doi = (doi or "").strip()
    if doi.startswith("http"):
        doi = doi.split("doi.org/")[-1]
    try:
        r = requests.get(f"https://api.crossref.org/works/{_q(doi)}", headers=UA, timeout=25)
        r.raise_for_status()
        it = r.json()["message"]
    except Exception as e:  # noqa: BLE001
        print(f"[warn] DOI 查询失败: {e}", file=sys.stderr)
        return []
    year = ""
    for k in ("published-print", "published-online", "issued"):
        if it.get(k) and it[k].get("date-parts"):
            year = it[k]["date-parts"][0][0]
            break
    return [{
        "title": (it.get("title") or [""])[0],
        "authors": [f"{a.get('given','')} {a.get('family','')}".strip() for a in it.get("author", [])],
        "year": str(year), "venue": (it.get("container-title") or [""])[0],
        "abstract": re.sub(r"<[^>]+>", " ", it.get("abstract") or "").strip(),
        "url": it.get("URL", ""), "doi": it.get("DOI", ""),
        "source": "CrossRef", "citation_count": it.get("is-referenced-by-count"),
        "pdf": "", "oa": False,
    }]


def _apply_filters(papers, a):
    from_year = getattr(a, "from_year", None)
    to_year = getattr(a, "to_year", None)
    if from_year or to_year:
        def _in(p):
            try:
                y = int(p.get("year") or "")
            except Exception:  # noqa: BLE001
                return False
            if from_year and y < from_year:
                return False
            if to_year and y > to_year:
                return False
            return True
        papers[:] = [p for p in papers if _in(p)]
    author = (getattr(a, "author", "") or "").strip().lower()
    if author:
        papers[:] = [p for p in papers if any(author in (au or "").lower() for au in (p.get("authors") or []))]
    journal = (getattr(a, "journal", "") or "").strip().lower()
    if journal:
        papers[:] = [p for p in papers if journal in (p.get("venue") or "").lower()]


def _apply_sort(papers, sort):
    if sort == "year":
        papers.sort(key=lambda p: int(p["year"]) if str(p.get("year", "")).isdigit() else 0, reverse=True)
    elif sort == "citations":
        papers.sort(key=lambda p: (p["citation_count"] is None, -(p["citation_count"] or 0)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="?", default="")
    ap.add_argument("--sources", default="arxiv,openalex,crossref,semantic_scholar,pubmed,dblp,scholar")
    ap.add_argument("--max", type=int, default=10)
    ap.add_argument("--format", default="text", choices=["text", "bibtex", "ris", "csv", "json"])
    ap.add_argument("--translate", action="store_true", default=None, help="用 LLM 翻译摘要（默认读 config 的 search.translate）")
    ap.add_argument("--bilingual", action="store_true", default=None, help="自动加中/英对照关键词检索（默认读 config 的 search.bilingual）")
    ap.add_argument("--from-year", type=int, default=None, help="最早年份")
    ap.add_argument("--to-year", type=int, default=None, help="最晚年份")
    ap.add_argument("--sort", default="citations", choices=["citations", "year", "relevance"], help="排序：citations/year/relevance")
    ap.add_argument("--author", default="", help="按作者名筛选")
    ap.add_argument("--journal", default="", help="按期刊名筛选")
    ap.add_argument("--doi", default="", help="按 DOI 精确检索单篇论文")
    ap.add_argument("--related", default="", help="按 DOI 检索相似/相关论文（Semantic Scholar 推荐）")
    a = ap.parse_args()

    panel_query = a.query
    if a.doi:
        papers = _fetch_doi(a.doi)
        panel_query = a.doi
    elif a.related:
        papers = search_related(a.related, a.max)
        panel_query = f"相关论文 (DOI: {a.related})"
    else:
        bilingual = a.bilingual
        if bilingual is None:
            cfg0 = load_config()
            sc0 = cfg0.get("search", {}) if isinstance(cfg0, dict) else {}
            bilingual = bool(sc0.get("bilingual"))

        variants = [a.query]
        if bilingual:
            tgt = "en" if _has_cjk(a.query) else "zh"
            tr = _llm_translate(a.query, tgt)
            if tr and tr.lower() != a.query.lower():
                variants.append(tr)
                print(f"[bilingual] 增加对照检索词: {tr}", file=sys.stderr)

        papers, seen_doi, seen_title = [], set(), set()
        for qv in variants:
            for s in a.sources.split(","):
                if s not in SOURCES:
                    continue
                try:
                    for p in SOURCES[s](qv, a.max):
                        dk = (p.get("doi") or "").lower().strip()
                        tk = _norm_title(p.get("title"))
                        if dk and dk in seen_doi:
                            continue
                        if tk and tk in seen_title:
                            continue
                        if dk:
                            seen_doi.add(dk)
                        if tk:
                            seen_title.add(tk)
                        p.setdefault("oa", False)
                        papers.append(p)
                except Exception as e:  # noqa: BLE001
                    print(f"[warn] {s} 检索失败: {e}", file=sys.stderr)

    _apply_filters(papers, a)
    _apply_sort(papers, a.sort)

    translate = a.translate
    if translate is None:
        cfg = load_config()
        sc = cfg.get("search", {}) if isinstance(cfg, dict) else {}
        translate = bool(sc.get("translate"))
    if translate:
        print("[translate] 正在翻译摘要…", file=sys.stderr)
        _translate_papers(papers)

    _apply_partition(papers)

    from urllib.parse import quote

    q = quote(a.query)
    links = {
        "cnki": f"https://kns.cnki.net/kns8s/defaultresult/index?kw={q}",
    }

    # 辅助搜索链接（知网 / 谷歌学术 / 镜像），text 模式额外输出
    if a.format == "text":
        print("=== 辅助搜索链接（无公开 API 的源，点击跳转）===")
        print(f"  知网 CNKI: {links['cnki']}")
        print()

    # 写入右侧面板 JSON（若在 config.json 中配置了 panel.json_path）
    _write_panel(papers, panel_query, links)

    if a.format == "json":
        print(json.dumps(papers, ensure_ascii=False, indent=2))
    elif a.format == "bibtex":
        print("".join(_bib(p) for p in papers))
    elif a.format == "ris":
        for p in papers:
            print("TY  - JOUR\nTI  - " + p["title"])
            for au in p["authors"]:
                print("AU  - " + au)
            if p["year"]:
                print("PY  - " + p["year"])
            if p["doi"]:
                print("DO  - " + p["doi"])
            print("ER  - \n")
    elif a.format == "csv":
        w = csv.writer(sys.stdout)
        w.writerow(["title", "authors", "year", "venue", "doi", "citation_count", "source"])
        for p in papers:
            w.writerow([p["title"], "; ".join(p["authors"]), p["year"], p["venue"], p["doi"], p["citation_count"], p["source"]])
    else:
        for i, p in enumerate(papers):
            print(f"{i+1}. {p['title']}")
            tags = []
            if p.get("partition_cas"):
                tags.append(f"中科院{p['partition_cas']}")
            if p.get("partition_jcr"):
                jcr_tag = f"JCR {p['partition_jcr']}"
                if p.get("impact_factor"):
                    jcr_tag += f"/IF {p['impact_factor']}"
                tags.append(jcr_tag)
            if p.get("partition_sjr"):
                tags.append(f"SJR {p['partition_sjr']}")
            oa_tag = "免费PDF" if p.get("oa") else "付费"
            meta = f"{', '.join(p['authors'][:4])} | {p['year']} | {p['source']} | {oa_tag}"
            if tags:
                meta += " | " + " ".join(tags)
            print(f"   {meta} | 被引{p['citation_count']}")
            if p["doi"]:
                print(f"   https://doi.org/{p['doi']}")
            elif p.get("url"):
                print(f"   {p['url']}")
            if p["abstract"]:
                print(f"   {(p['abstract'] or '')[:150]}")


if __name__ == "__main__":
    main()
