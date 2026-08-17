/* 分节写作右侧面板（可编辑版，DSH Web 注入脚本）
 * 交互：
 *  - 每节一个「一句话论证」输入框 + 内容总结区；
 *  - 内容总结有 3 个可编辑版本（结果1/2/3，左下按钮切换），勾选任意组合「合并」成最终结果（最右）；
 *  - 初始 3 节，底部「+ 添加一节」；
 *  - 「导出全文」按每节「最终结果」拼接为 Markdown / Word(.rtf)。
 * 编辑内容保存在 localStorage，刷新不丢。
 */
(function () {
  "use strict";
  if (window.__sectionPanelInjected) return;
  window.__sectionPanelInjected = true;

  var STORE_KEY = "research-assistant.section.draft";
  var lastUpdated = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function emptySection(n) {
    return { id: "第" + n + "节", argument: "", results: ["", "", ""], final: "", sel: [true, true, true], cur: 0 };
  }

  function defaultState() {
    return { title: "论文标题", argument: "", sections: [emptySection(1), emptySection(2), emptySection(3)] };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultState();
  }

  var state = loadState();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var CSS =
    ":root{--pp-sw:680px}" +
    "body.pp-sectiondock{margin-right:var(--pp-sw);transition:margin-right .22s ease}" +
    "body.pp-sectiondock #pp-section-toggle{display:none}" +
    "#pp-section-toggle{position:fixed;top:128px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#ea580c;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#pps-collapse{position:fixed;right:var(--pp-sw,680px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#ea580c;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-sectiondock #pps-collapse{display:block}" +
    "#pp-section-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-sw,680px);max-width:94vw;z-index:99982;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-section-panel.open{transform:translateX(0)}" +
    "#pps-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#pps-head .t{width:100%;font-size:16px;font-weight:700;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;box-sizing:border-box}" +
    "#pps-actions{position:relative;display:flex;justify-content:space-between;align-items:center;gap:8px}" +
    "#pps-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#pps-export{border:1px solid #ea580c;background:#fff;color:#ea580c;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px}" +
    "#pps-export:hover{background:#fff7ed}" +
    "#pps-export-menu{position:absolute;left:0;top:34px;border:1px solid #d0d7de;border-radius:8px;background:#fff;display:none;overflow:hidden;z-index:99987;box-shadow:0 4px 12px rgba(0,0,0,.15)}" +
    "#pps-export-menu.show{display:block}" +
    "#pps-export-menu button{display:block;width:100%;text-align:left;font-size:12px;padding:7px 14px;border:0;border-bottom:1px solid #eee;background:#fff;cursor:pointer;color:#24292f}" +
    "#pps-export-menu button:last-child{border-bottom:0}" +
    "#pps-export-menu button:hover{background:#f0f3f6}" +
    "#pps-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".pps-argbox{margin-bottom:12px}" +
    ".pps-argbox .lbl{font-size:12px;color:#ea580c;font-weight:600;margin-bottom:4px}" +
    ".pps-argbox textarea{width:100%;min-height:44px;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;box-sizing:border-box;resize:vertical;font-family:inherit}" +
    ".pps-sec{margin-bottom:14px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#fff}" +
    ".pps-sec .hd{display:flex;align-items:center;gap:6px;margin-bottom:6px}" +
    ".pps-sec .hd .nm{flex:1;font-size:13px;font-weight:700;border:1px solid #e5e7eb;border-radius:5px;padding:3px 6px;box-sizing:border-box}" +
    ".pps-sec .del{border:0;background:none;color:#b91c1c;cursor:pointer;font-size:13px}" +
    ".pps-sec textarea{width:100%;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.6}" +
    ".pps-sec .arg textarea{min-height:34px}" +
    ".pps-grid{display:flex;gap:10px;margin-top:6px}" +
    ".pps-col{flex:1;min-width:0}" +
    ".pps-col .cl{font-size:11px;color:#57606a;margin-bottom:4px}" +
    ".pps-col textarea{min-height:120px}" +
    ".pps-ver{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}" +
    ".pps-ver button{font-size:11px;border:1px solid #d0d7de;background:#fff;border-radius:5px;padding:2px 8px;cursor:pointer;color:#24292f}" +
    ".pps-ver button.on{background:#ea580c;color:#fff;border-color:#ea580c}" +
    ".pps-merge{margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
    ".pps-merge label{font-size:11px;color:#57606a;cursor:pointer}" +
    ".pps-merge button{font-size:11px;border:1px solid #ea580c;background:#fff7ed;color:#ea580c;border-radius:5px;padding:2px 8px;cursor:pointer}" +
    "#pps-add{width:100%;border:1px dashed #d0d7de;background:none;color:#ea580c;border-radius:8px;padding:8px;cursor:pointer;font-size:13px}" +
    "#pps-add:hover{background:#fff7ed}" +
    "@media (prefers-color-scheme: dark){#pp-section-panel{background:#161b22;color:#e6edf3}#pps-head{background:#1c2128;border-color:#30363d}" +
    "#pps-head .t,.pps-sec .hd .nm,.pps-argbox textarea,.pps-sec textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#pps-close{color:#8b949e}#pps-export{color:#fb923c;border-color:#ea580c;background:#161b22}#pps-export:hover{background:#1c2128}" +
    "#pps-export-menu{background:#161b22;border-color:#30363d}#pps-export-menu button{background:#161b22;color:#e6edf3;border-color:#30363d}#pps-export-menu button:hover{background:#21262d}" +
    ".pps-argbox .lbl{color:#fb923c}.pps-sec{background:#161b22;border-color:#30363d}.pps-col .cl,.pps-merge label{color:#8b949e}" +
    ".pps-ver button{background:#161b22;color:#e6edf3;border-color:#30363d}.pps-ver button.on{background:#ea580c;color:#fff;border-color:#ea580c}" +
    ".pps-merge button{background:#2a1a0a;color:#fb923c}#pps-add{color:#fb923c;border-color:#30363d}#pps-add:hover{background:#1c2128}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-section-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "分节写作面板";
  toggle.textContent = "写作";

  var collapse = document.createElement("button");
  collapse.id = "pps-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起写作面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-section-panel";
  panel.innerHTML =
    '<div id="pps-head"><input class="t" id="pps-title" type="text" placeholder="论文标题" />' +
    '<div id="pps-actions">' +
    '<button id="pps-export" type="button">导出全文</button>' +
    '<button id="pps-close" type="button" title="收起">&times;</button>' +
    '<div id="pps-export-menu">' +
    '<button type="button" data-export="md">Markdown (.md)</button>' +
    '<button type="button" data-export="docx">Word (.docx)</button>' +
    '<button type="button" data-export="latex">LaTeX (.tex)</button>' +
    '</div></div></div>' +
    '<div id="pps-body"></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function closeOthers() {
    window.__dshPanels.closeAll("pp-sectiondock", "pp-section-panel");
  }
  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-sectiondock", open);
    if (open) closeOthers();
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("pps-close").addEventListener("click", function () { setOpen(false); });

  function sectionHtml(s, i) {
    var res = s.results[s.cur] || "";
    var ver = [1, 2, 3].map(function (n) {
      return '<button type="button" data-switch="' + i + ":" + (n - 1) + '"' + (s.cur === n - 1 ? ' class="on"' : "") + ">结果" + n + "</button>";
    }).join("");
    var chk = [1, 2, 3].map(function (n) {
      var c = s.sel[n - 1] ? " checked" : "";
      return '<label><input type="checkbox" data-chk="' + i + ":" + (n - 1) + '"' + c + " />结果" + n + "</label>";
    }).join("");
    return '<div class="pps-sec" data-sec="' + i + '">' +
      '<div class="hd"><input class="nm" data-nm="' + i + '" value="' + esc(s.id) + '" /><button class="del" data-del="' + i + '" type="button">✕</button></div>' +
      '<div class="arg"><textarea data-arg="' + i + '" placeholder="一句话论证：本节要论证什么">' + esc(s.argument) + "</textarea></div>" +
      '<div class="pps-grid">' +
      '<div class="pps-col"><div class="cl">内容总结（结果' + (s.cur + 1) + "，左下切换版本）</div><textarea data-res=\"" + i + '">' + esc(res) + "</textarea>" +
      '<div class="pps-ver">' + ver + "</div></div>" +
      '<div class="pps-col"><div class="cl">最终结果（最右）</div><textarea data-fin="' + i + '">' + esc(s.final) + "</textarea>" +
      '<div class="pps-merge">' + chk +
      '<button type="button" data-merge="' + i + '">简单合并</button>' +
      '<button type="button" data-aifuse="' + i + '">AI融合(复制给AI)</button></div></div>' +
      "</div></div>";
  }

  function render() {
    document.getElementById("pps-title").value = state.title;
    var body = document.getElementById("pps-body");
    var html = '<div class="pps-argbox"><div class="lbl">整体一句话论证</div><textarea data-allarg placeholder="全文一句话论证">' + esc(state.argument) + "</textarea></div>";
    state.sections.forEach(function (s, i) { html += sectionHtml(s, i); });
    html += '<button id="pps-add" type="button">＋ 添加一节</button>';
    body.innerHTML = html;
  }

  // 事件委托
  panel.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t.id === "pps-title") { state.title = t.value; save(); return; }
    if (t.hasAttribute("data-allarg")) { state.argument = t.value; save(); return; }
    var i;
    if (t.hasAttribute("data-arg")) { i = +t.getAttribute("data-arg"); state.sections[i].argument = t.value; save(); }
    else if (t.hasAttribute("data-res")) { i = +t.getAttribute("data-res"); state.sections[i].results[state.sections[i].cur] = t.value; save(); }
    else if (t.hasAttribute("data-fin")) { i = +t.getAttribute("data-fin"); state.sections[i].final = t.value; save(); }
    else if (t.hasAttribute("data-nm")) { i = +t.getAttribute("data-nm"); state.sections[i].id = t.value; save(); }
  });

  panel.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) {
      var chk = ev.target.closest("input[type=checkbox][data-chk]");
      if (chk) {
        var p = chk.getAttribute("data-chk").split(":");
        state.sections[+p[0]].sel[+p[1]] = chk.checked;
        save();
      }
      return;
    }
    if (b.id === "pps-add") {
      state.sections.push(emptySection(state.sections.length + 1));
      save(); render();
    } else if (b.hasAttribute("data-switch")) {
      var sp = b.getAttribute("data-switch").split(":");
      state.sections[+sp[0]].cur = +sp[1];
      save(); render();
    } else if (b.hasAttribute("data-merge")) {
      var mi = +b.getAttribute("data-merge");
      var s = state.sections[mi];
      var parts = [];
      [0, 1, 2].forEach(function (n) { if (s.sel[n] && (s.results[n] || "").trim()) parts.push(s.results[n]); });
      s.final = parts.join("\n\n");
      save(); render();
    } else if (b.hasAttribute("data-aifuse")) {
      var ai = +b.getAttribute("data-aifuse");
      var as = state.sections[ai];
      var txt = "请把下面几个版本智能融合成一段（保留关键信息、消除重复、统一语气）：\n【节】" + (as.id || "") + "\n【一句话论证】" + (as.argument || "") + "\n";
      [0, 1, 2].forEach(function (n) {
        if (as.sel[n] && (as.results[n] || "").trim()) txt += "【结果" + (n + 1) + "】\n" + as.results[n] + "\n";
      });
      txt += "\n融合后请写回本节的最终结果。";
      copyText(txt);
    } else if (b.hasAttribute("data-del")) {
      var di = +b.getAttribute("data-del");
      if (state.sections.length > 1) {
        state.sections.splice(di, 1);
        save(); render();
      }
    } else if (b.id === "pps-export") {
      document.getElementById("pps-export-menu").classList.toggle("show");
    } else if (b.hasAttribute("data-export")) {
      doExport(b.getAttribute("data-export"));
    }
  });

  function finalMarkdown() {
    var lines = ["# " + state.title];
    if (state.argument) lines.push("", "> 一句话论证：" + state.argument);
    state.sections.forEach(function (s) {
      lines.push("", "## " + (s.id || ("第" + (state.sections.indexOf(s) + 1) + "节")), "");
      if (s.argument) lines.push("> 本节论证：" + s.argument, "");
      lines.push(s.final || "[待补]");
    });
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
  function finalRtf() {
    var out = ["{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Microsoft YaHei;}}\\f0"];
    out.push("{\\b\\fs32 " + rtfEsc(state.title) + "}\\par");
    if (state.argument) out.push("{\\fs24 " + rtfEsc("一句话论证：" + state.argument) + "}\\par");
    state.sections.forEach(function (s) {
      out.push("{\\b\\fs28 " + rtfEsc(s.id || "") + "}\\par");
      if (s.argument) out.push("{\\fs22 " + rtfEsc("本节论证：" + s.argument) + "}\\par");
      (s.final || "").split("\n").forEach(function (line) { if (line.trim()) out.push(rtfEsc(line) + "\\par"); });
    });
    out.push("}");
    return out.join("\n");
  }

  function downloadText(content, filename, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function copyText(text) {
    var done = function () { alert("已复制到剪贴板，粘贴到对话里发给我做 AI 融合。"); };
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
  function doExport(kind) {
    var title = (state.title || "论文").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    if (kind === "docx") window.__dshExport.downloadDocx(finalMarkdown(), title + ".docx");
    else if (kind === "latex") window.__dshExport.downloadLatex(finalMarkdown(), title + ".tex");
    else downloadText(finalMarkdown(), title + ".md", "text/markdown;charset=utf-8");
    document.getElementById("pps-export-menu").classList.remove("show");
  }

  // 尝试从服务器 panel 载入已有草稿（若无则用默认 3 节）
  function fetchPanel() {
    try {
      fetch("/section-panel.json?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { if (!r.ok) return null; return r.json(); })
        .then(function (data) {
          if (!data) return;
          if (data.updated === lastUpdated) return;
          lastUpdated = data.updated;
          var sections = (data.sections || []).map(function (s, i) {
            return {
              id: s.id || ("第" + (i + 1) + "节"),
              argument: s.argument || "",
              results: (s.results && s.results.length === 3) ? s.results : ["", "", ""],
              final: s.final || "",
              sel: [true, true, true], cur: 0,
            };
          });
          if (sections.length) {
            state.title = data.title || state.title;
            state.argument = data.argument || "";
            state.sections = sections;
            save(); render();
          }
        });
    } catch (e) {}
  }

  render();
  setOpen(true);
  fetchPanel();
})();
