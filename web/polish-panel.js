/* 学术润色右侧面板（DSH Web 注入脚本）
 * 用户填文本 + 方式/风格 → 复制给 AI → AI 润色后写 /polish-panel.json → 本脚本轮询展示。
 */
(function () {
  "use strict";
  if (window.__polishPanelInjected) return;
  window.__polishPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { items: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  var MODES = ["润色", "改写", "翻译成英文", "中译英（学术）"];
  var STYLES = ["Nature 风格", "简洁精准", "学术严谨", "保持原意"];

  var CSS =
    ":root{--ppl-w:640px}" +
    "body.pp-polishdock{margin-right:var(--ppl-w);transition:margin-right .22s ease}" +
    "body.pp-polishdock #pp-polish-toggle{display:none}" +
    "#pp-polish-toggle{position:fixed;top:248px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#6366f1;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#ppl-collapse{position:fixed;right:var(--ppl-w,640px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#6366f1;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-polishdock #ppl-collapse{display:block}" +
    "#pp-polish-panel{position:fixed;top:0;right:0;height:100vh;width:var(--ppl-w,640px);max-width:94vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-polish-panel.open{transform:translateX(0)}" +
    "#ppl-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#ppl-head h2{margin:0;font-size:16px}" +
    "#ppl-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#ppl-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#ppl-controls select,#ppl-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#ppl-input{min-height:110px;resize:vertical;line-height:1.5}" +
    "#ppl-row{display:flex;gap:8px}" +
    "#ppl-row select{flex:1}" +
    "#ppl-run{width:100%;border:1px solid #6366f1;background:#eef2ff;color:#4f46e5;border-radius:6px;padding:7px;cursor:pointer;font-size:13px;margin-bottom:8px}" +
    "#ppl-run:hover{background:#e0e7ff}" +
    "#ppl-actions{display:flex;gap:8px}" +
    "#ppl-export,#ppl-export-word,#ppl-clear{border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}" +
    "#ppl-clear{color:#b91c1c}" +
    "#ppl-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".ppl-item{border:1px solid #e5e7eb;border-radius:8px;background:#fff;margin-bottom:12px;overflow:hidden}" +
    ".ppl-tag{padding:8px 10px;background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:700;border-bottom:1px solid #e5e7eb}" +
    ".ppl-sec{padding:8px 12px;border-bottom:1px solid #f0f1f3}" +
    ".ppl-sec:last-child{border-bottom:0}" +
    ".ppl-lbl{font-size:11px;color:#8b949e;margin-bottom:4px;font-weight:600}" +
    ".ppl-txt{font-size:12.5px;line-height:1.6;color:#24292f;word-break:break-word;white-space:pre-wrap}" +
    ".ppl-chg{margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:#57606a}" +
    ".ppl-chg li{margin-bottom:2px}" +
    ".ppl-del{border:0;background:none;color:#b91c1c;cursor:pointer;font-size:12px;float:right}" +
    ".ppl-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-polish-panel{background:#161b22;color:#e6edf3}#ppl-head,#ppl-controls{background:#1c2128;border-color:#30363d}" +
    "#ppl-close{color:#8b949e}#ppl-controls select,#ppl-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#ppl-run{color:#a5b4fc;border-color:#6366f1;background:#1e1b4b}#ppl-run:hover{background:#312e81}" +
    "#ppl-export,#ppl-export-word,#ppl-clear{background:#161b22;color:#e6edf3;border-color:#30363d}#ppl-clear{color:#f87171}" +
    ".ppl-item{background:#161b22;border-color:#30363d}.ppl-tag{background:#1e1b4b;color:#a5b4fc;border-color:#30363d}" +
    ".ppl-sec{border-color:#30363d}.ppl-lbl{color:#8b949e}.ppl-txt{color:#e6edf3}.ppl-chg{color:#8b949e}.ppl-del{color:#f87171}.ppl-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-polish-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "学术润色面板";
  toggle.textContent = "润色";

  var collapse = document.createElement("button");
  collapse.id = "ppl-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起润色面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-polish-panel";
  panel.innerHTML =
    '<div id="ppl-head"><h2>学术润色</h2><button id="ppl-close" type="button" title="收起">&times;</button></div>' +
    '<div id="ppl-controls">' +
    '<div id="ppl-row">' +
    '<select id="ppl-mode">' + MODES.map(function (m) { return "<option>" + m + "</option>"; }).join("") + "</select>" +
    '<select id="ppl-style">' + STYLES.map(function (m) { return "<option>" + m + "</option>"; }).join("") + "</select>" +
    "</div>" +
    '<textarea id="ppl-input" placeholder="粘贴要润色/改写/翻译的学术段落…"></textarea>' +
    '<button id="ppl-run" type="button">润色（复制给 AI）</button>' +
    '<div id="ppl-actions"><button id="ppl-export-word" type="button">导出 Word</button><button id="ppl-export" type="button">导出 Markdown</button><button id="ppl-clear" type="button">清空</button></div>' +
    "</div>" +
    '<div id="ppl-body"><div class="ppl-empty">粘贴文本 → 选方式/风格 → 点「润色」→ 粘贴给我 → 结果展示在这里。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-polishdock", open);
    if (open) window.__dshPanels.closeAll("pp-polishdock", "pp-polish-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("ppl-close").addEventListener("click", function () { setOpen(false); });

  document.getElementById("ppl-run").addEventListener("click", function () {
    var mode = document.getElementById("ppl-mode").value;
    var stl = document.getElementById("ppl-style").value;
    var txt = document.getElementById("ppl-input").value.trim();
    copyText("请把下面这段文本【" + mode + "】，风格【" + stl + "】，先诊断再改（术语一致、删冗余、动词校准、删无据声明），输出润色后文本+主要修改，并写入润色面板：\n【原文】\n" + txt);
  });

  document.getElementById("ppl-clear").addEventListener("click", function () {
    copyText("请清空润色面板");
  });

  document.getElementById("ppl-body").addEventListener("click", function (ev) {
    var del = ev.target.closest("[data-ppldel]");
    if (del) copyText("请删除润色面板第 " + del.getAttribute("data-ppldel") + " 条（0 起）");
  });

  function buildMd() {
    return state.items.map(function (it, i) {
      var s = "## " + (i + 1) + ". " + it.mode + "（" + it.style + "）\n\n**原文**\n\n" + (it.original || "") +
        "\n\n**润色后**\n\n" + (it.polished || "");
      if (it.changes && it.changes.length) s += "\n\n**主要修改**\n\n" + it.changes.map(function (c) { return "- " + c; }).join("\n");
      return s;
    }).join("\n\n---\n\n");
  }
  document.getElementById("ppl-export").addEventListener("click", function () {
    downloadText(buildMd(), "润色结果.md", "text/markdown;charset=utf-8");
  });
  document.getElementById("ppl-export-word").addEventListener("click", function () {
    window.__dshExport.downloadDocx(buildMd(), "润色结果.docx");
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
    var body = document.getElementById("ppl-body");
    if (!state.items.length) {
      body.innerHTML = '<div class="ppl-empty">暂无润色结果。</div>';
      return;
    }
    body.innerHTML = state.items.map(function (it, i) {
      var chg = (it.changes && it.changes.length)
        ? '<div class="ppl-sec"><div class="ppl-lbl">主要修改</div><ul class="ppl-chg">' +
          it.changes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>"
        : "";
      return '<div class="ppl-item">' +
        '<div class="ppl-tag">' + esc(it.mode || "润色") + " · " + esc(it.style || "") +
        '<button class="ppl-del" type="button" data-ppldel="' + i + '">✕</button></div>' +
        '<div class="ppl-sec"><div class="ppl-lbl">原文</div><div class="ppl-txt">' + esc(it.original || "") + "</div></div>" +
        '<div class="ppl-sec"><div class="ppl-lbl">润色后</div><div class="ppl-txt">' + esc(it.polished || "") + "</div></div>" +
        chg +
        "</div>";
    }).join("");
  }

  async function fetchPolish() {
    try {
      var r = await fetch("/polish-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.items = data.items || [];
      render();
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchPolish();
  setInterval(fetchPolish, POLL_MS);
})();
