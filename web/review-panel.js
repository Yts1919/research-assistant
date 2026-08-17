/* 文献综述右侧面板（DSH Web 注入脚本）
 * 由 research-assistant 插件写入 review-panel.json，
 * 本脚本轮询 /review-panel.json 并在右侧渲染「综述」内容。
 * 与 papers-panel.js（检索）、paper-panel.js（精读）互斥。
 */
(function () {
  "use strict";
  if (window.__reviewPanelInjected) return;
  window.__reviewPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { title: "", sections: [], references: [], table: null };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CSS =
    ":root{--pp-rvw:720px}" +
    "body.pp-reviewdock{margin-right:var(--pp-rvw);transition:margin-right .22s ease}" +
    "body.pp-reviewdock #pp-review-toggle{display:none}" +
    "#pp-review-toggle{position:fixed;top:88px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#7c3aed;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#pprv-collapse{position:fixed;right:var(--pp-rvw,720px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#7c3aed;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-reviewdock #pprv-collapse{display:block}" +
    "#pp-review-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-rvw,720px);max-width:94vw;z-index:99984;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-review-panel.open{transform:translateX(0)}" +
    "#pprv-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#pprv-head h2{margin:0 0 10px;font-size:16px;line-height:1.5;word-break:break-word}" +
    "#pprv-actions{position:relative;display:flex;justify-content:space-between;align-items:center;gap:8px}" +
    "#pprv-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#pprv-export{border:1px solid #7c3aed;background:#fff;color:#7c3aed;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px}" +
    "#pprv-export:hover{background:#f5f3ff}" +
    "#pprv-export-menu{position:absolute;left:0;top:34px;border:1px solid #d0d7de;border-radius:8px;background:#fff;display:none;overflow:hidden;z-index:99987;box-shadow:0 4px 12px rgba(0,0,0,.15)}" +
    "#pprv-export-menu.show{display:block}" +
    "#pprv-export-menu button{display:block;width:100%;text-align:left;font-size:12px;padding:7px 14px;border:0;border-bottom:1px solid #eee;background:#fff;cursor:pointer;color:#24292f}" +
    "#pprv-export-menu button:last-child{border-bottom:0}" +
    "#pprv-export-menu button:hover{background:#f0f3f6}" +
    "#pprv-body{flex:1;overflow-y:auto;padding:16px 18px}" +
    ".pprv-sec{margin-bottom:18px}" +
    ".pprv-sec h3{margin:0 0 6px;font-size:14px;color:#7c3aed;border-left:3px solid #7c3aed;padding-left:8px}" +
    ".pprv-sec .b{font-size:13.5px;line-height:1.7;color:#24292f;white-space:pre-wrap;word-break:break-word}" +
    ".pprv-refs{margin-top:8px;border-top:1px solid #e5e7eb;padding-top:12px}" +
    ".pprv-refs h3{margin:0 0 8px;font-size:14px;color:#57606a}" +
    ".pprv-refs .r{font-size:12px;line-height:1.6;color:#57606a;margin-bottom:4px}" +
    ".pprv-table-wrap{overflow-x:auto;margin:8px 0}" +
    ".pprv-table{border-collapse:collapse;width:100%;font-size:12px}" +
    ".pprv-table th,.pprv-table td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top}" +
    ".pprv-table th{background:#f6f8fa;font-weight:600;white-space:nowrap}" +
    ".pprv-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-review-panel{background:#161b22;color:#e6edf3}#pprv-head{background:#1c2128;border-color:#30363d}" +
    "#pprv-close{color:#8b949e}#pprv-export{color:#a78bfa;border-color:#7c3aed;background:#161b22}#pprv-export:hover{background:#1c2128}" +
    "#pprv-export-menu{background:#161b22;border-color:#30363d}#pprv-export-menu button{background:#161b22;color:#e6edf3;border-color:#30363d}#pprv-export-menu button:hover{background:#21262d}" +
    ".pprv-sec h3{color:#a78bfa}.pprv-sec .b{color:#e6edf3}" +
    ".pprv-refs{border-color:#30363d}.pprv-refs h3{color:#8b949e}.pprv-refs .r{color:#8b949e}.pprv-empty{color:#8b949e}" +
    ".pprv-table th,.pprv-table td{border-color:#30363d}.pprv-table th{background:#1c2128}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-review-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "文献综述面板";
  toggle.textContent = "综述";

  var collapse = document.createElement("button");
  collapse.id = "pprv-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起综述面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-review-panel";
  panel.innerHTML =
    '<div id="pprv-head"><h2 id="pprv-title"></h2>' +
    '<div id="pprv-actions">' +
    '<button id="pprv-export" type="button">导出</button>' +
    '<button id="pprv-close" type="button" title="收起">&times;</button>' +
    '<div id="pprv-export-menu">' +
    '<button type="button" data-export="md">Markdown (.md)</button>' +
    '<button type="button" data-export="docx">Word (.docx)</button>' +
    '<button type="button" data-export="latex">LaTeX (.tex)</button>' +
    '</div></div></div>' +
    '<div id="pprv-body"><div class="pprv-empty">暂无综述内容。说「写一篇关于 XX 的文献综述」即可。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function closeOthers() {
    window.__dshPanels.closeAll("pp-reviewdock", "pp-review-panel");
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-reviewdock", open);
    if (open) closeOthers();
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("pprv-close").addEventListener("click", function () { setOpen(false); });
  document.getElementById("pprv-export").addEventListener("click", function () {
    document.getElementById("pprv-export-menu").classList.toggle("show");
  });
  document.querySelectorAll("#pprv-export-menu [data-export]").forEach(function (b) {
    b.addEventListener("click", function () { doExport(b.getAttribute("data-export")); });
  });

  function render() {
    document.getElementById("pprv-title").textContent = state.title || "（无标题）";
    var body = document.getElementById("pprv-body");
    if (!state.sections || !state.sections.length) {
      body.innerHTML = '<div class="pprv-empty">暂无综述内容。</div>';
      return;
    }
    var html = state.sections.map(function (s) {
      return '<div class="pprv-sec"><h3>' + esc(s.heading || "") + "</h3><div class='b'>" + esc(s.body || "") + "</div></div>";
    }).join("");
    if (state.table && state.table.columns && state.table.rows) {
      html += '<div class="pprv-sec"><h3>' + esc(state.table.title || "核心文献对比") + "</h3>" +
        '<div class="pprv-table-wrap"><table class="pprv-table"><thead><tr>' +
        state.table.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        state.table.rows.map(function (row) {
          return "<tr>" + row.map(function (cell) { return "<td>" + esc(cell) + "</td>"; }).join("") + "</tr>";
        }).join("") +
        "</tbody></table></div></div>";
    }
    if (state.references && state.references.length) {
      html += '<div class="pprv-refs"><h3>参考文献</h3>' +
        state.references.map(function (r) { return '<div class="r">[' + esc(r.id) + "] " + esc(r.text || "") + "</div>"; }).join("") +
        "</div>";
    }
    body.innerHTML = html;
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

  function reviewToMarkdown() {
    var lines = ["# " + (state.title || "")];
    state.sections.forEach(function (s) {
      lines.push("", "## " + (s.heading || ""), "", s.body || "");
    });
    if (state.references && state.references.length) {
      lines.push("", "## 参考文献", "");
      state.references.forEach(function (r) { lines.push("[" + r.id + "] " + (r.text || "")); });
    }
    return lines.join("\n");
  }

  function rtfEsc(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}")
      .replace(/[^\x00-\x7F]/g, function (c) {
        var n = c.charCodeAt(0);
        if (n > 32767) n -= 65536;
        return "\\u" + n + "?";
      });
  }

  function reviewToRtf() {
    var out = ["{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Microsoft YaHei;}}\\f0"];
    out.push("{\\b\\fs32 " + rtfEsc(state.title) + "}\\par");
    state.sections.forEach(function (s) {
      out.push("{\\b\\fs28 " + rtfEsc(s.heading || "") + "}\\par");
      (s.body || "").split("\n").forEach(function (line) {
        if (line.trim()) out.push(rtfEsc(line) + "\\par");
      });
    });
    if (state.references && state.references.length) {
      out.push("{\\b\\fs28 参考文献}\\par");
      state.references.forEach(function (r) { out.push(rtfEsc("[" + r.id + "] " + (r.text || "")) + "\\par"); });
    }
    out.push("}");
    return out.join("\n");
  }

  function doExport(kind) {
    var title = (state.title || "综述").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    if (kind === "md") {
      downloadText(reviewToMarkdown(), title + ".md", "text/markdown;charset=utf-8");
    } else if (kind === "docx") {
      window.__dshExport.downloadDocx(reviewToMarkdown(), title + ".docx");
    } else if (kind === "latex") {
      window.__dshExport.downloadLatex(reviewToMarkdown(), title + ".tex");
    }
    var menu = document.getElementById("pprv-export-menu");
    if (menu) menu.classList.remove("show");
  }

  async function fetchReview() {
    try {
      var r = await fetch("/review-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.title = data.title || "";
      state.sections = data.sections || [];
      state.references = data.references || [];
      state.table = data.table || null;
      render();
      setOpen(true);
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  fetchReview();
  setInterval(fetchReview, POLL_MS);
})();
