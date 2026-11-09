/* ==========================================================================
   DCR common code  (Daily Collection Report)
   Shared by dcr.html and dcr-tracking.html
   - printable form (copy of the Baguio City Chapter paper DCR)
   - Excel export  (file name: DCR-YYYY-MM-DD.xlsx)
   ========================================================================== */
window.DCR = (function () {
  "use strict";

  var MON = ["JAN.","FEB.","MAR.","APR.","MAY","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];
  var MIN_ROWS = 24; /* the paper form has 24 lines */
  var MODES = ["CASH","BANK TO BANK","CHEQUE","E-WALLET (G-CASH)","OTHERS"];
  function orKey(v) { var n = parseInt(String(v == null ? "" : v).replace(/\D/g, ""), 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; }

  var DEFAULT_SIGNERS = {
    prepared: { name: "GLYCEL BALANGGI",          title: "CHAPTER CASHIER" },
    checked:  { name: "JENNELYN TERRE",           title: "OFFICER-IN-CHARGE" },
    approved: { name: "GWENDOLEEN T. BUENAVISTA", title: "CHAPTER BOOKKEEPER" }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function num(v) { var n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function money(n) { return num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function arr(x) {
    if (Array.isArray(x)) return x.filter(function (v) { return v != null; });
    if (x && typeof x === "object") return Object.keys(x).sort(function (a, b) { return a - b; }).map(function (k) { return x[k]; });
    return [];
  }
  function parts(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function longDate(d)  { var p = parts(d); return p ? MON[p.m - 1] + " " + p.d + ", " + p.y : (d || ""); }  /* NOV. 6, 2026 */
  function shortDate(d) { var p = parts(d); return p ? p.m + "/" + p.d + "/" + p.y : (d || ""); }           /* 11/6/2026   */
  function todayISO() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }

  /* make a saved record safe to use (Firebase turns arrays/empty values into odd shapes) */
  function normalize(rec, defs) {
    rec = rec || {};
    var rows = arr(rec.rows).map(function (r) {
      var gross = num(r.gross), disc = num(r.discount);
      return {
        sourceId: r.sourceId || null,
        or: r.or || "", name: r.name || "", desc: r.desc || "",
        gross: gross, discount: disc,
        amount: r.amount != null ? num(r.amount) : Math.max(0, r2(gross - disc)),
        mode: r.mode || "CASH", _i: 0
      };
    });
    rows.forEach(function (r, i) { r._i = i; });
    rows.sort(function (a, b) { return (orKey(a.or) - orKey(b.or)) || (a._i - b._i); });   /* ascending OR number */
    var s = rec.signers || {};
    function sg(k) {
      var d = DEFAULT_SIGNERS[k], o = s[k] || {};
      return {
        name: o.name != null ? o.name : d.name,
        title: o.title != null ? o.title : d.title,
        sig: o.sig || ((defs && defs[k] && defs[k].sig) || ""),
        showSig: o.showSig !== false
      };
    }
    return {
      date: rec.date || "", control: rec.control || "", chapter: rec.chapter || "BAGUIO CITY CHAPTER",
      remarks: rec.remarks || "", note: rec.note || "", rows: rows,
      total: rows.reduce(function (a, r) { return a + r.amount; }, 0),
      signers: { prepared: sg("prepared"), checked: sg("checked"), approved: sg("approved") },
      updatedAt: rec.updatedAt || null, updatedBy: rec.updatedBy || ""
    };
  }

  /* ───────────────────────── PRINTABLE FORM ───────────────────────── */
  var W = [12, 9, 23, 26, 11, 12, 7];                  /* column widths, % */
  var W6 = W.slice(0, 6).map(function (w) { return (w / 93 * 100).toFixed(2); });

  function cg(widths) { return "<colgroup>" + widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join("") + "</colgroup>"; }

  var CSS = "" +
    "@page{size:A4 portrait;margin:8mm}" +
    "*{box-sizing:border-box}" +
    "html,body{margin:0;background:#fff}" +
    "body{font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;color:#000}" +
    ".bar{position:sticky;top:0;background:#263238;color:#fff;padding:8px 14px;display:flex;gap:8px;align-items:center;font:14px Arial}" +
    ".bar b{flex:1}.bar button{border:0;border-radius:5px;padding:8px 16px;font-weight:bold;cursor:pointer}" +
    ".bar .p{background:#2e7d32;color:#fff}.bar .c{background:#cfd8dc}" +
    ".wrap{padding:10px}" +
    ".sheet{width:194mm;margin:0 auto;background:#fff}" +
    "table{border-collapse:collapse;width:100%;table-layout:fixed}" +
    "td{border:1.4px solid #000;padding:0 1.4mm;height:6.2mm;font-size:9pt;line-height:5.6mm;overflow:hidden;white-space:nowrap;vertical-align:middle}" +
    ".c{text-align:center}.r{text-align:right}.b{font-weight:bold}" +
    ".dt{font-size:7.5pt;text-align:center}.or{font-size:8.5pt;text-align:center}" +
    ".nm,.ds{font-size:10pt}.sm{font-size:8pt}" +
    ".am{font-size:10pt;text-align:right;padding-right:1.6mm}.md{font-size:8pt}.md.xs{font-size:6.3pt}" +
    ".hd{position:relative;height:12.4mm;padding:0;line-height:1}" +
    ".hd img{position:absolute;left:1.5mm;top:1mm;height:8mm}" +
    ".hd span{position:absolute;left:0;right:0;bottom:1.2mm;text-align:center;font-weight:bold;font-size:10pt}" +
    ".tot td{font-weight:bold}" +
    ".rmbox{width:93%;border:1.4px solid #000;margin-top:1.4mm;min-height:17mm;padding:1mm 2mm;font-size:9.5pt;line-height:1.25;white-space:pre-wrap;break-inside:avoid}" +
    ".rmbox b{font-size:8.5pt;margin-right:2mm}" +
    ".sg{height:17mm;padding:0;text-align:center;vertical-align:middle;line-height:1}" +
    ".sg img{max-height:16mm;max-width:92%;display:inline-block}" +
    ".sgn td{font-size:8pt}" +
    ".sigtbl{width:93%;margin-top:1.4mm;page-break-inside:avoid;break-inside:avoid}" +
    ".note{width:100%;margin-top:5mm;font-size:10pt;white-space:pre-wrap;line-height:1.3;break-inside:avoid}" +
    ".note b{margin-right:2mm}" +
    "@media print{.bar{display:none}.wrap{padding:0}tr{page-break-inside:avoid}}";

  function sigCell(s, colspan) {
    var img = (s.sig && s.showSig) ? '<img src="' + esc(s.sig) + '" alt="">' : "";
    return '<td class="sg"' + (colspan ? ' colspan="' + colspan + '"' : "") + ">" + img + "</td>";
  }

  /* the form only (no page chrome); printDate = date it is printed / downloaded */
  function formHtml(rec, logoUrl, printDate) {
    rec = normalize(rec);
    var pd = shortDate(printDate || todayISO());
    var n = Math.max(MIN_ROWS, rec.rows.length);
    var h = '<div class="sheet"><table>' + cg(W) +
      '<tr><td colspan="3" rowspan="2" class="hd">' + (logoUrl ? '<img src="' + esc(logoUrl) + '" alt="">' : "") + '<span>PHILIPPINE RED CROSS</span></td>' +
      '<td colspan="3"></td><td></td></tr>' +
      '<tr><td colspan="3" class="c b">DAILY COLLECTION REPORT</td><td></td></tr>' +
      '<tr><td colspan="2" class="c b">CONTROL NUMBER</td><td colspan="2" class="b">' + esc(rec.control) + '</td>' +
      '<td colspan="2" class="c b">DATE: ' + esc(longDate(rec.date)) + '</td><td></td></tr>' +
      '<tr><td colspan="2" class="c b">CHAPTER</td><td colspan="4" class="c b">' + esc(rec.chapter) + '</td><td></td></tr>';
    for (var i = 0; i < n; i++) {
      var r = rec.rows[i];
      var d0 = '<td class="dt">' + (i === 0 ? esc(longDate(rec.date)) : "") + '</td>';
      if (r) {
        var nmC = r.name.length > 23 ? " sm" : "", dsC = r.desc.length > 27 ? " sm" : "", mdC = r.mode.length > 9 ? " xs" : "";
        h += '<tr>' + d0 + '<td class="or">' + esc(r.or) + '</td>' +
          '<td class="nm' + nmC + '">' + esc(r.name) + '</td><td class="ds' + dsC + '">' + esc(r.desc) + '</td>' +
          '<td class="am">' + (r.amount ? money(r.amount) : "") + '</td><td class="md' + mdC + '">' + esc(r.mode) + '</td><td></td></tr>';
      } else {
        h += '<tr>' + d0 + '<td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      }
    }
    h += '<tr class="tot"><td class="c" style="font-size:8.5pt">TOTAL</td><td></td><td></td><td></td><td class="am">' + money(rec.total) + '</td><td></td><td></td></tr></table>' +
      '<div class="rmbox"><b>REMARKS:</b>' + esc(rec.remarks) + '</div>';
    var s = rec.signers;
    h += '<table class="sigtbl">' + cg(W6) +
      '<tr><td></td><td></td><td></td><td class="b" style="font-size:8pt">CHECKED AND REVIEWED BY</td><td colspan="2"></td></tr>' +
      '<tr><td class="b" style="font-size:8pt">PREPARED BY :</td><td></td><td></td>' +
      '<td class="b" style="font-size:8pt">Date: ' + esc(pd) + '</td>' +
      '<td colspan="2" class="b" style="font-size:8pt">Date: ' + esc(pd) + '</td></tr>' +
      '<tr>' + sigCell(s.prepared, 2) + '<td class="sg"></td>' + sigCell(s.checked) + sigCell(s.approved, 2) + '</tr>' +
      '<tr class="sgn"><td colspan="2" class="c b">' + esc(s.prepared.name) + '</td><td></td><td class="c b">' + esc(s.checked.name) + '</td><td colspan="2" class="c b">' + esc(s.approved.name) + '</td></tr>' +
      '<tr class="sgn"><td colspan="2" class="c b">' + esc(s.prepared.title) + '</td><td></td><td class="c b">' + esc(s.checked.title) + '</td><td colspan="2" class="c b">' + esc(s.approved.title) + '</td></tr>' +
      '<tr><td colspan="6"></td></tr></table>';
    if (String(rec.note).trim()) h += '<div class="note"><b>NOTE:</b>' + esc(rec.note) + '</div>';
    return h + '</div>';
  }

  function logoAbs() { try { return new URL("images/logo.png", location.href).href; } catch (e) { return "images/logo.png"; } }

  function pageHtml(rec, autoPrint) {   /* rec is already normalized */
    var name = "DCR-" + (rec.date || "");
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(name) + "</title><style>" + CSS + "</style></head><body>" +
      "<div class='bar'><b>" + esc(name) + "</b><button class='p' onclick='window.print()'>PRINT</button><button class='c' onclick='window.close()'>CLOSE</button></div>" +
      "<div class='wrap'>" + formHtml(rec, logoAbs(), todayISO()) + "</div>" +
      (autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})<\/script>" : "") +
      "</body></html>";
  }

  /* opens the printable DCR in a new tab (Print dialog opens by itself when autoPrint is true) */
  function openPrint(rec, autoPrint, defs) {
    var w = window.open("", "_blank");
    if (!w) { alert("The browser blocked the print window. Please allow pop-ups for this site and try again."); return; }
    w.document.open(); w.document.write(pageHtml(normalize(rec, defs), autoPrint !== false)); w.document.close();
  }

  /* ───────────────────────── EXCEL ───────────────────────── */
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      s.onload = res;
      s.onerror = function () { rej(new Error("Could not load the Excel library. Please check your internet connection and try again.")); };
      document.head.appendChild(s);
    });
  }
  function blobToDataUrl(b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); }); }
  function imgSize(url) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res({ w: i.width, h: i.height }); }; i.onerror = function () { res({ w: 3, h: 1 }); }; i.src = url; }); }
  async function getLogo() {
    try {
      var r = await fetch("images/logo.png"); if (!r.ok) return null;
      var b = await r.blob(); var d = await blobToDataUrl(b);
      var sz = await imgSize(d);
      return { data: d, ext: /jpe?g/i.test(b.type) ? "jpeg" : "png", w: sz.w, h: sz.h };
    } catch (e) { return null; }
  }

  async function buildExcel(recIn, defs) {
    await loadExcelJS();
    var rec = normalize(recIn, defs);
    var pd = shortDate(todayISO());
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet("DCR", {
      views: [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
    });
    ws.columns = [{ width: 17 }, { width: 12 }, { width: 34 }, { width: 34 }, { width: 15 }, { width: 19 }, { width: 8 }];
    var thin = { style: "thin", color: { argb: "FF000000" } };
    var B = { top: thin, left: thin, bottom: thin, right: thin };
    var LET = "ABCDEFG";
    function put(r, c, v, o) {
      o = o || {};
      var cell = ws.getCell(r, c);
      if (v !== undefined && v !== null && v !== "") cell.value = v;
      cell.font = { name: "Calibri", size: o.size || 11, bold: !!o.bold };
      cell.alignment = { horizontal: o.h || "left", vertical: o.v || "middle", wrapText: false, indent: o.h === "left" || !o.h ? 0 : 0 };
      if (o.nf) cell.numFmt = o.nf;
      return cell;
    }
    function box(r1, c1, r2, c2) {
      for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) ws.getCell(r, c).border = B;
    }
    function merge(r1, c1, r2, c2) { ws.mergeCells(r1, c1, r2, c2); }

    /* header */
    ws.getRow(1).height = 24; ws.getRow(2).height = 20; ws.getRow(3).height = 18; ws.getRow(4).height = 18;
    merge(1, 1, 2, 3); put(1, 1, "PHILIPPINE RED CROSS", { bold: true, h: "center", v: "bottom", size: 11 });
    merge(1, 4, 1, 6);
    merge(2, 4, 2, 6); put(2, 4, "DAILY COLLECTION REPORT", { bold: true, h: "center" });
    merge(3, 1, 3, 2); put(3, 1, "CONTROL NUMBER", { bold: true, h: "center" });
    merge(3, 3, 3, 4); put(3, 3, rec.control, { bold: true });
    merge(3, 5, 3, 6); put(3, 5, "DATE: " + longDate(rec.date), { bold: true, h: "center" });
    merge(4, 1, 4, 2); put(4, 1, "CHAPTER", { bold: true, h: "center" });
    merge(4, 3, 4, 6); put(4, 3, rec.chapter, { bold: true, h: "center" });
    box(1, 1, 4, 7);

    /* lines */
    var n = Math.max(MIN_ROWS, rec.rows.length), first = 5, last = first + n - 1;
    for (var i = 0; i < n; i++) {
      var r = first + i, d = rec.rows[i];
      ws.getRow(r).height = 18;
      put(r, 1, i === 0 ? longDate(rec.date) : "", { h: "center", size: 9 });
      if (d) {
        put(r, 2, d.or, { h: "center", size: 10 });
        put(r, 3, d.name, { size: 11 });
        put(r, 4, d.desc, { size: 11 });
        if (d.amount) put(r, 5, r2(d.amount), { h: "right", nf: "#,##0.00" });
        put(r, 6, d.mode, { size: 10 });
      }
    }
    box(first, 1, last, 7);
    var tr = last + 1; ws.getRow(tr).height = 18;
    put(tr, 1, "TOTAL", { bold: true, h: "center", size: 10 });
    var tc = put(tr, 5, { formula: "SUM(E" + first + ":E" + last + ")", result: r2(rec.total) }, { bold: true, h: "right", nf: "#,##0.00" });
    box(tr, 1, tr, 7);

    /* remarks (bordered box, filled in or left blank) */
    var rr = tr + 1;
    for (var q = 0; q < 3; q++) ws.getRow(rr + q).height = 18;
    merge(rr, 1, rr + 2, 6);
    var rc = put(rr, 1, "REMARKS: " + rec.remarks, { bold: false, size: 10, v: "top" });
    rc.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    box(rr, 1, rr + 2, 6);

    /* signatures */
    var s = rec.signers, a = rr + 3;
    ws.getRow(a).height = 16; ws.getRow(a + 1).height = 16; ws.getRow(a + 2).height = 62; ws.getRow(a + 3).height = 16; ws.getRow(a + 4).height = 16; ws.getRow(a + 5).height = 16;
    put(a, 4, "CHECKED AND REVIEWED BY", { bold: true, size: 9 }); merge(a, 5, a, 6);
    put(a + 1, 1, "PREPARED BY :", { bold: true, size: 9 });
    put(a + 1, 4, "Date: " + pd, { bold: true, size: 9 });
    merge(a + 1, 5, a + 1, 6); put(a + 1, 5, "Date: " + pd, { bold: true, size: 9 });
    merge(a + 2, 1, a + 2, 2); merge(a + 2, 5, a + 2, 6);
    merge(a + 3, 1, a + 3, 2); put(a + 3, 1, s.prepared.name, { bold: true, h: "center", size: 9 });
    put(a + 3, 4, s.checked.name, { bold: true, h: "center", size: 9 });
    merge(a + 3, 5, a + 3, 6); put(a + 3, 5, s.approved.name, { bold: true, h: "center", size: 9 });
    merge(a + 4, 1, a + 4, 2); put(a + 4, 1, s.prepared.title, { bold: true, h: "center", size: 9 });
    put(a + 4, 4, s.checked.title, { bold: true, h: "center", size: 9 });
    merge(a + 4, 5, a + 4, 6); put(a + 4, 5, s.approved.title, { bold: true, h: "center", size: 9 });
    merge(a + 5, 1, a + 5, 6);
    box(a, 1, a + 5, 6);

    /* note: only when there is one */
    if (String(rec.note).trim()) {
      ws.getRow(a + 7).height = 48; merge(a + 7, 1, a + 7, 6);
      var nc = put(a + 7, 1, "NOTE: " + rec.note, { size: 10 });
      nc.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    }

    /* images: logo + e-signatures */
    var logo = await getLogo();
    if (logo) {
      var lh = 34, lw = Math.round(lh * logo.w / (logo.h || 1));
      ws.addImage(wb.addImage({ base64: logo.data, extension: logo.ext }), { tl: { col: 0.06, row: 0.1 }, ext: { width: lw, height: lh } });
    }
    async function addSig(sg, colIdx, boxW, boxH) {
      if (!(sg.sig && sg.showSig)) return;
      var sz = await imgSize(sg.sig), k = Math.min(boxW / sz.w, boxH / sz.h, 1.6);
      var w = Math.round(sz.w * k), h = Math.round(sz.h * k);
      ws.addImage(wb.addImage({ base64: sg.sig, extension: "png" }), { tl: { col: colIdx, row: a + 1 + 0.04 }, ext: { width: w, height: h } });
    }
    await addSig(s.prepared, 0.15, 190, 78);
    await addSig(s.checked, 3.12, 190, 78);
    await addSig(s.approved, 4.05, 190, 78);

    return wb.xlsx.writeBuffer();
  }

  function download(buf, name) {
    var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  async function downloadExcel(rec, defs) {
    var buf = await buildExcel(rec, defs);
    download(buf, "DCR-" + (rec.date || todayISO()) + ".xlsx");
  }

  return {
    DEFAULT_SIGNERS: DEFAULT_SIGNERS, MIN_ROWS: MIN_ROWS, MODES: MODES, orKey: orKey,
    esc: esc, num: num, r2: r2, money: money, arr: arr, longDate: longDate, shortDate: shortDate, todayISO: todayISO,
    normalize: normalize, formHtml: formHtml, pageHtml: pageHtml, openPrint: openPrint,
    buildExcel: buildExcel, downloadExcel: downloadExcel, CSS: CSS
  };
})();
