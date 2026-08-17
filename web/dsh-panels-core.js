/* DSH 悬浮面板公共核心：统一管理互斥开关 + 插件总开关。
 * 必须在所有 *-panel.js 之前加载。 */
(function () {
  "use strict";
  // 所有面板的 dock body class 与面板元素 id（新增面板时在此登记即可）
  var DOCKS = [
    "pp-dock",         // 论文检索
    "pp-readdock",     // 论文精读
    "pp-reviewdock",   // 文献综述
    "pp-sectiondock",  // 分节写作
    "pp-figuredock",   // 图表生成
    "pp-citationdock", // 引文管理
    "pp-polishdock",   // 学术润色
    "pp-prereviewdock",// 预投稿审稿
    "pp-proposaldock", // 开题方案
    "pp-reformatdock"  // 格式修改
  ];
  var IDS = [
    "pp-panel",
    "pp-read-panel",
    "pp-review-panel",
    "pp-section-panel",
    "pp-figure-panel",
    "pp-citation-panel",
    "pp-polish-panel",
    "pp-prereview-panel",
    "pp-proposal-panel",
    "pp-reformat-panel"
  ];
  // 开关标签 id = 面板 id 的 "-panel" 换成 "-toggle"
  var TOGGLES = IDS.map(function (id) { return id.replace(/-panel$/, "-toggle"); });

  var CSS =
    // 任一面板打开时隐藏全部开关标签（避免叠在面板内容上）
    TOGGLES.map(function (t) { return "body.dsh-docked #" + t; }).join(",") + "{display:none}" +
    // 插件停用时隐藏全部开关标签 + 全部面板
    TOGGLES.map(function (t) { return "body.dsh-disabled #" + t; }).join(",") + "{display:none}" +
    IDS.map(function (id) { return "body.dsh-disabled #" + id; }).join(",") + "{display:none}" +
    // 插件总开关按钮（位置由 JS 动态钉到「工作区」标题下方）
    "#dsh-master{position:fixed;top:8px;left:8px;z-index:99996;border:1px solid rgba(128,128,128,.45);" +
    "background:#15803d;color:#fff;padding:8px 12px;border-radius:8px;cursor:grab;font-size:12px;" +
    "-webkit-user-select:none;user-select:none;touch-action:none;" +
    "box-shadow:0 2px 10px rgba(0,0,0,.25);white-space:nowrap;" +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif}" +
    "#dsh-master:hover{filter:brightness(1.08)}" +
    "#dsh-master.dragging{cursor:grabbing;box-shadow:0 6px 18px rgba(0,0,0,.35)}" +
    "#dsh-master .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;margin:0 0 0 4px;vertical-align:1px}" +
    "#dsh-master.off{background:#6b7280}" +
    "#dsh-master.off .dot{background:#d1d5db}" +
    // 开关动态提示气泡
    "#dsh-toast{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%) scale(.8);z-index:100000;" +
    "display:flex;align-items:center;gap:12px;padding:20px 34px;border-radius:18px;font-size:22px;font-weight:700;" +
    "color:#fff;pointer-events:none;opacity:0;box-shadow:0 16px 48px rgba(0,0,0,.45);white-space:nowrap;" +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif;" +
    "transition:opacity .3s ease, transform .3s ease}" +
    "#dsh-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}" +
    "#dsh-toast .emoji{font-size:32px;line-height:1;animation:dsh-bounce 1.2s ease-in-out infinite}" +
    "#dsh-toast.work{background:linear-gradient(135deg,#16a34a,#15803d)}" +
    "#dsh-toast.rest{background:linear-gradient(135deg,#6366f1,#4338ca)}" +
    "@keyframes dsh-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}";
  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  function syncDocked() {
    var docked = DOCKS.some(function (d) { return document.body.classList.contains(d); });
    document.body.classList.toggle("dsh-docked", docked);
  }

  // ---------- 插件总开关 ----------
  var MASTER_KEY = "dsh-research-assistant-enabled";
  function isEnabled() {
    try { return localStorage.getItem(MASTER_KEY) !== "0"; } catch (e) { return true; }
  }
  function applyEnabled(on) {
    document.body.classList.toggle("dsh-disabled", !on);
    if (!on) {
      // 停用：收起所有已打开的面板
      IDS.forEach(function (id) { var p = document.getElementById(id); if (p) p.classList.remove("open"); });
      DOCKS.forEach(function (d) { document.body.classList.remove(d); });
      syncDocked();
    }
    var btn = document.getElementById("dsh-master");
    if (btn) {
      btn.classList.toggle("off", !on);
      btn.innerHTML = '科研助手<span class="dot"></span>' + (on ? "开" : "关");
      btn.title = (on ? "科研助手已开启，点击关闭" : "科研助手已关闭，点击开启") + "；可拖动移动位置";
    }
  }

  var master = document.createElement("button");
  master.id = "dsh-master";
  master.setAttribute("type", "button");
  document.body.appendChild(master);

  // ---------- 拖动 + 位置记忆 ----------
  var POS_KEY = "dsh-research-assistant-master-pos";
  var hasCustomPos = false;
  function loadPos() {
    try {
      var v = localStorage.getItem(POS_KEY);
      if (v) {
        var p = JSON.parse(v);
        if (typeof p.x === "number" && typeof p.y === "number") return p;
      }
    } catch (e) {}
    return null;
  }
  function savePos(x, y) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: x, y: y })); } catch (e) {}
  }

  var dragging = false, dragMoved = false, startX = 0, startY = 0, offX = 0, offY = 0;
  master.addEventListener("pointerdown", function (e) {
    dragging = true;
    dragMoved = false;
    startX = e.clientX; startY = e.clientY;
    var r = master.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    try { master.setPointerCapture(e.pointerId); } catch (err) {}
    master.classList.add("dragging");
    e.preventDefault();
  });
  master.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    if (!dragMoved && (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4)) dragMoved = true;
    if (!dragMoved) return;
    var x = e.clientX - offX;
    var y = e.clientY - offY;
    var r = master.getBoundingClientRect();
    x = Math.max(0, Math.min(x, window.innerWidth - r.width));
    y = Math.max(0, Math.min(y, window.innerHeight - r.height));
    master.style.top = Math.round(y) + "px";
    master.style.left = Math.round(x) + "px";
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    master.classList.remove("dragging");
    try { master.releasePointerCapture(e.pointerId); } catch (err) {}
    if (dragMoved) {
      hasCustomPos = true;
      savePos(parseFloat(master.style.left) || 0, parseFloat(master.style.top) || 0);
    }
  }
  master.addEventListener("pointerup", endDrag);
  master.addEventListener("pointercancel", endDrag);

  master.addEventListener("click", function (e) {
    if (dragMoved) { dragMoved = false; e.preventDefault(); return; } // 拖动后不触发开关
    var off = document.body.classList.contains("dsh-disabled"); // 当前是否停用
    try { localStorage.setItem(MASTER_KEY, off ? "1" : "0"); } catch (e) {}
    applyEnabled(off); // off=true → 启用；off=false → 停用
    if (off) showToast("🚀", "开心工作！", "work");
    else showToast("😴", "好好休息！", "rest");
  });

  // ---------- 定位：默认钉到「工作区」标题下方；拖动后记住位置 ----------
  function findWorkspaceHeader() {
    var els = document.querySelectorAll("div,span,h1,h2,h3,h4,h5,h6,header,p,a,label");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length === 0 && el.textContent.trim() === "工作区") return el;
    }
    return null;
  }
  function positionMaster() {
    if (hasCustomPos) return; // 用户拖过，尊重其位置
    var h = findWorkspaceHeader();
    if (h) {
      var r = h.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        master.style.top = Math.round(r.bottom + 8) + "px";
        master.style.left = Math.round(r.left) + "px";
        return;
      }
    }
    master.style.top = "8px";
    master.style.left = "8px";
  }
  var repoTimer = null;
  function scheduleReposition() {
    if (repoTimer) return;
    repoTimer = setTimeout(function () { repoTimer = null; positionMaster(); }, 200);
  }
  window.addEventListener("resize", scheduleReposition);
  var layoutMo = new MutationObserver(scheduleReposition);
  layoutMo.observe(document.body, { childList: true, subtree: true });

  // 初始化位置：优先恢复上次拖动位置，否则钉到「工作区」下方
  var savedPos = loadPos();
  if (savedPos) {
    hasCustomPos = true;
    master.style.top = savedPos.y + "px";
    master.style.left = savedPos.x + "px";
  }
  [0, 300, 800, 1600, 3000].forEach(function (t) { setTimeout(scheduleReposition, t); });
  positionMaster();

  // 动态提示气泡
  var toast = document.createElement("div");
  toast.id = "dsh-toast";
  document.body.appendChild(toast);
  var toastTimer = null;
  function showToast(emoji, text, kind) {
    toast.className = kind;
    toast.innerHTML = '<span class="emoji">' + emoji + "</span><span>" + text + "</span>";
    toast.classList.remove("show");
    void toast.offsetWidth; // 重排以重启动画
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  if (document.body) {
    syncDocked();
    applyEnabled(isEnabled());
    if (window.MutationObserver) {
      var mo = new MutationObserver(syncDocked);
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  window.__dshPanels = {
    closeAll: function (exceptDock, exceptId) {
      DOCKS.forEach(function (d) { if (d !== exceptDock) document.body.classList.remove(d); });
      IDS.forEach(function (id) {
        if (id !== exceptId) {
          var p = document.getElementById(id);
          if (p) p.classList.remove("open");
        }
      });
      syncDocked();
    }
  };
})();
