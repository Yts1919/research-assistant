/* 格式修改右侧面板（DSH Web 注入脚本）
 * 用户填「格式要求/模板」+「自己的论文路径」→ 复制给 AI → AI 按格式规范重排论文 → 写 /reformat-panel.json → 本脚本预览。
 * 支持导出 Word / LaTeX / Markdown。
 */
(function () {
  "use strict";
  if (window.__reformatPanelInjected) return;
  window.__reformatPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { title: "", preview: "", note: "" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escInline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  function previewHtml(md) {
    var lines = String(md || "").split(/\r?\n/);
    var html = "";
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].replace(/\s+$/, "");
      if (!s.trim()) continue;
      var hm = s.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        var lvl = Math.min(hm[1].length, 3);
        html += '<div class="rf-h rf-h' + lvl + '">' + escInline(hm[2]) + "</div>";
        continue;
      }
      if (/^\s*[-*+]\s+/.test(s)) {
        html += '<div class="rf-li">• ' + escInline(s.replace(/^\s*[-*+]\s+/, "")) + "</div>";
        continue;
      }
      html += '<div class="rf-p">' + escInline(s) + "</div>";
    }
    return html;
  }

  var CSS =
    ":root{--rf-w:680px}" +
    "body.pp-reformatdock{margin-right:var(--rf-w);transition:margin-right .22s ease}" +
    "body.pp-reformatdock #pp-reformat-toggle{display:none}" +
    "#pp-reformat-toggle{position:fixed;top:368px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#d97706;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#rf-collapse{position:fixed;right:var(--rf-w,680px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#d97706;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-reformatdock #rf-collapse{display:block}" +
    "#pp-reformat-panel{position:fixed;top:0;right:0;height:100vh;width:var(--rf-w,680px);max-width:94vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-reformat-panel.open{transform:translateX(0)}" +
    "#rf-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#rf-head h2{margin:0;font-size:16px}" +
    "#rf-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#rf-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#rf-controls .rf-sect{font-size:11px;color:#8b949e;font-weight:700;margin:8px 0 6px;border-top:1px dashed #e5e7eb;padding-top:8px}" +
    "#rf-controls input,#rf-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#rf-controls textarea{resize:vertical;line-height:1.5}" +
    "#rf-req{min-height:64px}" +
    "#rf-run{width:100%;border:1px solid #d97706;background:#fffbeb;color:#b45309;border-radius:6px;padding:7px;cursor:pointer;font-size:13px;margin-bottom:6px}" +
    "#rf-run:hover{background:#fef3c7}" +
    "#rf-more-req{min-height:48px}" +
    "#rf-more{width:100%;border:1px solid #d0d7de;background:#f6f8fa;color:#57606a;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;margin-bottom:6px}" +
    "#rf-more:hover{background:#eef1f4}" +
    "#rf-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".rf-title{font-size:16px;font-weight:700;color:#b45309;margin-bottom:6px}" +
    ".rf-note{font-size:12px;color:#8b949e;background:#f6f8fa;border-radius:6px;padding:8px 10px;margin-bottom:12px;line-height:1.6}" +
    ".rf-h1{font-size:16px;font-weight:700;margin:14px 0 6px;color:#1f2328}" +
    ".rf-h2{font-size:14px;font-weight:700;margin:12px 0 5px;color:#1f2328}" +
    ".rf-h3{font-size:13px;font-weight:700;margin:10px 0 4px;color:#1f2328}" +
    ".rf-p{font-size:13px;line-height:1.75;color:#24292f;margin:0 0 8px;word-break:break-word}" +
    ".rf-li{font-size:13px;line-height:1.7;color:#24292f;margin:0 0 4px 12px;word-break:break-word}" +
    ".rf-p b,.rf-li b{font-weight:700}" +
    ".rf-p code,.rf-li code{background:#f0f1f3;border-radius:3px;padding:0 4px;font-family:ui-monospace,Consolas,monospace;font-size:12px}" +
    ".rf-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "#rf-actions{display:flex;flex-wrap:wrap;gap:8px;padding:10px 18px;border-top:1px solid #e5e7eb;background:#fff}" +
    "#rf-actions button{font-size:12px;border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;padding:6px 10px;cursor:pointer}" +
    "#rf-actions button.rf-primary{background:#d97706;color:#fff;border-color:#d97706}" +
    "#rf-actions button.rf-primary:hover{background:#b45309}" +
    "#rf-clear{color:#b91c1c}" +
    "#rf-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:100000;background:rgba(15,23,42,.92);color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .25s;max-width:80vw;word-break:break-all}" +
    "#rf-toast.show{opacity:1}" +
    "@media (prefers-color-scheme: dark){#pp-reformat-panel{background:#161b22;color:#e6edf3}#rf-head,#rf-controls,#rf-actions{background:#1c2128;border-color:#30363d}" +
    "#rf-close{color:#8b949e}#rf-controls .rf-sect{color:#8b949e;border-top-color:#30363d}#rf-controls input,#rf-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#rf-run{color:#fbbf24;border-color:#d97706;background:#2a1a05}#rf-run:hover{background:#3d2410}" +
    "#rf-more{background:#161b22;color:#8b949e;border-color:#30363d}#rf-more:hover{background:#21262d}" +
    ".rf-title{color:#fbbf24}.rf-note{background:#161b22;color:#8b949e}.rf-h1,.rf-h2,.rf-h3{color:#e6edf3}.rf-p,.rf-li{color:#e6edf3}" +
    ".rf-p code,.rf-li code{background:#21262d}.rf-empty{color:#8b949e}#rf-actions button{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#rf-actions button.rf-primary{background:#d97706;color:#fff;border-color:#d97706}#rf-clear{color:#f87171}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-reformat-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "格式修改面板";
  toggle.textContent = "格式";

  var collapse = document.createElement("button");
  collapse.id = "rf-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起格式修改面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-reformat-panel";
  panel.innerHTML =
    '<div id="rf-head"><h2>格式修改</h2><button id="rf-close" type="button" title="收起">&times;</button></div>' +
    '<div id="rf-controls">' +
    '<div class="rf-sect">① 格式要求（两者选一）</div>' +
    '<input id="rf-tpl" placeholder="模板/规范文件或文件夹路径（如期刊投稿模板）" />' +
    '<textarea id="rf-req" placeholder="或用文字描述格式要求（如：正文小四宋体、1.5 倍行距、参考文献 GB/T 7714…）"></textarea>' +
    '<div class="rf-sect">② 你的论文</div>' +
    '<input id="rf-paper" placeholder="论文文件或文件夹路径（Word 文档）" />' +
    '<button id="rf-run" type="button">开始修改（复制给 AI）</button>' +
    '<div class="rf-sect">③ 继续修改（可选）</div>' +
    '<textarea id="rf-more-req" placeholder="对上次结果不满意？在这里追加要求"></textarea>' +
    '<button id="rf-more" type="button">继续修改（复制给 AI）</button>' +
    "</div>" +
    '<div id="rf-body"><div class="rf-empty">填格式要求 + 论文路径 → 点「开始修改」→ 粘贴给我 → 修改结果在这里预览。</div></div>' +
    '<div id="rf-actions">' +
    '<button type="button" class="rf-primary" id="rf-dl-word">下载 Word</button>' +
    '<button type="button" class="rf-primary" id="rf-dl-latex">下载 LaTeX</button>' +
    '<button type="button" id="rf-dl-md">下载 Markdown</button>' +
    '<button type="button" id="rf-clear">清空</button>' +
    "</div>";

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-reformatdock", open);
    if (open) window.__dshPanels.closeAll("pp-reformatdock", "pp-reformat-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("rf-close").addEventListener("click", function () { setOpen(false); });

  function copyToAgent(text) {
    var done = function () { ppToast("已复制，粘贴到对话里发给我即可"); };
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
  var toastEl = null, toastTimer = null;
  function ppToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "rf-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }

  document.getElementById("rf-run").addEventListener("click", function () {
    var req = document.getElementById("rf-req").value.trim();
    var tpl = document.getElementById("rf-tpl").value.trim();
    var paper = document.getElementById("rf-paper").value.trim();
    var txt = "请按下面的格式要求修改这篇论文，并把结果写入格式修改面板：\n";
    if (tpl) txt += "【模板/规范文件路径】" + tpl + "\n";
    if (req) txt += "【格式要求】" + req + "\n";
    txt += "【论文路径】" + paper;
    copyToAgent(txt);
  });

  document.getElementById("rf-more").addEventListener("click", function () {
    var more = document.getElementById("rf-more-req").value.trim();
    copyToAgent("请在上次格式修改结果的基础上，继续按以下要求修改并更新格式修改面板：\n【追加要求】" + more);
  });

  document.getElementById("rf-clear").addEventListener("click", function () {
    copyToAgent("请清空格式修改面板");
  });

  function buildMd() {
    var out = [];
    if (state.title) out.push("# " + state.title);
    if (state.note) out.push("> " + state.note);
    out.push(state.preview || "");
    return out.join("\n\n");
  }
  document.getElementById("rf-dl-word").addEventListener("click", function () {
    window.__dshExport.downloadDocx(buildMd(), (state.title || "格式修改结果") + ".docx");
  });
  document.getElementById("rf-dl-latex").addEventListener("click", function () {
    window.__dshExport.downloadLatex(buildMd(), (state.title || "格式修改结果") + ".tex");
  });
  document.getElementById("rf-dl-md").addEventListener("click", function () {
    window.__dshExport.downloadText(buildMd(), (state.title || "格式修改结果") + ".md", "text/markdown;charset=utf-8");
  });

  function render() {
    var body = document.getElementById("rf-body");
    if (!state.preview && !state.title) {
      body.innerHTML = '<div class="rf-empty">暂无修改结果。</div>';
      return;
    }
    var html = "";
    if (state.title) html += '<div class="rf-title">' + esc(state.title) + "</div>";
    if (state.note) html += '<div class="rf-note">' + esc(state.note) + "</div>";
    html += previewHtml(state.preview);
    body.innerHTML = html;
  }

  async function fetchReformat() {
    try {
      var r = await fetch("/reformat-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.title = data.title || "";
      state.preview = data.preview || "";
      state.note = data.note || "";
      render();
      setOpen(true);
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchReformat();
  setInterval(fetchReformat, POLL_MS);
})();
