/* 论文精读右侧面板（DSH Web 注入脚本）
 * 由 research-assistant 插件的 tools/paper.py 写入 paper-panel.json，
 * 本脚本轮询 /paper-panel.json 并在右侧渲染「精读卡片」。
 * 与 papers-panel.js（检索结果面板）互斥：打开其一自动收起另一个。
 */
(function () {
  "use strict";
  if (window.__paperPanelInjected) return;
  window.__paperPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { title: "", authors: "", venue: "", year: "", doi: "", url: "", sections: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CSS =
    ":root{--pp-rw:680px}" +
    "body.pp-readdock{margin-right:var(--pp-rw);transition:margin-right .22s ease}" +
    "body.pp-readdock #pp-read-toggle{display:none}" +
    "#pp-read-toggle{position:fixed;top:48px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#0d9488;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#ppr-collapse{position:fixed;right:var(--pp-rw,680px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#0d9488;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-readdock #ppr-collapse{display:block}" +
    "#pp-read-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-rw,680px);max-width:94vw;z-index:99985;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-read-panel.open{transform:translateX(0)}" +
    "#ppr-head{padding:14px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#ppr-close{float:right;border:0;background:none;font-size:22px;cursor:pointer;color:#57606a;line-height:1}" +
    "#ppr-head h2{margin:0 0 6px;font-size:17px;line-height:1.4}" +
    "#ppr-meta{font-size:12px;color:#57606a;line-height:1.6}" +
    "#ppr-meta a{color:#0b57d0;text-decoration:none}" +
    "#ppr-add{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#ppr-add select,#ppr-add input,#ppr-add textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#ppr-add textarea{min-height:56px;resize:vertical;line-height:1.5}" +
    "#ppr-run{width:100%;border:1px solid #0d9488;background:#f0fdfa;color:#0f766e;border-radius:6px;padding:7px;cursor:pointer;font-size:13px}" +
    "#ppr-run:hover{background:#ccfbf1}" +
    "#ppr-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:100000;background:rgba(15,23,42,.92);color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .25s;max-width:80vw;word-break:break-all}" +
    "#ppr-toast.show{opacity:1}" +
    "#ppr-body{flex:1;overflow-y:auto;padding:16px 18px}" +
    ".ppr-sec{margin-bottom:18px}" +
    ".ppr-sec h3{margin:0 0 6px;font-size:14px;color:#0d9488;border-left:3px solid #0d9488;padding-left:8px}" +
    ".ppr-sec .b{font-size:13.5px;line-height:1.7;color:#24292f;white-space:pre-wrap;word-break:break-word}" +
    ".ppr-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-read-panel{background:#161b22;color:#e6edf3}#ppr-head{background:#1c2128;border-color:#30363d}" +
    "#ppr-meta{color:#8b949e}#ppr-meta a{color:#58a6ff}#ppr-close{color:#8b949e}" +
    "#ppr-add{background:#1c2128;border-color:#30363d}#ppr-add select,#ppr-add input,#ppr-add textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#ppr-run{color:#5eead4;border-color:#0d9488;background:#042f2e}#ppr-run:hover{background:#134e4a}" +
    ".ppr-sec h3{color:#2dd4bf}.ppr-sec .b{color:#e6edf3}.ppr-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-read-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "论文精读面板";
  toggle.textContent = "精读";

  var panel = document.createElement("aside");
  panel.id = "pp-read-panel";
  panel.innerHTML =
    '<div id="ppr-head"><button id="ppr-close" type="button" title="收起">&times;</button>' +
    '<h2 id="ppr-title"></h2><div id="ppr-meta"></div></div>' +
    '<div id="ppr-add">' +
    '<select id="ppr-mode"><option value="doi">方式：DOI 输入</option><option value="folder">方式：文件/文件夹</option></select>' +
    '<input id="ppr-doi" placeholder="输入论文 DOI" />' +
    '<textarea id="ppr-path" placeholder="PDF 路径或文件夹，可多个，每行一个（文件夹里只放论文 PDF）" style="display:none"></textarea>' +
    '<button id="ppr-run" type="button">精读（复制给 AI）</button>' +
    "</div>" +
    '<div id="ppr-body"><div class="ppr-empty">暂无精读内容。输入 DOI 或 PDF 路径 → 点「精读」→ 粘贴给我 → 精读卡片展示在这里。</div></div>';

  var collapse = document.createElement("button");
  collapse.id = "ppr-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起精读面板";
  collapse.textContent = "收起";

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-readdock", open);
    if (open) window.__dshPanels.closeAll("pp-readdock", "pp-read-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("ppr-close").addEventListener("click", function () { setOpen(false); });

  // ---------- 添加论文（DOI / 文件·文件夹）----------
  function updateAddMode() {
    var m = document.getElementById("ppr-mode").value;
    document.getElementById("ppr-doi").style.display = m === "folder" ? "none" : "block";
    document.getElementById("ppr-path").style.display = m === "folder" ? "block" : "none";
  }
  document.getElementById("ppr-mode").addEventListener("change", updateAddMode);
  updateAddMode();

  document.getElementById("ppr-run").addEventListener("click", function () {
    var m = document.getElementById("ppr-mode").value;
    if (m === "folder") {
      copyToAgent("请精读以下路径/文件夹里的 PDF 并写入精读面板（可多个，每行一个；文件夹里只放论文 PDF）：\n" + document.getElementById("ppr-path").value.trim());
    } else {
      copyToAgent("请精读这篇论文并写入精读面板：\n【DOI】" + document.getElementById("ppr-doi").value.trim());
    }
  });

  var toastEl = null, toastTimer = null;
  function ppToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "ppr-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function copyToAgent(text) {
    var done = function () { ppToast("已复制，粘贴到对话里发给我即可"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }

  function render() {
    document.getElementById("ppr-title").textContent = state.title || "（无标题）";
    var meta = [];
    if (state.authors) meta.push(state.authors);
    if (state.year) meta.push(state.year);
    if (state.venue) meta.push(state.venue);
    var m = meta.join(" · ");
    if (state.doi) m += ' · <a href="https://doi.org/' + esc(state.doi) + '" target="_blank" rel="noopener">' + esc(state.doi) + "</a>";
    else if (state.url) m += ' · <a href="' + esc(state.url) + '" target="_blank" rel="noopener">原文</a>';
    document.getElementById("ppr-meta").innerHTML = m;

    var body = document.getElementById("ppr-body");
    if (!state.sections || !state.sections.length) {
      body.innerHTML = '<div class="ppr-empty">暂无精读内容。</div>';
      return;
    }
    body.innerHTML = state.sections.map(function (s) {
      return '<div class="ppr-sec"><h3>' + esc(s.heading || "") + "</h3><div class='b'>" + esc(s.body || "") + "</div></div>";
    }).join("");
  }

  async function fetchCard() {
    try {
      var r = await fetch("/paper-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.title = data.title || "";
      state.authors = data.authors || "";
      state.venue = data.venue || "";
      state.year = data.year || "";
      state.doi = data.doi || "";
      state.url = data.url || "";
      state.sections = data.sections || [];
      render();
      setOpen(true);
    } catch (e) { /* 卡片文件尚未生成，静默 */ }
  }

  fetchCard();
  setInterval(fetchCard, POLL_MS);
})();
