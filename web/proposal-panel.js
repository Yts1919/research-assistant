/* 开题/方案写作右侧面板（DSH Web 注入脚本）
 * 用户填题目/方向 → 复制给 AI → AI 生成开题框架 + 各节内容 + 真实文献 → 写 /proposal-panel.json → 本脚本轮询展示。
 */
(function () {
  "use strict";
  if (window.__proposalPanelInjected) return;
  window.__proposalPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { title: "", sections: [], references: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var CSS =
    ":root{--ppp-w:680px}" +
    "body.pp-proposaldock{margin-right:var(--ppp-w);transition:margin-right .22s ease}" +
    "body.pp-proposaldock #pp-proposal-toggle{display:none}" +
    "#pp-proposal-toggle{position:fixed;top:328px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#059669;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#ppp-collapse{position:fixed;right:var(--ppp-w,680px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#059669;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-proposaldock #ppp-collapse{display:block}" +
    "#pp-proposal-panel{position:fixed;top:0;right:0;height:100vh;width:var(--ppp-w,680px);max-width:94vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-proposal-panel.open{transform:translateX(0)}" +
    "#ppp-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#ppp-head h2{margin:0;font-size:16px}" +
    "#ppp-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#ppp-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#ppp-controls input,#ppp-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#ppp-topic{font-weight:600}" +
    "#ppp-req{min-height:70px;resize:vertical;line-height:1.5}" +
    "#ppp-run{width:100%;border:1px solid #059669;background:#ecfdf5;color:#047857;border-radius:6px;padding:7px;cursor:pointer;font-size:13px;margin-bottom:8px}" +
    "#ppp-run:hover{background:#d1fae5}" +
    "#ppp-actions{display:flex;gap:8px}" +
    "#ppp-export,#ppp-export-word,#ppp-clear{border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}" +
    "#ppp-clear{color:#b91c1c}" +
    "#ppp-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".ppp-title{font-size:16px;font-weight:700;color:#047857;margin:0 0 12px;line-height:1.5}" +
    ".ppp-sec{border:1px solid #e5e7eb;border-radius:8px;background:#fff;margin-bottom:10px;overflow:hidden}" +
    ".ppp-sec-head{padding:8px 12px;background:#ecfdf5;color:#047857;font-size:13px;font-weight:700;border-bottom:1px solid #e5e7eb;cursor:pointer;display:flex;justify-content:space-between}" +
    ".ppp-sec-body{padding:10px 12px;font-size:12.5px;line-height:1.7;color:#24292f;white-space:pre-wrap;word-break:break-word}" +
    ".ppp-sec-body.collapsed{display:none}" +
    ".ppp-refs{border:1px solid #e5e7eb;border-radius:8px;background:#f6f8fa;padding:10px 12px}" +
    ".ppp-refs h4{margin:0 0 6px;font-size:13px;color:#24292f}" +
    ".ppp-ref{font-size:12px;line-height:1.6;color:#57606a;margin-bottom:4px}" +
    ".ppp-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-proposal-panel{background:#161b22;color:#e6edf3}#ppp-head,#ppp-controls{background:#1c2128;border-color:#30363d}" +
    "#ppp-close{color:#8b949e}#ppp-controls input,#ppp-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#ppp-run{color:#6ee7b7;border-color:#059669;background:#052e1b}#ppp-run:hover{background:#064e3b}" +
    "#ppp-export,#ppp-export-word,#ppp-clear{background:#161b22;color:#e6edf3;border-color:#30363d}#ppp-clear{color:#f87171}" +
    ".ppp-title{color:#6ee7b7}.ppp-sec{background:#161b22;border-color:#30363d}.ppp-sec-head{background:#052e1b;color:#6ee7b7;border-color:#30363d}" +
    ".ppp-sec-body{color:#e6edf3}.ppp-refs{background:#161b22;border-color:#30363d}.ppp-refs h4{color:#e6edf3}.ppp-ref{color:#8b949e}.ppp-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-proposal-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "开题方案面板";
  toggle.textContent = "开题";

  var collapse = document.createElement("button");
  collapse.id = "ppp-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起开题面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-proposal-panel";
  panel.innerHTML =
    '<div id="ppp-head"><h2>开题 / 研究方案</h2><button id="ppp-close" type="button" title="收起">&times;</button></div>' +
    '<div id="ppp-controls">' +
    '<input id="ppp-topic" placeholder="研究题目 / 方向（如：抽油杆柱振动特性与防偏磨研究）" />' +
    '<textarea id="ppp-req" placeholder="补充要求（可选）：学科、字数、目标期刊、创新点侧重…"></textarea>' +
    '<button id="ppp-run" type="button">生成方案（复制给 AI）</button>' +
    '<div id="ppp-actions"><button id="ppp-export-word" type="button">导出 Word</button><button id="ppp-export" type="button">导出 Markdown</button><button id="ppp-clear" type="button">清空</button></div>' +
    "</div>" +
    '<div id="ppp-body"><div class="ppp-empty">填题目 → 点「生成方案」→ 粘贴给我 → 开题框架 + 各节内容 + 真实文献展示在这里。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-proposaldock", open);
    if (open) window.__dshPanels.closeAll("pp-proposaldock", "pp-proposal-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("ppp-close").addEventListener("click", function () { setOpen(false); });

  document.getElementById("ppp-run").addEventListener("click", function () {
    var topic = document.getElementById("ppp-topic").value.trim();
    var req = document.getElementById("ppp-req").value.trim();
    copyText("请为这个题目写一份开题/研究方案（proposal-first：先一句话论证 + 章节契约，再成文；研究现状用 tools/search.py 检索真实文献，不编造）。结构：研究背景与意义 / 国内外研究现状 / 研究内容与目标 / 研究方法与技术路线 / 创新点 / 进度安排 / 预期成果 / 参考文献。写完后写入开题面板：\n【题目】" + topic + (req ? "\n【要求】" + req : ""));
  });

  document.getElementById("ppp-clear").addEventListener("click", function () {
    copyText("请清空开题面板");
  });

  document.getElementById("ppp-body").addEventListener("click", function (ev) {
    var h = ev.target.closest("[data-ppphead]");
    if (h) {
      var body = h.nextElementSibling;
      if (body) body.classList.toggle("collapsed");
    }
  });

  function buildMd() {
    var out = [];
    if (state.title) out.push("# " + state.title);
    (state.sections || []).forEach(function (s) {
      out.push("## " + s.title + "\n\n" + (s.content || ""));
    });
    if (state.references && state.references.length) {
      out.push("## 参考文献\n\n" + state.references.map(function (r, i) { return "[" + (i + 1) + "] " + r; }).join("\n"));
    }
    return out.join("\n\n");
  }
  document.getElementById("ppp-export").addEventListener("click", function () {
    downloadText(buildMd(), "开题方案.md", "text/markdown;charset=utf-8");
  });
  document.getElementById("ppp-export-word").addEventListener("click", function () {
    window.__dshExport.downloadDocx(buildMd(), "开题方案.docx");
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
    var body = document.getElementById("ppp-body");
    if (!state.title && !(state.sections || []).length && !(state.references || []).length) {
      body.innerHTML = '<div class="ppp-empty">暂无方案内容。</div>';
      return;
    }
    var html = state.title ? '<div class="ppp-title">' + esc(state.title) + "</div>" : "";
    html += (state.sections || []).map(function (s, i) {
      return '<div class="ppp-sec">' +
        '<div class="ppp-sec-head" data-ppphead="' + i + '"><span>' + esc(s.title) + "</span><span>▾</span></div>" +
        '<div class="ppp-sec-body">' + esc(s.content || "") + "</div></div>";
    }).join("");
    if (state.references && state.references.length) {
      html += '<div class="ppp-refs"><h4>参考文献</h4>' +
        state.references.map(function (r, i) { return '<div class="ppp-ref">[' + (i + 1) + "] " + esc(r) + "</div>"; }).join("") + "</div>";
    }
    body.innerHTML = html;
  }

  async function fetchProposal() {
    try {
      var r = await fetch("/proposal-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.title = data.title || "";
      state.sections = data.sections || [];
      state.references = data.references || [];
      render();
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchProposal();
  setInterval(fetchProposal, POLL_MS);
})();
