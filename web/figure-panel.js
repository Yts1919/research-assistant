/* 图表生成右侧面板（DSH Web 注入脚本）
 * 图像生成需走服务端（浏览器不持有 API Key），故面板提供「模型选择 + 提示词」，
 * 「生成」按钮把请求复制到剪贴板，粘贴给 AI 后由 AI 调 image_gen.py 生成，
 * 结果写回 /figure-panel.json，本脚本轮询展示。
 */
(function () {
  "use strict";
  if (window.__figurePanelInjected) return;
  window.__figurePanelInjected = true;

  var POLL_MS = 2500;
  var lastUpdated = null;
  var state = { figures: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var MODELS = [
    { v: "qwen", label: "阿里云通义万相 (wanx2.1-t2i-turbo)" },
    { v: "openai", label: "OpenAI (gpt-image-1)" },
    { v: "siliconflow", label: "硅基流动 (FLUX.1-schnell)" },
  ];

  var MODES = [
    { v: "t2i", label: "文生图", hint: "文字描述（对象、风格、配色、视角）", ph: "描述要生成的画面：对象是什么、什么风格、配色、视角…" },
    { v: "img2img", label: "图生图", hint: "一张参考图 + 想改成的风格描述（图生图目前仅阿里云支持）", ph: "描述要改成什么样（并给 AI 参考图路径）…" },
    { v: "code", label: "AI代码绘图", hint: "数据（数值/表格/CSV）", ph: "提供数据（数值或 CSV 文件），说明画什么图（柱状/折线/散点/热力图）…" },
    { v: "vector", label: "矢量图", hint: "结构/组件的组成与连接关系", ph: "描述结构或示意图的组成与连接关系…" },
    { v: "flow", label: "流程图/框架图/关系图", hint: "流程步骤或节点之间的逻辑关系", ph: "列出流程步骤或节点关系（如 A→B→C，A 与 B 并列）…" },
    { v: "sim", label: "仿真图", hint: "物理模型/公式/参数", ph: "描述物理模型、公式与参数（如波传播、粒子运动、衰减曲线）…" },
  ];

  var TEMPLATES = [
    { v: "", label: "提示词模板…", text: "" },
    { v: "concept", label: "概念示意图", text: "一张科研概念示意图，展示[主题]，包含[关键元素]，蓝白配色，简洁平面风格，高分辨率" },
    { v: "mech", label: "机理图", text: "机理示意图，展示[过程/机制]的物理原理，标注[关键步骤]，矢量风格，配色简洁" },
    { v: "setup", label: "实验装置图", text: "实验装置示意图，展示[装置名称]的组成与连接关系，标注各部件名称，线稿风格" },
    { v: "cover", label: "封面图", text: "学术期刊封面图，主题[主题]，视觉冲击力强，[配色]，16:9 构图，高分辨率" },
  ];

  var CSS =
    ":root{--pp-fw:680px}" +
    "body.pp-figuredock{margin-right:var(--pp-fw);transition:margin-right .22s ease}" +
    "body.pp-figuredock #pp-figure-toggle{display:none}" +
    "#pp-figure-toggle{position:fixed;top:168px;right:0;z-index:99990;border:1px solid rgba(128,128,128,.35);border-right:0;" +
    "background:#0891b2;color:#fff;padding:10px 8px;border-radius:8px 0 0 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "#ppf-collapse{position:fixed;right:var(--pp-fw,680px);top:50%;transform:translateY(-50%);z-index:99986;display:none;" +
    "background:#0891b2;color:#fff;border:1px solid rgba(128,128,128,.35);border-right:0;border-radius:8px 0 0 8px;" +
    "padding:10px 8px;cursor:pointer;font-size:13px;box-shadow:-2px 2px 8px rgba(0,0,0,.18)}" +
    "body.pp-figuredock #ppf-collapse{display:block}" +
    "#pp-figure-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pp-fw,680px);max-width:94vw;z-index:99981;background:#fbfbfd;color:#1f2328;" +
    "box-shadow:-6px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transform:translateX(100%);transition:transform .22s ease}" +
    "#pp-figure-panel.open{transform:translateX(0)}" +
    "#ppf-head{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between}" +
    "#ppf-head h2{margin:0;font-size:16px}" +
    "#ppf-close{border:0;background:none;font-size:20px;cursor:pointer;color:#57606a;line-height:1}" +
    "#ppf-controls{padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#fff}" +
    "#ppf-controls select,#ppf-controls textarea{width:100%;box-sizing:border-box;font-size:12.5px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;margin-bottom:8px;font-family:inherit}" +
    "#ppf-hint{font-size:11px;color:#0891b2;margin-bottom:8px;line-height:1.5}" +
    "#ppf-controls textarea{min-height:70px;resize:vertical}" +
    "#ppf-gen{width:100%;border:1px solid #0891b2;background:#ecfeff;color:#0891b2;border-radius:6px;padding:7px;cursor:pointer;font-size:13px}" +
    "#ppf-gen:hover{background:#cffafe}" +
    "#ppf-body{flex:1;overflow-y:auto;padding:14px 18px}" +
    ".ppf-fig{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:12px;background:#fff}" +
    ".ppf-fig img{width:100%;border-radius:8px;display:block}" +
    ".ppf-bar{display:flex;align-items:center;gap:8px;margin-top:6px}" +
    ".ppf-dl{font-size:11px;border:1px solid #0891b2;background:#ecfeff;color:#0891b2;border-radius:5px;padding:2px 10px;text-decoration:none;cursor:pointer}" +
    ".ppf-dl:hover{background:#cffafe}" +
    ".ppf-del{font-size:11px;border:1px solid #d0d7de;background:#fff;color:#b91c1c;border-radius:5px;padding:2px 10px;text-decoration:none;cursor:pointer}" +
    ".ppf-del:hover{background:#fee2e2}" +
    ".ppf-clear{font-size:11px;border:1px solid #d0d7de;background:#fff;color:#b91c1c;border-radius:6px;padding:6px 10px;cursor:pointer}" +
    ".ppf-fmt{font-size:10px;color:#57606a;background:#f3f4f6;border-radius:4px;padding:1px 6px}" +
    ".ppf-fig .m{font-size:11px;color:#57606a;margin-top:6px;line-height:1.5}" +
    ".ppf-empty{padding:40px 20px;text-align:center;color:#8b949e;font-size:14px}" +
    "@media (prefers-color-scheme: dark){#pp-figure-panel{background:#161b22;color:#e6edf3}#ppf-head,#ppf-controls{background:#1c2128;border-color:#30363d}" +
    "#ppf-close{color:#8b949e}#ppf-controls select,#ppf-controls textarea{background:#161b22;color:#e6edf3;border-color:#30363d}" +
    "#ppf-gen{color:#67e8f9;border-color:#0891b2;background:#0b2a33}#ppf-gen:hover{background:#0d3b47}" +
    ".ppf-fig{background:#161b22;border-color:#30363d}.ppf-fig .m{color:#8b949e}.ppf-dl{color:#67e8f9;border-color:#0891b2;background:#0b2a33}.ppf-dl:hover{background:#0d3b47}.ppf-del{color:#f87171;border-color:#30363d;background:#161b22}.ppf-del:hover{background:#3a1515}.ppf-clear{color:#f87171;border-color:#30363d;background:#161b22}.ppf-fmt{color:#8b949e;background:#1f2937}.ppf-empty{color:#8b949e}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var toggle = document.createElement("button");
  toggle.id = "pp-figure-toggle";
  toggle.setAttribute("type", "button");
  toggle.title = "图表生成面板";
  toggle.textContent = "图表";

  var collapse = document.createElement("button");
  collapse.id = "ppf-collapse";
  collapse.setAttribute("type", "button");
  collapse.title = "收起图表面板";
  collapse.textContent = "收起";

  var panel = document.createElement("aside");
  panel.id = "pp-figure-panel";
  panel.innerHTML =
    '<div id="ppf-head"><h2>图表生成</h2><button id="ppf-close" type="button" title="收起">&times;</button></div>' +
    '<div id="ppf-controls">' +
    '<select id="ppf-mode">' + MODES.map(function (m) { return '<option value="' + m.v + '">' + m.label + "</option>"; }).join("") + "</select>" +
    '<div id="ppf-hint"></div>' +
    '<select id="ppf-template">' + TEMPLATES.map(function (t) { return '<option value="' + t.v + '">' + t.label + "</option>"; }).join("") + "</select>" +
    '<select id="ppf-model">' + MODELS.map(function (m) { return '<option value="' + m.v + '">' + m.label + "</option>"; }).join("") + "</select>" +
    '<select id="ppf-size"><option value="1024x1024">1:1 1024×1024</option><option value="1280x720">16:9 1280×720</option><option value="1024x768">4:3 1024×768</option><option value="768x1024">3:4 768×1024</option><option value="1440x810">16:9高清 1440×810</option></select>' +
    '<select id="ppf-format"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select>' +
    '<select id="ppf-n"><option value="1">生成 1 张</option><option value="2">2 张变体</option><option value="3">3 张变体</option><option value="4">4 张变体</option></select>' +
    '<textarea id="ppf-prompt" placeholder="描述要生成的图…"></textarea>' +
    '<div style="display:flex;gap:8px"><button id="ppf-gen" type="button">生成（复制给 AI）</button><button id="ppf-clear" type="button">清空</button></div>' +
    "</div>" +
    '<div id="ppf-body"><div class="ppf-empty">暂无生成结果。填提示词 → 点「生成」→ 粘贴给我 → 出图后展示在这里。</div></div>';

  document.body.appendChild(toggle);
  document.body.appendChild(collapse);
  document.body.appendChild(panel);

  function closeOthers() {
    window.__dshPanels.closeAll("pp-figuredock", "pp-figure-panel");
  }
  function setOpen(open) {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pp-figuredock", open);
    if (open) closeOthers();
  }
  toggle.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  collapse.addEventListener("click", function () { setOpen(false); });
  document.getElementById("ppf-close").addEventListener("click", function () { setOpen(false); });

  function updateModeHint() {
    var mode = document.getElementById("ppf-mode");
    var m = MODES.find(function (x) { return x.v === mode.value; }) || MODES[0];
    document.getElementById("ppf-hint").textContent = "本方式需要准备：" + m.hint;
    document.getElementById("ppf-prompt").placeholder = m.ph;
  }
  document.getElementById("ppf-mode").addEventListener("change", updateModeHint);
  updateModeHint();

  document.getElementById("ppf-template").addEventListener("change", function () {
    var sel = document.getElementById("ppf-template");
    var t = TEMPLATES.find(function (x) { return x.v === sel.value; });
    if (t && t.text) document.getElementById("ppf-prompt").value = t.text;
  });

  document.getElementById("ppf-clear").addEventListener("click", function () {
    copyText("请清空图表面板");
  });

  document.getElementById("ppf-body").addEventListener("click", function (ev) {
    var del = ev.target.closest("[data-delfig]");
    if (del) copyText("请删除这张图：" + del.getAttribute("data-delfig"));
  });

  document.getElementById("ppf-gen").addEventListener("click", function () {
    var mode = document.getElementById("ppf-mode");
    var model = document.getElementById("ppf-model");
    var size = document.getElementById("ppf-size");
    var format = document.getElementById("ppf-format");
    var n = document.getElementById("ppf-n");
    var prompt = document.getElementById("ppf-prompt").value.trim();
    var md = MODES.find(function (x) { return x.v === mode.value; }) || MODES[0];
    var ml = model.options[model.selectedIndex].text;
    var txt = "请生成一张图：\n【方式】" + md.label + "（需要准备：" + md.hint + "）\n【模型】" + model.value + "（" + ml + "）\n【尺寸】" + size.value + "\n【格式】" + format.value + "\n【数量】" + n.value + " 张\n【提示词/描述】" + prompt;
    copyText(txt);
  });

  function copyText(text) {
    var done = function () { alert("已复制到剪贴板，粘贴到对话里发给我生成。"); };
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

  function render() {
    var body = document.getElementById("ppf-body");
    if (!state.figures.length) {
      body.innerHTML = '<div class="ppf-empty">暂无生成结果。</div>';
      return;
    }
    body.innerHTML = state.figures.map(function (f) {
      var fname = (f.url || "").split("/").pop();
      var ext = (fname.split(".").pop() || "png").toUpperCase();
      return '<div class="ppf-fig"><img src="' + esc(f.url) + '" alt="" />' +
        '<div class="ppf-bar"><a class="ppf-dl" href="' + esc(f.url) + '" download="' + esc(fname) + '">下载</a>' +
        '<span class="ppf-fmt">' + esc(ext) + '</span>' +
        '<button class="ppf-del" type="button" data-delfig="' + esc(fname) + '">删除</button></div>' +
        '<div class="m">' + esc(f.model || "") + (f.time ? " · " + esc(f.time) : "") + "<br>" + esc(f.prompt || "") + "</div></div>";
    }).join("");
  }

  async function fetchFigure() {
    try {
      var r = await fetch("/figure-panel.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      var data = await r.json();
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      state.figures = data.figures || [];
      render();
    } catch (e) { /* 文件尚未生成，静默 */ }
  }

  render();
  fetchFigure();
  setInterval(fetchFigure, POLL_MS);
})();
