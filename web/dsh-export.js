/* DSH 悬浮面板共享导出助手：Markdown → 真 .docx（纯 JS 生成最小 ZIP）+ 通用下载。
 * 暴露 window.__dshExport = { downloadDocx(md, filename), downloadText(content, filename, mime) }
 * 必须在各 *-panel.js 之前加载（紧随 dsh-panels-core.js）。
 */
(function () {
  "use strict";
  if (window.__dshExport) return;

  // ---------- UTF-8 / CRC32 / ZIP(stored) ----------
  function utf8(s) { return new TextEncoder().encode(s); }

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) crc = CRC_TABLE[(crc ^ b[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // 生成“仅存储(不压缩)”的 ZIP 文件（docx 内部文件名全 ASCII，无需 UTF-8 标志）
  function zipStore(files) {
    var enc = new TextEncoder();
    var local = [], central = [], offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nb = enc.encode(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);

      var lh = new Uint8Array(30 + nb.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);          // version needed
      dv.setUint16(6, 0, true);           // flags
      dv.setUint16(8, 0, true);           // method: stored
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nb.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nb, 30);
      local.push(lh, data);

      var ch = new Uint8Array(46 + nb.length);
      dv = new DataView(ch.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, 0, true);
      dv.setUint32(16, crc, true);
      dv.setUint32(20, data.length, true);
      dv.setUint32(24, data.length, true);
      dv.setUint16(28, nb.length, true);
      dv.setUint32(42, offset, true);
      ch.set(nb, 46);
      central.push(ch);
      offset += 30 + nb.length + data.length;
    }
    var csize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true);
    dv.setUint16(8, files.length, true);
    dv.setUint16(10, files.length, true);
    dv.setUint32(12, csize, true);
    dv.setUint32(16, offset, true);

    var out = new Uint8Array(offset + csize + 22);
    var pos = 0;
    for (var j = 0; j < local.length; j++) { out.set(local[j], pos); pos += local[j].length; }
    for (var k = 0; k < central.length; k++) { out.set(central[k], pos); pos += central[k].length; }
    out.set(eocd, pos);
    return out;
  }

  // ---------- Markdown → WordprocessingML ----------
  function escXml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function inlineRuns(text) {
    var out = [];
    var re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      var tok = m[0];
      if (tok[0] === "*" && tok[1] === "*") out.push({ t: tok.slice(2, -2), b: true });
      else if (tok[0] === "`") out.push({ t: tok.slice(1, -1), i: true });
      else out.push({ t: tok.slice(1, -1), i: true });
      last = m.index + tok.length;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  }
  function runXml(r) {
    var pr = r.b ? "<w:b/>" : (r.i ? "<w:i/>" : "");
    return "<w:r>" + (pr ? "<w:rPr>" + pr + "</w:rPr>" : "") +
      '<w:t xml:space="preserve">' + escXml(r.t) + "</w:t></w:r>";
  }
  function paraXml(runs, style) {
    var ppr = style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : "";
    return "<w:p>" + ppr + runs.map(runXml).join("") + "</w:p>";
  }
  function mdToBody(md) {
    var lines = String(md || "").split(/\r?\n/);
    var ps = [];
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].replace(/\s+$/, "");
      if (!s.trim()) continue;
      var hm = s.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { ps.push(paraXml(inlineRuns(hm[2]), "Heading" + hm[1].length)); continue; }
      if (/^\s*([-*_]\s*){3,}$/.test(s)) continue; // 水平线
      var lm = s.match(/^\s*([-*+]|\d{1,3}[.)])\s+(.*)$/);
      if (lm) {
        var marker = /^[-*+]$/.test(lm[1]) ? "\u2022 " : (lm[1].replace(/[.)]$/, "") + ". ");
        ps.push(paraXml(inlineRuns(marker + lm[2]), null));
        continue;
      }
      ps.push(paraXml(inlineRuns(s), null));
    }
    return ps.join("");
  }
  function documentXml(md) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + mdToBody(md) +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/>' +
      "</w:sectPr></w:body></w:document>";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function downloadText(content, filename, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  function downloadDocx(md, filename) {
    var files = [
      { name: "[Content_Types].xml", data: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>") },
      { name: "_rels/.rels", data: utf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>") },
      { name: "word/document.xml", data: utf8(documentXml(md)) },
    ];
    var zip = zipStore(files);
    var blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    downloadBlob(blob, filename);
  }

  // ---------- Markdown → LaTeX ----------
  function latexEsc(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/[&%$#_{}]/g, function (c) { return "\\" + c; })
      .replace(/~/g, "\\textasciitilde{}")
      .replace(/\^/g, "\\textasciicircum{}");
  }
  function latexInline(s) {
    var out = "";
    var re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
    var last = 0, m;
    while ((m = re.exec(s))) {
      out += latexEsc(s.slice(last, m.index));
      var tok = m[0];
      if (tok[0] === "*" && tok[1] === "*") out += "\\textbf{" + latexEsc(tok.slice(2, -2)) + "}";
      else if (tok[0] === "`") out += "\\texttt{" + latexEsc(tok.slice(1, -1)) + "}";
      else out += "\\emph{" + latexEsc(tok.slice(1, -1)) + "}";
      last = m.index + tok.length;
    }
    out += latexEsc(s.slice(last));
    return out;
  }
  function markdownToLatex(md) {
    var lines = String(md || "").split(/\r?\n/);
    var out = ["\\documentclass[11pt]{article}", "\\usepackage[UTF8]{ctex}", "\\usepackage{geometry}", "\\geometry{a4paper,margin=1in}", "\\begin{document}", ""];
    var inList = null;
    function closeList() { if (inList) { out.push("\\end{" + inList + "}"); inList = null; } }
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].replace(/\s+$/, "");
      var hm = s.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        closeList();
        var lvl = hm[1].length;
        if (lvl === 1) out.push("\\section*{" + latexEsc(hm[2]) + "}");
        else if (lvl === 2) out.push("\\subsection*{" + latexEsc(hm[2]) + "}");
        else out.push("\\textbf{" + latexEsc(hm[2]) + "}");
        out.push("");
        continue;
      }
      if (!s.trim()) { closeList(); continue; }
      if (/^\s*([-*_]\s*){3,}$/.test(s)) { closeList(); continue; }
      var lm = s.match(/^\s*([-*+]|\d{1,3}[.)])\s+(.*)$/);
      if (lm) {
        var env = /^\d/.test(lm[1]) ? "enumerate" : "itemize";
        if (inList !== env) { closeList(); out.push("\\begin{" + env + "}"); inList = env; }
        out.push("  \\item " + latexInline(lm[2]));
        continue;
      }
      closeList();
      out.push(latexInline(s));
      out.push("");
    }
    closeList();
    out.push("\\end{document}");
    return out.join("\n");
  }
  function downloadLatex(md, filename) {
    downloadText(markdownToLatex(md), filename, "application/x-tex;charset=utf-8");
  }

  window.__dshExport = {
    downloadDocx: downloadDocx,
    downloadText: downloadText,
    downloadLatex: downloadLatex,
  };
})();
