/* 引文管理右侧面板（DSH Web 注入脚本）
 * cite.py 把 DOI 格式化并写入 /citation-panel.json，本脚本轮询展示引文列表。
 * 支持选择引文格式、添加引用（复制给 AI）、导出、删除/清空。
 */
(function () {
  "use strict";
  if (window.__citationPanelInjected) return;
  window.__citationPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { citations: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var STYLES = [
    { v: "gb7714", label: "GB/T 7714（中文期刊/毕业论文）" },
    { v: "apa", label: "APA 7th（英文最常用）" },
    { v: "ieee", label: "IEEE（工程/计算机）" },
    { v: "mla", label: "MLA（人文）" },
    { v: "custom", label: "自定义格式…" },
  ];

  var CUSTOM_DEFAULT = "{authors}. {title}[J]. {journal}, {year}, {volume}({issue}): {pages}. DOI:{doi}.";
  var PLACEHOLDER_HINT = "可用占位符：{authors} {title} {year} {journal} {volume} {issue} {pages} {doi}";

  var STYLE_TEMPLATES = {
    gb7714: "模板：作者1, 作者2, 作者3, 等. 标题[J]. 期刊, 年份, 卷(期): 页码. DOI:xxx.",
    apa: "模板：Author, A. A., Author, B. B., & Author, C. C. (Year). Title. Journal, Volume(Issue), pages. https://doi.org/xxx",
    ieee: "模板：A. Author, B. Author, and C. Author, \"Title,\" Journal, vol. X, no. Y, pp. Z-Z, Year, doi: xxx.",
    mla: "模板：Author, A. A., Author, B. B., and Author, C. C. \"Title.\" Journal, vol. X, no. Y, Year, pp. Z-Z.",
  };

  var CSS =
    ":root{--pp-cw:600px}" +
    "body.pp-citationdock{margin-right:var(--pp-cw);transition:margin-right .22s ease}" +
    "body.pp-citationdock #pp-citation-toggle{display:none}" +
    "#pp-citation-toggle{position:fixed;top:208px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#db2777;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#pcc-collapse{position:fixed;right:var(--pp-cw,600px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#db2777;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-citationdock #pcc-collapse{display:block}" +
    "#pp-citation-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-cw,600px);max-width:94vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-citation-panel.open{transform:translateX(0)}" +
    "#pcc-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#pcc-head h2{margin:0;font-size:16px}" +
    "#pcc-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#pcc-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#pcc-controls select,#pcc-controls input,#pcc-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#pcc-tpl{font-size:10.5px;color:#57606a;margin-bottom:8px;line-height:1.5;word-break:break-all}" +
    "#pcc-custom{width:100%;box-sizing:border-box;font-size:12px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit;resize:vertical;min-height:48px}" +
    ".pcc-sect{font-size:11px;color:#8b949e;font-weight:700;margin:10px 0 6px;border-top:1px dashed #e5e7eb;padding-top:8px}" +
    "#pcc-path{min-height:56px;resize:vertical;line-height:1.5}" +
    "#pcc-recognize{width:100%;border:1px solid #d0d7de;background:#f6f8fa;color:#57606a;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;margin-bottom:8px}" +
    "#pcc-add{width:100%;border:1px solid #db2777;background:#fdf2f8;color:#db2777;border-radius:6px;padding:7px;cursor:pointer;font-size:13px;margin-bottom:8px}" +
    "#pcc-add:hover{background:#fce7f3}" +
    "#pcc-actions{display:flex;gap:8px}" +
    "#pcc-export,#pcc-export-word,#pcc-clear{border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}" +
    "#pcc-clear{color:#b91c1c}" +
    "#pcc-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".pcc-item{display:flex;gap:8px;margin-bottom:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}" +
    ".pcc-num{font-size:12px;color:#db2777;font-weight:700;min-width:22px;text-align:right}" +
    ".pcc-txt{flex:1;font-size:12.5px;line-height:1.6;color:#24292f;word-break:break-word}" +
    ".pcc-del{border:0;background:none;color:#b91c1c;cursor:pointer;font-size:12px;align-self:flex-start}" +
    ".pcc-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-citation-panel{background:#161b22;color:#e6edf3}#pcc-head,#pcc-controls{background:#1c2128;border-color:#30363d}" +
    "#pcc-close{color:#8b949e}#pcc-controls select,#pcc-controls input,#pcc-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#pcc-add{color:#f9a8d4;border-color:#db2777;background:#2a0a18}#pcc-add:hover{background:#3d1224}" +
    "#pcc-export,#pcc-export-word,#pcc-clear{background:#161b22;color:#e6edf3;border-color:#30363d}#pcc-clear{color:#f87171}" +
    "#pcc-recognize{background:#21262d;color:#8b949e;border-color:#30363d}.pcc-sect{border-top-color:#30363d;color:#8b949e}" +
    ".pcc-item{background:#161b22;border-color:#30363d}.pcc-num{color:#f9a8d4}.pcc-txt{color:#e6edf3}.pcc-del{color:#f87171}.pcc-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-citation-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "引文管理面板";
  toggle.textContent = "引用";

  var collapse = document.createElement("button");
  collapse.id = "pcc-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起引文面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-citation-panel";
  panel.innerHTML =
    '<div id="pcc-head"><h2>引文管理</h2><button id="pcc-close" type="button" title="收起">&times;</button></div>' +
    '<div id="pcc-controls">' +
    '<select id="pcc-mode"><option value="doi">方式：DOI 输入</option><option value="folder">方式：文件/文件夹</option></select>' +
    '<input id="pcc-doi" placeholder="输入 DOI（或文献标题）" />' +
    '<textarea id="pcc-path" placeholder="PDF 路径或文件夹，可多个，每行一个（文件夹里只放论文 PDF）" style="display:none"></textarea>' +
    '<button id="pcc-add" type="button">生成引文（复制给 AI）</button>' +
    '<div class="pcc-sect">引文格式</div>' +
    '<select id="pcc-style">' + STYLES.map(function (s) { return '<option value="' + s.v + '">' + s.label + "</option>"; }).join("") + "</select>" +
    '<div id="pcc-tpl"></div>' +
    '<select id="pcc-savedfmt" style="display:none"><option value="">已保存格式…</option></select>' +
    '<textarea id="pcc-custom" style="display:none" placeholder="自定义格式模板…"></textarea>' +
    '<div id="pcc-fmt-wrap" style="display:none">' +
    '<div class="pcc-sect">识别格式（自定义模板辅助）</div>' +
    '<input id="pcc-fmt-example" placeholder="粘贴一段标准引文 → 自动生成模板" />' +
    '<button id="pcc-recognize" type="button">识别格式（复制给 AI）</button>' +
    "</div>" +
    '<div id="pcc-actions"><button id="pcc-export-word" type="button">导出 Word</button><button id="pcc-export" type="button">导出 Markdown</button><button id="pcc-clear" type="button">清空</button></div>' +
    "</div>" +
    '<div id="pcc-body"><div class="pcc-empty">暂无引用。输入 DOI 或文件夹/PDF 路径 → 点「生成引文」→ 粘贴给我 → 格式化后列在这里。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function closeOthers() {
    window.__dshPanels.closeAll("pp-citationdock", "pp-citation-panel");
  }
  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-citationdock", open);
    if (open) closeOthers();
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("pcc-close").addEventListener("click", function () { setOpen(false); });

  function updateMode() {
    var m = document.getElementById("pcc-mode").value;
    var doi = document.getElementById("pcc-doi");
    var path = document.getElementById("pcc-path");
    if (m === "folder") {
      doi.style.display = "none";
      path.style.display = "block";
    } else {
      doi.style.display = "block";
      path.style.display = "none";
    }
  }
  document.getElementById("pcc-mode").addEventListener("change", updateMode);
  updateMode();

  document.getElementById("pcc-add").addEventListener("click", function () {
    var mode = document.getElementById("pcc-mode").value;
    var st = document.getElementById("pcc-style");
    var sl = st.options[st.selectedIndex].text;
    var txt = "请把以下内容转成引文并加入引文面板：\n【格式】" + st.value + "（" + sl + "）";
    if (st.value === "custom") {
      txt += "\n【自定义模板】" + (document.getElementById("pcc-custom").value.trim() || CUSTOM_DEFAULT);
    }
    if (mode === "folder") {
      txt += "\n【路径（多个 PDF/文件夹，每行一个；文件夹里只放论文 PDF）】\n" + document.getElementById("pcc-path").value.trim();
    } else {
      txt += "\n【DOI/标题】" + document.getElementById("pcc-doi").value.trim();
    }
    copyText(txt);
  });

  function updateTpl() {
    var st = document.getElementById("pcc-style").value;
    var tpl = document.getElementById("pcc-tpl");
    var custom = document.getElementById("pcc-custom");
    var saved = document.getElementById("pcc-savedfmt");
    var fmtWrap = document.getElementById("pcc-fmt-wrap");
    if (st === "custom") {
      tpl.textContent = PLACEHOLDER_HINT;
      custom.style.display = "block";
      saved.style.display = "block";
      fmtWrap.style.display = "block";
      if (!custom.value && saved.value === "") custom.value = CUSTOM_DEFAULT;
    } else {
      tpl.textContent = STYLE_TEMPLATES[st] || "";
      custom.style.display = "none";
      saved.style.display = "none";
      fmtWrap.style.display = "none";
    }
  }
  document.getElementById("pcc-style").addEventListener("change", updateTpl);
  updateTpl();

  var savedFormats = [];
  function fetchFormats() {
    try {
      fetch("/custom-formats.json?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { if (!r.ok) return null; return r.json(); })
        .then(function (d) {
          if (!d || !d.formats) return;
          savedFormats = d.formats;
          var sel = document.getElementById("pcc-savedfmt");
          sel.innerHTML = '<option value="">已保存格式…</option>' + savedFormats.map(function (f, i) {
            return '<option value="' + i + '">' + esc(f.name) + "</option>";
          }).join("");
        });
    } catch (e) {}
  }
  fetchFormats();

  document.getElementById("pcc-savedfmt").addEventListener("change", function () {
    var f = savedFormats[+document.getElementById("pcc-savedfmt").value] || null;
    if (f) document.getElementById("pcc-custom").value = f.template;
  });

  document.getElementById("pcc-recognize").addEventListener("click", function () {
    var ex = document.getElementById("pcc-fmt-example").value.trim();
    copyText("请识别下面这段标准引文的格式，生成自定义模板并保存（占位符：{authors} {title} {year} {journal} {volume} {issue} {pages} {doi}）：\n" + ex);
  });

  document.getElementById("pcc-clear").addEventListener("click", function () {
    copyText("请清空引文面板");
  });

  document.getElementById("pcc-body").addEventListener("click", function (ev) {
    var del = ev.target.closest("[data-cdel]");
    if (del) copyText("请删除引文面板第 " + del.getAttribute("data-cdel") + " 条（0 起）");
  });

  function buildMd() {
    return state.citations.map(function (c, i) { return "[" + (i + 1) + "] " + c.text; }).join("\n\n");
  }
  document.getElementById("pcc-export").addEventListener("click", function () {
    downloadText(buildMd(), "参考文献.md", "text/markdown;charset=utf-8");
  });
  document.getElementById("pcc-export-word").addEventListener("click", function () {
    window.__dshExport.downloadDocx(buildMd(), "参考文献.docx");
  });

  function copyText(text) {
    var done = function () { alert("已复制到剪贴板，粘贴到对话里发给我。"); };
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
  function downloadText(content, filename, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function render() {
    var body = document.getElementById("pcc-body");
    if (!state.citations.length) {
      body.innerHTML = '<div class="pcc-empty">暂无引用。</div>';
      return;
    }
    body.innerHTML = state.citations.map(function (c, i) {
      return '<div class="pcc-item"><div class="pcc-num">' + (i + 1) + '</div>' +
        '<div class="pcc-txt">' + esc(c.text) + "</div>" +
        '<button class="pcc-del" type="button" data-cdel="' + i + '">✕</button></div>';
    }).join("");
  }

  async function fetchCitation() {
    try {
      var r = await fetch("/citation-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.citations = data.citations || [];
      render();
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchCitation();
  setInterval(fetchCitation, POLL_MS);
})();
