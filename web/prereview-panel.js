/* 预投稿审稿右侧面板（DSH Web 注入脚本）
 * 用户粘稿件 → 复制给 AI → AI 扮演三位互盲审稿人评审 → 写 /prereview-panel.json → 本脚本轮询展示。
 */
(function () {
  "use strict";
  if (window.__prereviewPanelInjected) return;
  window.__prereviewPanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { reviews: [], summary: "" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var VERDICT_COLORS = {
    "接受": "#16a34a", "小修": "#0d9488", "大修": "#ea580c", "拒稿": "#dc2626",
    "Accept": "#16a34a", "Minor": "#0d9488", "Major": "#ea580c", "Reject": "#dc2626"
  };

  var CSS =
    ":root{--ppr-w:720px}" +
    "body.pp-prereviewdock{margin-right:var(--ppr-w);transition:margin-right .22s ease}" +
    "body.pp-prereviewdock #pp-prereview-toggle{display:none}" +
    "#pp-prereview-toggle{position:fixed;top:288px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#e11d48;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#pprr-collapse{position:fixed;right:var(--ppr-w,720px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#e11d48;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-prereviewdock #pprr-collapse{display:block}" +
    "#pp-prereview-panel{position:fixed;top:0;right:0;height:100vh;width:var(--ppr-w,720px);max-width:94vw;z-index:99980;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-prereview-panel.open{transform:translateX(0)}" +
    "#pprr-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#pprr-head h2{margin:0;font-size:16px}" +
    "#pprr-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#pprr-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#pprr-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#pprr-input{min-height:110px;resize:vertical;line-height:1.5}" +
    "#pprr-run{width:100%;border:1px solid #e11d48;background:#fff1f2;color:#be123c;border-radius:6px;padding:7px;cursor:pointer;font-size:13px;margin-bottom:8px}" +
    "#pprr-run:hover{background:#ffe4e6}" +
    "#pprr-actions{display:flex;gap:8px}" +
    "#pprr-export,#pprr-export-word,#pprr-clear{border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}" +
    "#pprr-clear{color:#b91c1c}" +
    "#pprr-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".pprr-rv{border:1px solid #e5e7eb;border-radius:8px;background:#fff;margin-bottom:12px;overflow:hidden}" +
    ".pprr-rv-head{padding:8px 12px;background:#fff1f2;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;cursor:pointer}" +
    ".pprr-rv-title{font-size:13px;font-weight:700;color:#be123c}" +
    ".pprr-rv-focus{font-size:11px;color:#8b949e}" +
    ".pprr-verdict{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:#fff;border:1px solid #e5e7eb}" +
    ".pprr-rv-body{padding:10px 12px}" +
    ".pprr-rv-body.collapsed{display:none}" +
    ".pprr-block{margin-bottom:8px}" +
    ".pprr-lbl{font-size:11px;color:#8b949e;font-weight:600;margin-bottom:3px}" +
    ".pprr-txt{font-size:12.5px;line-height:1.6;color:#24292f;white-space:pre-wrap;word-break:break-word}" +
    ".pprr-list{margin:0;padding-left:18px;font-size:12.5px;line-height:1.7;color:#24292f}" +
    ".pprr-list li{margin-bottom:3px}" +
    ".pprr-sum{border:1px solid #e5e7eb;border-radius:8px;background:#f6f8fa;padding:10px 12px;margin-bottom:12px}" +
    ".pprr-sum h4{margin:0 0 6px;font-size:13px;color:#24292f}" +
    ".pprr-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-prereview-panel{background:#161b22;color:#e6edf3}#pprr-head,#pprr-controls{background:#1c2128;border-color:#30363d}" +
    "#pprr-close{color:#8b949e}#pprr-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#pprr-run{color:#fda4af;border-color:#e11d48;background:#2a0a12}#pprr-run:hover{background:#3d1224}" +
    "#pprr-export,#pprr-export-word,#pprr-clear{background:#161b22;color:#e6edf3;border-color:#30363d}#pprr-clear{color:#f87171}" +
    ".pprr-rv{background:#161b22;border-color:#30363d}.pprr-rv-head{background:#2a0a12;border-color:#30363d}.pprr-rv-title{color:#fda4af}" +
    ".pprr-rv-focus{color:#8b949e}.pprr-verdict{background:#161b22;border-color:#30363d}.pprr-lbl{color:#8b949e}" +
    ".pprr-txt{color:#e6edf3}.pprr-list{color:#e6edf3}.pprr-sum{background:#161b22;border-color:#30363d}.pprr-sum h4{color:#e6edf3}.pprr-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-prereview-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "预投稿审稿面板";
  toggle.textContent = "审稿";

  var collapse = document.createElement("button");
  collapse.id = "pprr-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起审稿面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-prereview-panel";
  panel.innerHTML =
    '<div id="pprr-head"><h2>预投稿审稿</h2><button id="pprr-close" type="button" title="收起">&times;</button></div>' +
    '<div id="pprr-controls">' +
    '<textarea id="pprr-input" placeholder="粘贴稿件（摘要 / 关键章节 / 全文），三位互盲审稿人将从方法、新颖性、结果与呈现分别评审…"></textarea>' +
    '<button id="pprr-run" type="button">开始审稿（复制给 AI）</button>' +
    '<div id="pprr-actions"><button id="pprr-export-word" type="button">导出 Word</button><button id="pprr-export" type="button">导出 Markdown</button><button id="pprr-clear" type="button">清空</button></div>' +
    "</div>" +
    '<div id="pprr-body"><div class="pprr-empty">粘贴稿件 → 点「开始审稿」→ 粘贴给我 → 三份 reviewer 报告展示在这里。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-prereviewdock", open);
    if (open) window.__dshPanels.closeAll("pp-prereviewdock", "pp-prereview-panel");
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("pprr-close").addEventListener("click", function () { setOpen(false); });

  document.getElementById("pprr-run").addEventListener("click", function () {
    var txt = document.getElementById("pprr-input").value.trim();
    copyText("请扮演三位互盲审稿人（R1 方法严谨性 / R2 新颖性与意义 / R3 结果与呈现），各自独立评审，各输出：总体评价、主要优点、Major、Minor、推荐结论（接受/小修/大修/拒稿），最后给一段综合意见；检查内部一致性，意见具体可执行。写完后写入审稿面板：\n【稿件】\n" + txt);
  });

  document.getElementById("pprr-clear").addEventListener("click", function () {
    copyText("请清空审稿面板");
  });

  document.getElementById("pprr-body").addEventListener("click", function (ev) {
    var h = ev.target.closest("[data-pprhead]");
    if (h) {
      var body = h.nextElementSibling;
      if (body) body.classList.toggle("collapsed");
    }
  });

  function buildMd() {
    var out = state.reviews.map(function (rv) {
      var s = "## " + rv.reviewer + "（关注：" + rv.focus + "）\n\n**推荐结论**：" + rv.verdict +
        "\n\n**总体评价**\n\n" + (rv.overall || "") + "\n\n**主要优点**\n\n" + (rv.strengths || "") +
        "\n\n**Major**\n\n" + (rv.major || []).map(function (m) { return "- " + m; }).join("\n") +
        "\n\n**Minor**\n\n" + (rv.minor || []).map(function (m) { return "- " + m; }).join("\n");
      return s;
    });
    if (state.summary) out.push("## 综合评审意见\n\n" + state.summary);
    return out.join("\n\n---\n\n");
  }
  document.getElementById("pprr-export").addEventListener("click", function () {
    downloadText(buildMd(), "预投稿审稿.md", "text/markdown;charset=utf-8");
  });
  document.getElementById("pprr-export-word").addEventListener("click", function () {
    window.__dshExport.downloadDocx(buildMd(), "预投稿审稿.docx");
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

  function listHtml(arr) {
    arr = arr || [];
    if (!arr.length) return '<div class="pprr-txt">（无）</div>';
    return '<ul class="pprr-list">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  function render() {
    var body = document.getElementById("pprr-body");
    if (!state.reviews.length && !state.summary) {
      body.innerHTML = '<div class="pprr-empty">暂无审稿结果。</div>';
      return;
    }
    var html = "";
    if (state.summary) {
      html += '<div class="pprr-sum"><h4>综合评审意见</h4><div class="pprr-txt">' + esc(state.summary) + "</div></div>";
    }
    html += state.reviews.map(function (rv, i) {
      var vc = VERDICT_COLORS[rv.verdict] || "#57606a";
      return '<div class="pprr-rv">' +
        '<div class="pprr-rv-head" data-pprhead="' + i + '">' +
        '<div><div class="pprr-rv-title">' + esc(rv.reviewer || ("Reviewer " + (i + 1))) + "</div>" +
        '<div class="pprr-rv-focus">' + esc(rv.focus || "") + "</div></div>" +
        '<div class="pprr-verdict" style="color:' + vc + ';border-color:' + vc + '">' + esc(rv.verdict || "") + "</div>" +
        "</div>" +
        '<div class="pprr-rv-body">' +
        '<div class="pprr-block"><div class="pprr-lbl">总体评价</div><div class="pprr-txt">' + esc(rv.overall || "") + "</div></div>" +
        '<div class="pprr-block"><div class="pprr-lbl">主要优点</div><div class="pprr-txt">' + esc(rv.strengths || "") + "</div></div>" +
        '<div class="pprr-block"><div class="pprr-lbl">Major</div>' + listHtml(rv.major) + "</div>" +
        '<div class="pprr-block"><div class="pprr-lbl">Minor</div>' + listHtml(rv.minor) + "</div>" +
        "</div></div>";
    }).join("");
    body.innerHTML = html;
  }

  async function fetchReview() {
    try {
      var r = await fetch("/prereview-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.reviews = data.reviews || [];
      state.summary = data.summary || "";
      render();
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchReview();
  setInterval(fetchReview, POLL_MS);
})();
