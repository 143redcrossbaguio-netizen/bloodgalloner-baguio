/* ==========================================================================
   DCR common code  (Daily Collection Report) – shared by dcr.html and dcr-tracking.html
   - blood releases are read LIVE from Releasing (never copied)
   - printable form (A4 / Letter / Long bond, 0.5" margins) and Excel export
   ========================================================================== */
window.DCR = (function () {
  "use strict";

  var MON = ["JAN.","FEB.","MAR.","APR.","MAY","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];
  var MIN_ROWS = 24;
  var MODES = ["CASH","BANK TO BANK","CHEQUE","E-WALLET (G-CASH)","OTHERS"];
  var DEFAULT_SIGNERS = {
    prepared: { name: "GLYCEL BALANGGI",          title: "CHAPTER CASHIER" },
    checked:  { name: "JENNELYN TERRE",           title: "OFFICER-IN-CHARGE" },
    approved: { name: "GWENDOLEEN T. BUENAVISTA", title: "CHAPTER BOOKKEEPER" }
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v) { var n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function money(n) { return num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function arr(x) {
    if (Array.isArray(x)) return x.filter(function (v) { return v != null; });
    if (x && typeof x === "object") return Object.keys(x).sort(function (a, b) { return a - b; }).map(function (k) { return x[k]; });
    return [];
  }
  function parts(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function longDate(d)  { var p = parts(d); return p ? MON[p.m - 1] + " " + p.d + ", " + p.y : (d || ""); }
  function shortDate(d) { var p = parts(d); return p ? p.m + "/" + p.d + "/" + p.y : (d || ""); }
  /* today in Philippine time (Asia/Manila), not the browser or UTC date */
  function todayISO() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  /* OR numbers that are only digits get leading zeros up to 6 digits: 3456 -> 003456 */
  function padOr(v) { var s = String(v == null ? "" : v).trim(); return (/^\d+$/.test(s) && s.length < 6) ? s.padStart(6, "0") : s; }
  function orKey(v) { var n = parseInt(String(v == null ? "" : v).replace(/\D/g, ""), 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; }

  /* ───────────── blood releases (same computation as Releasing Tracking) ───────────── */
  function normPrices(s) {
    s = s || {};
    function f(a, b, c) { return Number(a != null ? a : (b != null ? b : c)) || 0; }
    return { WB: f(s.WB, s.wb), PRBC: f(s.PRBC, s.prbc), PC: f(s.PC, s.pc), FFP: f(s.FFP, s.ffp), CRYO: f(s.CRYO, s.cryo),
             BOX: f(s.BOX, s.boxContainer, s.box) };
  }
  function releaseLine(e, prices) {
    var p = e.priceSnapshot ? normPrices(e.priceSnapshot) : normPrices(prices);
    var total = 0, agg = {}, order = [];
    arr(e.issued).forEach(function (i) {
      var t = String(i.type || "").toUpperCase().trim(), q = Number(i.qty || 0);
      if (p[t] !== undefined) total += q * p[t];
      if (t && q > 0) { if (!(t in agg)) { agg[t] = 0; order.push(t); } agg[t] += q; }
    });
    var box = Number(e.boxContainerQty) || 0; total += box * (p.BOX || 0);
    var items = arr(e.waivedItems);
    if (!items.length && e.waivedComponent) items = [{ component: e.waivedComponent, unit: e.waivedUnit }];
    var waived = 0, wl = [];
    items.forEach(function (it) {
      var t = String(it.component || "").trim().toUpperCase(), q = Number(it.unit) || 0, key = (t === "BOX CONTAINER" || t === "BOX") ? "BOX" : t;
      if (t && q > 0) { wl.push(q + " " + t); if (p[key] !== undefined) waived += p[key] * q; }
    });
    var freight = Math.max(0, Number(e.freight) || 0), misc = Math.max(0, Number(e.misc) || 0);
    var gross = Math.max(0, r2(total - waived + freight + misc));
    var discount = Math.min(gross, Math.max(0, num(e.discount)));
    var net = Math.max(0, r2(gross - discount));
    var isW = waived > 0 || wl.length > 0 || e.waived === true;
    var desc = order.map(function (t) { return "BPF " + agg[t] + " " + t; });
    if (box > 0) desc.push(box + " BOX CONTAINER");
    var d = desc.join(", ");
    if (isW) d += net <= 0 ? " (WAIVED)" : (wl.length ? " (" + wl.join(", ") + " WAIVED)" : " (WAIVED)");
    var name = (String(e.surname || "").trim() + ((e.surname && e.firstname) ? ", " : "") + String(e.firstname || "").trim()).trim() || String(e.facility || "").trim();
    return { or: padOr(e.or), name: name.toUpperCase(), desc: d.toUpperCase(), gross: gross, discount: discount, amount: net, waived: isW };
  }

  /* one day = live releases of that date + the finance extras saved for that date */
  function buildDay(date, rels, saved, prices, defs) {
    saved = saved || {}; var meta = saved.lineMeta || {}, lines = [];
    Object.keys(rels || {}).forEach(function (id) {
      var e = rels[id]; if (!e || e.date !== date) return;
      var l = releaseLine(e, prices), m = meta[id] || {};
      l.sourceId = id; l.mode = m.mode || "CASH"; l.remarks = m.remarks || ""; lines.push(l);
    });
    arr(saved.extras).forEach(function (x) {
      var g = num(x.gross), d = Math.min(g, num(x.discount));
      lines.push({ sourceId: null, or: padOr(x.or), name: x.name || "", desc: x.desc || "", gross: g, discount: d, amount: Math.max(0, r2(g - d)), mode: x.mode || "CASH", remarks: x.remarks || "", waived: false });
    });
    return normalize({ date: date, control: saved.control || ("BAGUIO-" + String(date).slice(0, 4)), chapter: saved.chapter, note: saved.note, rows: lines, signers: saved.signers }, defs);
  }

  function normalize(rec, defs) {
    rec = rec || {};
    var rows = arr(rec.rows).map(function (r, i) {
      var gross = num(r.gross), disc = num(r.discount);
      return { sourceId: r.sourceId || null, or: padOr(r.or), name: r.name || "", desc: r.desc || "", gross: gross, discount: disc,
        amount: r.amount != null ? num(r.amount) : Math.max(0, r2(gross - disc)), mode: r.mode || "CASH", remarks: r.remarks || "", waived: !!r.waived, _i: i };
    });
    rows.sort(function (a, b) { return (orKey(a.or) - orKey(b.or)) || (a._i - b._i); });   /* ascending OR number */
    var s = rec.signers || {};
    function sg(k) {
      var d = DEFAULT_SIGNERS[k], o = s[k] || {};
      return { name: o.name != null ? o.name : d.name, title: o.title != null ? o.title : d.title,
        sig: o.sig || ((defs && defs[k] && defs[k].sig) || ""), showSig: o.showSig !== false };
    }
    return { date: rec.date || "", control: rec.control || "", chapter: rec.chapter || "BAGUIO CITY CHAPTER", note: rec.note || "", rows: rows,
      total: rows.reduce(function (a, r) { return a + r.amount; }, 0), signers: { prepared: sg("prepared"), checked: sg("checked"), approved: sg("approved") } };
  }

  /* ───────────── PRINTABLE FORM ───────────── */
  var W = [11, 8, 21, 24, 10, 12, 14];
  var W6 = W.slice(0, 6).map(function (w) { return (w / 86 * 100).toFixed(2); });
  function cg(w) { return "<colgroup>" + w.map(function (x) { return '<col style="width:' + x + '%">'; }).join("") + "</colgroup>"; }

  var CSS = "" +
    "*{box-sizing:border-box}html,body{margin:0;background:#fff}" +
    "body{font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;color:#000}" +
    ".bar{position:sticky;top:0;background:#263238;color:#fff;padding:8px 14px;display:flex;gap:10px;align-items:center;font:13px Arial;flex-wrap:wrap}" +
    ".bar b{flex:1;min-width:120px}.bar select{padding:6px;border-radius:4px}.bar button{border:0;border-radius:5px;padding:8px 16px;font-weight:bold;cursor:pointer}" +
    ".bar .p{background:#2e7d32;color:#fff}.bar .c{background:#cfd8dc}.bar small{width:100%;color:#b0bec5}" +
    ".wrap{padding:10px}.sheet{width:var(--cw,184.6mm);margin:0 auto;background:#fff}" +
    "table{border-collapse:collapse;width:100%;table-layout:fixed}" +
    "td{border:1.4px solid #000;padding:0 1.3mm;height:6.2mm;font-size:9pt;line-height:5.6mm;overflow:hidden;white-space:nowrap;vertical-align:middle}" +
    ".c{text-align:center}.b{font-weight:bold}" +
    ".dt{font-size:7.5pt;text-align:center}.or{font-size:8.5pt;text-align:center}" +
    ".nm,.ds{font-size:10pt}.sm{font-size:8pt}.xs{font-size:6.5pt}" +
    ".am{font-size:10pt;text-align:right;padding-right:1.5mm}.md{font-size:8pt}.rk{font-size:8pt}" +
    ".hd{position:relative;height:12.4mm;padding:0;line-height:1}" +
    ".hd img{position:absolute;left:1.5mm;top:1mm;height:8mm}" +
    ".hd span{position:absolute;left:0;right:0;bottom:1.2mm;text-align:center;font-weight:bold;font-size:10pt}" +
    ".tot td{font-weight:bold}" +
    ".sg{height:17mm;padding:0;text-align:center;vertical-align:middle;line-height:1}" +
    ".sg img{max-height:16mm;max-width:92%;display:inline-block}" +
    ".sgn td{font-size:8pt}" +
    ".sigtbl{width:86%;margin-top:1.4mm;page-break-inside:avoid;break-inside:avoid}" +
    ".note{width:100%;margin-top:5mm;font-size:10pt;white-space:pre-wrap;line-height:1.3;break-inside:avoid}.note b{margin-right:2mm}" +
    "@media print{.bar{display:none}.wrap{padding:0}tr{page-break-inside:avoid}}";

  function sigCell(s, cs) { return '<td class="sg"' + (cs ? ' colspan="' + cs + '"' : "") + ">" + ((s.sig && s.showSig) ? '<img src="' + esc(s.sig) + '" alt="">' : "") + "</td>"; }

  function formHtml(rec, logoUrl, printDate) {
    rec = normalize(rec);
    var pd = shortDate(printDate || todayISO()), n = Math.max(MIN_ROWS, rec.rows.length);
    var h = '<div class="sheet"><table>' + cg(W) +
      '<tr><td colspan="3" rowspan="2" class="hd">' + (logoUrl ? '<img src="' + esc(logoUrl) + '" alt="">' : "") + '<span>PHILIPPINE RED CROSS</span></td><td colspan="3"></td><td></td></tr>' +
      '<tr><td colspan="3" class="c b">DAILY COLLECTION REPORT</td><td></td></tr>' +
      '<tr><td colspan="2" class="c b">CONTROL NUMBER</td><td colspan="2" class="b">' + esc(rec.control) + '</td><td colspan="2" class="c b">DATE: ' + esc(longDate(rec.date)) + '</td><td></td></tr>' +
      '<tr><td colspan="2" class="c b">CHAPTER</td><td colspan="4" class="c b">' + esc(rec.chapter) + '</td><td></td></tr>';
    for (var i = 0; i < n; i++) {
      var r = rec.rows[i], d0 = '<td class="dt">' + (i === 0 ? esc(longDate(rec.date)) : "") + '</td>';
      if (r) {
        h += '<tr>' + d0 + '<td class="or">' + esc(r.or) + '</td><td class="nm' + (r.name.length > 23 ? " sm" : "") + '">' + esc(r.name) + '</td>' +
          '<td class="ds' + (r.desc.length > 27 ? " sm" : "") + '">' + esc(r.desc) + '</td><td class="am">' + ((r.amount || r.waived) ? money(r.amount) : "") + '</td>' +
          '<td class="md' + (r.mode.length > 9 ? " xs" : "") + '">' + esc(r.mode) + '</td><td class="rk' + (r.remarks.length > 22 ? " xs" : "") + '">' + esc(r.remarks) + '</td></tr>';
      } else h += '<tr>' + d0 + '<td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    }
    h += '<tr class="tot"><td class="c" style="font-size:8.5pt">TOTAL</td><td></td><td></td><td></td><td class="am">' + money(rec.total) + '</td><td></td><td></td></tr></table>';
    var s = rec.signers;
    h += '<table class="sigtbl">' + cg(W6) +
      '<tr><td></td><td></td><td></td><td class="b" style="font-size:8pt">CHECKED AND REVIEWED BY</td><td colspan="2"></td></tr>' +
      '<tr><td class="b" style="font-size:8pt">PREPARED BY :</td><td></td><td></td><td class="b" style="font-size:8pt">Date: ' + esc(pd) + '</td><td colspan="2" class="b" style="font-size:8pt">Date: ' + esc(pd) + '</td></tr>' +
      '<tr>' + sigCell(s.prepared, 2) + '<td class="sg"></td>' + sigCell(s.checked) + sigCell(s.approved, 2) + '</tr>' +
      '<tr class="sgn"><td colspan="2" class="c b">' + esc(s.prepared.name) + '</td><td></td><td class="c b">' + esc(s.checked.name) + '</td><td colspan="2" class="c b">' + esc(s.approved.name) + '</td></tr>' +
      '<tr class="sgn"><td colspan="2" class="c b">' + esc(s.prepared.title) + '</td><td></td><td class="c b">' + esc(s.checked.title) + '</td><td colspan="2" class="c b">' + esc(s.approved.title) + '</td></tr>' +
      '<tr><td colspan="6"></td></tr></table>';
    if (String(rec.note).trim()) h += '<div class="note"><b>NOTE:</b>' + esc(rec.note) + '</div>';
    return h + '</div>';
  }
  function logoAbs() { try { return new URL("images/logo.png", location.href).href; } catch (e) { return "images/logo.png"; } }

  function pageHtml(rec, autoPrint) {
    var name = "DCR-" + (rec.date || "");
    var js = "(function(){var P={A4:[210,297],LETTER:[215.9,279.4],LONG:[215.9,330.2]};" +
      "function ap(k){var p=P[k]||P.A4;document.getElementById('pg').textContent='@page{size:'+p[0]+'mm '+p[1]+'mm;margin:12.7mm}';document.documentElement.style.setProperty('--cw',(p[0]-25.4)+'mm');try{localStorage.setItem('dcrPaper',k)}catch(e){}}" +
      "var s=document.getElementById('paper'),k='A4';try{k=localStorage.getItem('dcrPaper')||'A4'}catch(e){}if(!P[k])k='A4';s.value=k;ap(k);s.onchange=function(){ap(s.value)};" +
      (autoPrint ? "window.addEventListener('load',function(){setTimeout(function(){window.print()},500)});" : "") + "})();";
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(name) + "</title><style>" + CSS + "</style><style id='pg'>@page{size:210mm 297mm;margin:12.7mm}</style></head><body>" +
      "<div class='bar'><b>" + esc(name) + "</b><label>Paper: <select id='paper'><option value='A4'>A4 (8.27×11.7)</option><option value='LETTER'>Letter (8.5×11)</option><option value='LONG'>Long bond (8.5×13)</option></select></label>" +
      "<button class='p' onclick='window.print()'>PRINT</button><button class='c' onclick='window.close()'>CLOSE</button>" +
      "<small>Margins are 0.5 in on all sides. In the print dialog choose Margins: Default and Scale: 100%, and the same paper size.</small></div>" +
      "<div class='wrap'>" + formHtml(rec, logoAbs(), todayISO()) + "</div><script>" + js + "<\/script></body></html>";
  }
  function openPrint(rec, autoPrint, defs) {
    var w = window.open("", "_blank");
    if (!w) { alert("The browser blocked the print window. Please allow pop-ups for this site and try again."); return; }
    w.document.open(); w.document.write(pageHtml(normalize(rec, defs), autoPrint !== false)); w.document.close();
  }

  /* ───────────── EXCEL ───────────── */
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"; s.onload = res;
      s.onerror = function () { rej(new Error("Could not load the Excel library. Please check your internet connection and try again.")); };
      document.head.appendChild(s);
    });
  }
  function blobToDataUrl(b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); }); }
  function imgSize(url) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res({ w: i.width, h: i.height }); }; i.onerror = function () { res({ w: 3, h: 1 }); }; i.src = url; }); }
  async function getLogo() {
    try {
      var r = await fetch("images/logo.png"); if (!r.ok) return null;
      var b = await r.blob(), d = await blobToDataUrl(b), sz = await imgSize(d);
      return { data: d, ext: /jpe?g/i.test(b.type) ? "jpeg" : "png", w: sz.w, h: sz.h };
    } catch (e) { return null; }
  }

  async function buildExcel(recIn, defs) {
    await loadExcelJS();
    var rec = normalize(recIn, defs), pd = shortDate(todayISO());
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet("DCR", { views: [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } } });
    ws.columns = [{ width: 14 }, { width: 11 }, { width: 30 }, { width: 32 }, { width: 13 }, { width: 18 }, { width: 24 }];
    var thin = { style: "thin", color: { argb: "FF000000" } }, B = { top: thin, left: thin, bottom: thin, right: thin };
    function put(r, c, v, o) {
      o = o || {}; var cell = ws.getCell(r, c);
      if (v !== undefined && v !== null && v !== "") cell.value = v;
      cell.font = { name: "Calibri", size: o.size || 11, bold: !!o.bold };
      cell.alignment = { horizontal: o.h || "left", vertical: o.v || "middle", wrapText: false };
      if (o.nf) cell.numFmt = o.nf; return cell;
    }
    function box(r1, c1, r2, c2) { for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) ws.getCell(r, c).border = B; }
    function merge(r1, c1, r2, c2) { ws.mergeCells(r1, c1, r2, c2); }

    ws.getRow(1).height = 24; ws.getRow(2).height = 20; ws.getRow(3).height = 18; ws.getRow(4).height = 18;
    merge(1, 1, 2, 3); put(1, 1, "PHILIPPINE RED CROSS", { bold: true, h: "center", v: "bottom" });
    merge(1, 4, 1, 6); merge(2, 4, 2, 6); put(2, 4, "DAILY COLLECTION REPORT", { bold: true, h: "center" });
    merge(3, 1, 3, 2); put(3, 1, "CONTROL NUMBER", { bold: true, h: "center" });
    merge(3, 3, 3, 4); put(3, 3, rec.control, { bold: true });
    merge(3, 5, 3, 6); put(3, 5, "DATE: " + longDate(rec.date), { bold: true, h: "center" });
    merge(4, 1, 4, 2); put(4, 1, "CHAPTER", { bold: true, h: "center" });
    merge(4, 3, 4, 6); put(4, 3, rec.chapter, { bold: true, h: "center" });
    box(1, 1, 4, 7);

    var n = Math.max(MIN_ROWS, rec.rows.length), first = 5, last = first + n - 1;
    for (var i = 0; i < n; i++) {
      var r = first + i, d = rec.rows[i]; ws.getRow(r).height = 18;
      put(r, 1, i === 0 ? longDate(rec.date) : "", { h: "center", size: 9 });
      if (d) {
        put(r, 2, d.or, { h: "center", size: 10 }); put(r, 3, d.name); put(r, 4, d.desc);
        if (d.amount || d.waived) put(r, 5, r2(d.amount), { h: "right", nf: "#,##0.00" });
        put(r, 6, d.mode, { size: 10 }); put(r, 7, d.remarks, { size: 9 });
      }
    }
    box(first, 1, last, 7);
    var tr = last + 1; ws.getRow(tr).height = 18;
    put(tr, 1, "TOTAL", { bold: true, h: "center", size: 10 });
    put(tr, 5, { formula: "SUM(E" + first + ":E" + last + ")", result: r2(rec.total) }, { bold: true, h: "right", nf: "#,##0.00" });
    box(tr, 1, tr, 7);

    var s = rec.signers, a = tr + 2;
    ws.getRow(a).height = 16; ws.getRow(a + 1).height = 16; ws.getRow(a + 2).height = 62; ws.getRow(a + 3).height = 16; ws.getRow(a + 4).height = 16; ws.getRow(a + 5).height = 16;
    put(a, 4, "CHECKED AND REVIEWED BY", { bold: true, size: 9 }); merge(a, 5, a, 6);
    put(a + 1, 1, "PREPARED BY :", { bold: true, size: 9 }); put(a + 1, 4, "Date: " + pd, { bold: true, size: 9 });
    merge(a + 1, 5, a + 1, 6); put(a + 1, 5, "Date: " + pd, { bold: true, size: 9 });
    merge(a + 2, 1, a + 2, 2); merge(a + 2, 5, a + 2, 6);
    merge(a + 3, 1, a + 3, 2); put(a + 3, 1, s.prepared.name, { bold: true, h: "center", size: 9 });
    put(a + 3, 4, s.checked.name, { bold: true, h: "center", size: 9 });
    merge(a + 3, 5, a + 3, 6); put(a + 3, 5, s.approved.name, { bold: true, h: "center", size: 9 });
    merge(a + 4, 1, a + 4, 2); put(a + 4, 1, s.prepared.title, { bold: true, h: "center", size: 9 });
    put(a + 4, 4, s.checked.title, { bold: true, h: "center", size: 9 });
    merge(a + 4, 5, a + 4, 6); put(a + 4, 5, s.approved.title, { bold: true, h: "center", size: 9 });
    merge(a + 5, 1, a + 5, 6); box(a, 1, a + 5, 6);
    if (String(rec.note).trim()) {
      ws.getRow(a + 7).height = 48; merge(a + 7, 1, a + 7, 6);
      var nc = put(a + 7, 1, "NOTE: " + rec.note, { size: 10 }); nc.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    }
    var logo = await getLogo();
    if (logo) { var lh = 34, lw = Math.round(lh * logo.w / (logo.h || 1)); ws.addImage(wb.addImage({ base64: logo.data, extension: logo.ext }), { tl: { col: 0.06, row: 0.1 }, ext: { width: lw, height: lh } }); }
    async function addSig(sg, col) {
      if (!(sg.sig && sg.showSig)) return;
      var sz = await imgSize(sg.sig), k = Math.min(190 / sz.w, 78 / sz.h, 1.6);
      ws.addImage(wb.addImage({ base64: sg.sig, extension: "png" }), { tl: { col: col, row: a + 1 + 0.04 }, ext: { width: Math.round(sz.w * k), height: Math.round(sz.h * k) } });
    }
    await addSig(s.prepared, 0.15); await addSig(s.checked, 3.12); await addSig(s.approved, 4.05);
    return wb.xlsx.writeBuffer();
  }
  function download(buf, name) {
    var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  async function downloadExcel(rec, defs) { download(await buildExcel(rec, defs), "DCR-" + (rec.date || todayISO()) + ".xlsx"); }

  return { DEFAULT_SIGNERS: DEFAULT_SIGNERS, MODES: MODES, MIN_ROWS: MIN_ROWS, esc: esc, num: num, r2: r2, money: money, arr: arr,
    longDate: longDate, shortDate: shortDate, todayISO: todayISO, padOr: padOr, orKey: orKey, normPrices: normPrices,
    releaseLine: releaseLine, buildDay: buildDay, normalize: normalize, formHtml: formHtml, pageHtml: pageHtml, openPrint: openPrint,
    buildExcel: buildExcel, downloadExcel: downloadExcel };
})();
