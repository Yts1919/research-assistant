/* 文献检索右侧面板（DSH Web 注入脚本）
 * 由 research-assistant 插件的 tools/search.py 写入 papers-panel.json，
 * 本脚本轮询 /papers-panel.json 并在页面右侧渲染论文卡片。
 * 纯原生 JS，无依赖；仅新增一个固定定位面板，不触碰 React DOM。
 * 功能：摘要展开 / 翻译切换 / PDF·BibTeX·RIS 下载 / 导入 EndNote·Zotero / 无法下载弹窗说明。
 */
(function () {
  "use strict";
  if (window.__papersPanelInjected) return;
  window.__papersPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { query: "", links: {}, papers: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CSS =
    ":root{--pp-w:360px}" +
    "body.pp-dock{margin-right:var(--pp-w);transition:margin-right .22s ease}" +
    "body.pp-dock #pp-toggle{display:none}" +
    "#pp-toggle{position:fixed;top:8px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#4f6ef7;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#pp-toggle .n{display:inline-block;min-width:18px;margin-left:4px;background:rgba(0,0,0,.28);border-radius:9px;padding:1px 6px;font-size:11px}" +
    "#pp-collapse{position:fixed;right:var(--pp-w,360px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#4f6ef7;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-dock #pp-collapse{display:block}" +
    "#pp-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-w,360px);max-width:92vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-panel.open{transform:translateX(0)}" +
    "#pp-head{padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#pp-head h2{margin:0 0 4px;font-size:15px}" +
    "#pp-head .q{font-size:12px;color:#57606a;word-break:break-all}" +
    "#pp-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    "#pp-links a{font-size:11px;color:#4f6ef7;text-decoration:none;border:1px solid #d7dbfe;padding:2px 8px;border-radius:12px;background:#eef1ff}" +
    "#pp-history{margin-top:8px;width:100%;box-sizing:border-box;font-size:11px;border:1px solid #d0d7de;border-radius:6px;padding:4px 6px;color:#57606a;background:#fff}" +
    "#pp-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:100000;background:rgba(15,23,42,.92);color:#fff;" +
    "padding:10px 18px;border-radius:10px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .25s;max-width:80vw;word-break:break-all}" +
    "#pp-toast.show{opacity:1}" +
    "#pp-close{float:right;border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#pp-list{flex:1;overflow-y:auto;padding:10px 12px}" +
    ".pp-card{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:10px;background:#fff}" +
    ".pp-card h3{margin:0 0 6px;font-size:13.5px;line-height:1.35}" +
    ".pp-card h3 a{color:#0b57d0;text-decoration:none}" +
    ".pp-card h3 a:hover{text-decoration:underline}" +
    ".pp-meta{font-size:11.5px;color:#57606a;margin-bottom:6px}" +
    ".pp-badges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}" +
    ".pp-badge{display:inline-block;font-size:10px;border-radius:4px;padding:1px 5px;vertical-align:middle;line-height:1.5}" +
    ".pp-src{color:#4f6ef7;background:#eef1ff}" +
    ".pp-part{color:#b45309;background:#fef3c7}" +
    ".pp-jcr{color:#15803d;background:#dcfce7}" +
    ".pp-sjr{color:#6b7280;background:#f3f4f6}" +
    ".pp-oa{color:#15803d;background:#dcfce7}" +
    ".pp-pay{color:#b91c1c;background:#fee2e2}" +
    ".pp-filters{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    ".pp-filters select{flex:1;min-width:0;font-size:11px;padding:4px 6px;border:1px solid #d0d7de;border-radius:6px;background:#fff;color:#24292f}" +
    ".pp-abs{display:none;font-size:12px;color:#24292f;background:#f6f8fa;border-radius:6px;padding:8px;margin:6px 0;max-height:320px;overflow-y:auto;white-space:pre-wrap}" +
    ".pp-abs.show{display:block}" +
    ".pp-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}" +
    ".pp-btns button{font-size:11px;border:1px solid #d0d7de;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;color:#24292f}" +
    ".pp-btns button:hover{background:#f0f3f6}" +
    ".pp-btns button.pp-dl{background:#4f6ef7;color:#fff;border-color:#4f6ef7}" +
    ".pp-btns button.pp-dl:hover{background:#3f5ce0}" +
    ".pp-btns a{font-size:11px;border:1px solid #d0d7de;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;color:#24292f;text-decoration:none}" +
    ".pp-btns a:hover{background:#f0f3f6}" +
    ".pp-dlmenu{display:none;margin-top:6px;border:1px solid #d0d7de;border-radius:8px;background:#fff;overflow:hidden}" +
    ".pp-dlmenu.show{display:block}" +
    ".pp-dlmenu button{display:block;width:100%;text-align:left;font-size:11.5px;padding:7px 10px;border:0;border-bottom:1px solid #eee;background:#fff;cursor:pointer;color:#24292f}" +
    ".pp-dlmenu button:last-child{border-bottom:0}" +
    ".pp-dlmenu button:hover{background:#f0f3f6}" +
    ".pp-empty{padding:30px 16px;text-align:center;color:#8b949e;font-size:13px}" +
    ".pp-modal-ov{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}" +
    ".pp-modal{width:min(430px,92vw);background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.3);overflow:hidden}" +
    ".pp-modal-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eee;font-size:14px}" +
    ".pp-modal-x{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    ".pp-modal-body{padding:14px;font-size:13px;line-height:1.65;color:#24292f}" +
    ".pp-modal-body a{color:#0b57d0}" +
    "@media (prefers-color-scheme: dark){#pp-panel{background:#161b22;color:#e6edf3}#pp-head{background:#1c2128;border-color:#30363d}" +
    "#pp-head .q{color:#8b949e}#pp-links a{color:#79c0ff;background:#161b22;border-color:#30363d}#pp-history{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#pp-close{color:#8b949e}.pp-card{background:#161b22;border-color:#30363d}" +
    ".pp-card h3 a{color:#58a6ff}.pp-meta{color:#8b949e}.pp-src{color:#79c0ff;background:#161b22}.pp-part{color:#fbbf24;background:#3a2a0a}" +
    ".pp-jcr{color:#4ade80;background:#0f2b1d}.pp-sjr{color:#9ca3af;background:#1f2937}" +
    ".pp-oa{color:#4ade80;background:#0f2b1d}.pp-pay{color:#f87171;background:#3a1515}.pp-filters{background:#1c2128;border-color:#30363d}.pp-filters select{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    ".pp-abs{color:#e6edf3;background:#0d1117}.pp-btns button,.pp-btns a{color:#e6edf3;background:#161b22;border-color:#30363d}" +
    ".pp-btns button:hover,.pp-btns a:hover{background:#21262d}.pp-btns button.pp-dl{background:#4f6ef7;color:#fff;border-color:#4f6ef7}" +
    ".pp-btns button.pp-dl:hover{background:#3f5ce0}" +
    ".pp-dlmenu{background:#161b22;border-color:#30363d}.pp-dlmenu button{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    ".pp-dlmenu button:hover{background:#21262d}.pp-empty{color:#8b949e}" +
    ".pp-modal{background:#161b22;color:#e6edf3}.pp-modal-head{border-color:#30363d}.pp-modal-x{color:#8b949e}.pp-modal-body{color:#e6edf3}.pp-modal-body a{color:#58a6ff}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "文献检索结果面板";
  toggle.innerHTML = '论文<span class="n" id="pp-count" style="display:none">0</span>';

  var panel = document.createElement("aside");
  panel.id = "pp-panel";
  panel.innerHTML =
    '<div id="pp-head"><button id="pp-close" type="button" title="收起">&times;</button>' +
    '<h2>文献检索结果</h2><div class="q" id="pp-query"></div>' +
    '<div id="pp-links"></div>' +
    '<select id="pp-history"><option value="">检索记录…</option></select></div>' +
    '<div id="pp-filters"></div>' +
    '<div id="pp-list"></div>';

  var collapse = document.createElement("button");
  collapse.id = "pp-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起论文检索面板";
  collapse.textContent = "收起";

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-dock", open);
    if (open) window.__dshPanels.closeAll("pp-dock", "pp-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("pp-close").addEventListener("click", function () { setOpen(false); });

  function setCount(n) {
    var c = document.getElementById("pp-count");
    if (n > 0) { c.style.display = "inline-block"; c.textContent = String(n); }
    else { c.style.display = "none"; }
  }

  function cardHtml(p, i) {
    var title = esc(p.title || "(无标题)");
    var link = p.url || (p.doi ? "https://doi.org/" + p.doi : "");
    var h = link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + title + "</a>" : title;
    var meta = "";
    if (p.authors && p.authors.length) meta += p.authors.slice(0, 4).join(", ");
    if (p.year) meta += " · " + esc(p.year);
    if (p.venue) meta += " · " + esc(p.venue);
    if (p.citation_count != null) meta += " · 被引 " + p.citation_count;

    var badges = [];
    badges.push('<span class="pp-badge pp-src">' + esc(p.source || "") + "</span>");
    paperPartTags(p).forEach(function (t) {
      var cls = /中科院/.test(t) ? "pp-part" : (/JCR/.test(t) ? "pp-jcr" : "pp-sjr");
      var label = t;
      if (/JCR/.test(t) && p.impact_factor) label = t + " · IF " + p.impact_factor;
      badges.push('<span class="pp-badge ' + cls + '">' + esc(label) + "</span>");
    });
    badges.push('<span class="pp-badge ' + (p.oa ? "pp-oa" : "pp-pay") + '">' + (p.oa ? "免费PDF" : "付费") + "</span>");
    var badgesHtml = badges.join("");

    var isScholar = /Google/.test(p.source || "");
    var abs = p.abstract ? '<div class="pp-abs" id="pp-abs-' + i + '">' + esc(p.abstract) + "</div>" : "";
    var btns = '<div class="pp-btns">';
    if (p.abstract) btns += '<button type="button" data-act="abs" data-i="' + i + '">' + (isScholar ? "摘要(片段)" : "摘要") + '</button>';
    if (p.abstract) btns += '<button type="button" data-act="tr" data-i="' + i + '">翻译</button>';
    if (p.pdf) btns += '<a href="' + esc(p.pdf) + '" target="_blank" rel="noopener">PDF</a>';
    if (link) btns += '<a href="' + esc(link) + '" target="_blank" rel="noopener">链接</a>';
    btns += '<button type="button" class="pp-dl" data-act="dl" data-i="' + i + '">下载</button>';
    btns += "</div>";

    var dlmenu = '<div class="pp-dlmenu" id="pp-dlmenu-' + i + '">' +
      '<button type="button" data-dl="pdf" data-i="' + i + '">PDF 全文</button>' +
      '<button type="button" data-dl="bib" data-i="' + i + '">BibTeX (.bib)</button>' +
      '<button type="button" data-dl="ris" data-i="' + i + '">RIS (.ris) · 导入 EndNote / Zotero</button>' +
      "</div>";

    return '<div class="pp-card"><h3>' + h + "</h3><div class='pp-meta'>" + meta + "</div>" +
      '<div class="pp-badges">' + badgesHtml + "</div>" + abs + btns + dlmenu + "</div>";
  }

  var filter = { source: "", year: "", part: "" };

  function paperPartTags(p) {
    var t = [];
    if (p.partition_cas) t.push("中科院" + p.partition_cas);
    if (p.partition_jcr) t.push("JCR " + p.partition_jcr);
    if (p.partition_sjr) t.push("SJR " + p.partition_sjr);
    return t;
  }

  function buildFilters() {
    var srcs = [""], seenS = {};
    var parts = [""], seenP = {};
    state.papers.forEach(function (p) {
      if (p.source && !seenS[p.source]) { seenS[p.source] = 1; srcs.push(p.source); }
      paperPartTags(p).forEach(function (t) { if (!seenP[t]) { seenP[t] = 1; parts.push(t); } });
    });
    var fb = document.getElementById("pp-filters");
    if (!fb) return;
    fb.innerHTML =
      '<select id="pp-f-src">' + srcs.map(function (s) { return '<option value="' + esc(s) + '"' + (s === filter.source ? " selected" : "") + ">" + (s || "来源:全部") + "</option>"; }).join("") + "</select>" +
      '<select id="pp-f-year"><option value=""' + (filter.year === "" ? " selected" : "") + '>年份:全部</option><option value="5y"' + (filter.year === "5y" ? " selected" : "") + '>近5年</option><option value="10y"' + (filter.year === "10y" ? " selected" : "") + ">近10年</option></select>" +
      '<select id="pp-f-part">' + parts.map(function (s) { return '<option value="' + esc(s) + '"' + (s === filter.part ? " selected" : "") + ">" + (s || "分区:全部") + "</option>"; }).join("") + "</select>";
    document.getElementById("pp-f-src").addEventListener("change", function (e) { filter.source = e.target.value; renderList(); });
    document.getElementById("pp-f-year").addEventListener("change", function (e) { filter.year = e.target.value; renderList(); });
    document.getElementById("pp-f-part").addEventListener("change", function (e) { filter.part = e.target.value; renderList(); });
  }

  function filteredPapers() {
    var now = new Date().getFullYear();
    return state.papers.filter(function (p) {
      if (filter.source && p.source !== filter.source) return false;
      var y = parseInt(p.year || "0");
      if (filter.year === "5y" && y < now - 5) return false;
      if (filter.year === "10y" && y < now - 10) return false;
      if (filter.part && paperPartTags(p).indexOf(filter.part) < 0) return false;
      return true;
    });
  }

  function renderList() {
    var list = document.getElementById("pp-list");
    var papers = filteredPapers();
    if (!papers.length) {
      list.innerHTML = '<div class="pp-empty">无匹配结果（可调整筛选）。</div>';
    } else {
      list.innerHTML = papers.map(function (p) { return cardHtml(p, state.papers.indexOf(p)); }).join("");
    }
    setCount(papers.length);
  }

  function render() {
    document.getElementById("pp-query").textContent = state.query ? "检索词：" + state.query : "";
    var linksHtml = "";
    if (state.links.cnki) linksHtml += '<a href="' + esc(state.links.cnki) + '" target="_blank" rel="noopener">知网</a>';
    document.getElementById("pp-links").innerHTML = linksHtml;
    buildFilters();
    renderHistory();
    renderList();
  }

  function bindList() {
    document.getElementById("pp-list").addEventListener("click", function (ev) {
      var dlItem = ev.target.closest("[data-dl]");
      if (dlItem) {
        var pi = Number(dlItem.getAttribute("data-i"));
        var pp = state.papers[pi];
        if (pp) doDl(pp, dlItem.getAttribute("data-dl"));
        return;
      }
      var b = ev.target.closest("[data-act]");
      if (!b) return;
      var i = Number(b.getAttribute("data-i"));
      var p = state.papers[i];
      if (!p) return;
      var act = b.getAttribute("data-act");
      if (act === "abs") {
        var el = document.getElementById("pp-abs-" + i);
        if (el) el.classList.toggle("show");
      } else if (act === "tr") {
        toggleTr(i, b);
      } else if (act === "dl") {
        toggleDlMenu(i);
      }
    });
  }

  function toggleDlMenu(i) {
    var menu = document.getElementById("pp-dlmenu-" + i);
    if (!menu) return;
    var willShow = !menu.classList.contains("show");
    document.querySelectorAll(".pp-dlmenu.show").forEach(function (m) { m.classList.remove("show"); });
    if (willShow) menu.classList.add("show");
  }

  function safeName(s) {
    return String(s || "paper").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  }

  function makeRis(p) {
    var lines = ["TY  - JOUR", "TI  - " + (p.title || "")];
    (p.authors || []).forEach(function (a) { lines.push("AU  - " + a); });
    if (p.year) lines.push("PY  - " + p.year);
    if (p.doi) lines.push("DO  - " + p.doi);
    if (p.url) lines.push("UR  - " + p.url);
    lines.push("ER  - ");
    return lines.join("\r\n") + "\r\n";
  }

  function makeBib(p) {
    var a = p.authors || [];
    var key = (a[0] ? a[0].split(" ").slice(-1)[0] : "x") + (p.year || "");
    return "@article{" + key + ",\n  title = {" + (p.title || "") + "},\n  author = {" + a.join(" and ") + "},\n  journal = {" + (p.venue || "") + "},\n  year = {" + (p.year || "") + "},\n  doi = {" + (p.doi || "") + "}\n}\n";
  }

  function downloadText(content, filename, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function showModal(title, html) {
    var ov = document.createElement("div");
    ov.className = "pp-modal-ov";
    ov.innerHTML = '<div class="pp-modal"><div class="pp-modal-head"><b>' + esc(title) + '</b><button class="pp-modal-x" type="button">&times;</button></div><div class="pp-modal-body">' + html + "</div></div>";
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.classList.contains("pp-modal-x")) ov.remove();
    });
    document.body.appendChild(ov);
  }

  function doDl(p, kind) {
    if (kind === "pdf") {
      if (p.pdf) {
        window.open(p.pdf, "_blank");
      } else {
        showModal("无法直接下载 PDF",
          "该论文没有开放获取的 PDF 直链，可能为付费订阅或需机构访问。<br><br>" +
          "可选做法：<br>① 点卡片上的「链接」跳转到出版社/期刊页获取；<br>② 用「RIS / BibTeX」先把引用保存下来，再通过学校图书馆或文献互助获取全文；<br>③ 到谷歌学术镜像查看是否有其它可下载版本。");
      }
    } else if (kind === "bib") {
      downloadText(p.bibtex || makeBib(p), safeName(p.title) + ".bib", "application/x-bibtex;charset=utf-8");
    } else if (kind === "ris") {
      downloadText(makeRis(p), safeName(p.title) + ".ris", "application/x-research-info-systems;charset=utf-8");
    }
  }

  function copyText(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "已复制"; setTimeout(function () { btn.textContent = o; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function toggleTr(i, btn) {
    var p = state.papers[i];
    var el = document.getElementById("pp-abs-" + i);
    if (!el) return;
    var tr = p.abstract_tr;
    if (!tr) {
      el.textContent = "未翻译：本次检索未启用翻译（配置 search.translate=true 或加 --translate）。";
      el.classList.remove("tr");
      el.classList.add("show");
      return;
    }
    if (el.classList.contains("tr")) {
      el.textContent = p.abstract;
      el.classList.remove("tr");
      btn.textContent = "翻译";
    } else {
      el.textContent = "【译文】\n" + tr;
      el.classList.add("tr");
      btn.textContent = "原文";
    }
    el.classList.add("show");
  }

  // ---------- 检索记录 ----------
  var HIST_KEY = "dsh-search-history";
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
  }
  function pushHistory(q, n) {
    if (!q) return;
    var list = loadHistory().filter(function (h) { return h.q !== q; });
    list.unshift({ q: q, n: n, t: Date.now() });
    saveHistory(list);
    renderHistory();
  }
  function renderHistory() {
    var sel = document.getElementById("pp-history");
    if (!sel) return;
    var list = loadHistory();
    sel.innerHTML = '<option value="">检索记录…</option>' + list.map(function (h, i) {
      var when = "";
      if (h.t) { var d = new Date(h.t); when = " · " + (d.getMonth() + 1) + "/" + d.getDate(); }
      var label = h.q + (h.n ? "（" + h.n + " 篇）" : "") + when;
      return '<option value="' + i + '">' + esc(label.slice(0, 40)) + "</option>";
    }).join("");
  }
  function bindHistory() {
    document.getElementById("pp-history").addEventListener("change", function (e) {
      var list = loadHistory();
      var h = list[Number(e.target.value)];
      if (h) copyToAgent("请重新检索「" + h.q + "」");
      e.target.value = "";
    });
  }
  var toastEl = null, toastTimer = null;
  function ppToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "pp-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }
  function copyToAgent(text) {
    var done = function () { ppToast("已复制，粘贴到对话里发给我即可"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }

  async function fetchPapers() {
    try {
      var r = await fetch("/papers-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      var prevQuery = state.query;
      state.query = data.query || "";
      state.links = data.links || {};
      state.papers = data.papers || [];
      render();
      setOpen(true);
      if (state.query && state.query !== prevQuery) pushHistory(state.query, state.papers.length);
    } catch (e) { /* 面板文件尚未生成，静默 */ }
  }

  bindList();
  bindHistory();
  renderHistory();
  fetchPapers();
  setInterval(fetchPapers, POLL_MS);
})();
