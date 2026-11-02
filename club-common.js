/* =====================================================================
   Galloners Club - SHARED HELPERS  (club-common.js)
   Used by: index, dashboard, settings, admin-manager, awardees,
            donor-entry, tracking

   What it gives every page:
   1. Toast messages     - alert() no longer freezes the screen (esp. on phones)
   2. Safe navigation    - "back to login/dashboard" works inside the dashboard
                           frame instead of opening a page inside a page
   3. Category limits    - ONE place that reads the limits saved in Settings
   4. CSV / escaping     - safe export and safe HTML helpers
   ===================================================================== */
(function () {
  "use strict";

  var DEFAULT_LIMITS = { galloner: 8, bronze: 28, silver: 46, gold: 70 };
  var LIMITS_KEY = "categoryLimits";

  /* ---------- are we inside the dashboard's frame? ---------- */
  var inFrame = false;
  try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
  document.documentElement.classList.add(inFrame ? "in-frame" : "standalone");

  /* ---------- html safety ---------- */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- toasts ---------- */
  var toastCss = ".clubToasts{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));z-index:100000;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 12px;pointer-events:none}" +
    ".clubToast{pointer-events:auto;max-width:min(520px,100%);width:max-content;background:#1f2937;color:#fff;border-radius:12px;padding:11px 16px;font:600 14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);border-left:6px solid #64748b;cursor:pointer;animation:clubToastIn .18s ease-out;word-break:break-word}" +
    ".clubToast.success{border-left-color:#22c55e}.clubToast.error{border-left-color:#ef4444;background:#7f1d1d}.clubToast.warn{border-left-color:#f59e0b}" +
    "@keyframes clubToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
    "@media print{.clubToasts{display:none!important}}";
  function ensureToastBox() {
    if (!document.getElementById("clubToastCss")) {
      var s = document.createElement("style"); s.id = "clubToastCss"; s.textContent = toastCss;
      (document.head || document.documentElement).appendChild(s);
    }
    var box = document.getElementById("clubToasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "clubToasts"; box.className = "clubToasts";
      box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
      (document.body || document.documentElement).appendChild(box);
    }
    return box;
  }
  function toast(message, type, ms) {
    if (!document.body) { document.addEventListener("DOMContentLoaded", function () { toast(message, type, ms); }); return; }
    var box = ensureToastBox();
    while (box.children.length >= 4) box.removeChild(box.firstChild);
    var t = document.createElement("div");
    t.className = "clubToast " + (type || "info");
    t.textContent = String(message == null ? "" : message);
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    t.addEventListener("click", close);
    box.appendChild(t);
    var life = ms || (type === "error" ? 8000 : type === "warn" ? 6000 : 3800);
    setTimeout(close, life);
    return t;
  }
  function guessType(msg) {
    var m = String(msg == null ? "" : msg).toLowerCase();
    if (/(^|\b)(please|enter|select|choose|add at least|fill)\b/.test(m)) return "warn";
    if (/error|fail|invalid|denied|unable|expired|cannot|can't|not logged|no access|do not have access|too weak|already exists|not found|taking too long/.test(m)) return "error";
    if (/success|saved|updated|created|deleted|removed|merged|complete|downloaded|logged out|rebuilt/.test(m)) return "success";
    return "info";
  }
  /* alert() still works everywhere, but as a non-blocking toast */
  if (!window.__KEEP_NATIVE_ALERT) {
    window.alert = function (m) { toast(m, guessType(m)); };
  }

  /* ---------- navigation that is safe inside the dashboard frame ---------- */
  function gotoLogin() {
    try { window.top.location.href = "index.html"; } catch (e) { window.location.href = "index.html"; }
  }
  function goDashboard() {
    if (inFrame) {
      try { if (window.top && typeof window.top.goDashboardHome === "function") { window.top.goDashboardHome(); return; } } catch (e) { /* cross-origin: fall through */ }
      try { window.top.location.href = "dashboard.html"; return; } catch (e2) { /* ignore */ }
    }
    window.location.href = "dashboard.html";
  }

  /* ---------- category limits (set on the Settings page) ---------- */
  function sanitizeLimits(o) {
    if (!o) return null;
    var g = Number(o.galloner), b = Number(o.bronze), s = Number(o.silver), gd = Number(o.gold);
    var ok = [g, b, s, gd].every(function (n) { return isFinite(n) && n >= 1 && Math.floor(n) === n; });
    if (ok && g < b && b < s && s < gd) return { galloner: g, bronze: b, silver: s, gold: gd };
    return null;
  }
  function cachedLimits() {
    try {
      var l = sanitizeLimits(JSON.parse(localStorage.getItem(LIMITS_KEY)));
      if (l) return l;
    } catch (e) { /* ignore */ }
    return { galloner: DEFAULT_LIMITS.galloner, bronze: DEFAULT_LIMITS.bronze, silver: DEFAULT_LIMITS.silver, gold: DEFAULT_LIMITS.gold };
  }
  function saveLimitsCache(l) {
    try { localStorage.setItem(LIMITS_KEY, JSON.stringify(l)); } catch (e) { /* storage full / private mode */ }
  }
  /* db = firebase.firestore() (compat). Never throws: falls back to the last known limits. */
  async function loadLimits(db) {
    try {
      var snap = await db.collection("settings").doc("categoryLimits").get();
      if (snap.exists) {
        var l = sanitizeLimits(snap.data());
        if (l) { saveLimitsCache(l); return l; }
      }
    } catch (e) { console.warn("Could not read category limits, using saved copy:", e && e.message); }
    return cachedLimits();
  }
  function levelFor(count, limits) {
    limits = limits || cachedLimits();
    if (count >= limits.gold) return "gold";
    if (count >= limits.silver) return "silver";
    if (count >= limits.bronze) return "bronze";
    if (count >= limits.galloner) return "galloner";
    return "none";
  }

  /* ---------- csv ---------- */
  function csvCell(v) {
    v = String(v == null ? "" : v);
    // stop spreadsheet programs from running a cell as a formula
    if (/^[=@]/.test(v) || /^[+\-][^0-9.\s]/.test(v)) v = "'" + v;
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csvFrom(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"); }
  function download(filename, text, mime) {
    var blob = new Blob([(mime && mime.indexOf("csv") > -1 ? "\ufeff" : "") + text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 200); };
  }
  function todayYMD() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  window.ClubCommon = {
    inFrame: inFrame, DEFAULT_LIMITS: DEFAULT_LIMITS,
    esc: esc, toast: toast, gotoLogin: gotoLogin, goDashboard: goDashboard,
    sanitizeLimits: sanitizeLimits, cachedLimits: cachedLimits, saveLimitsCache: saveLimitsCache, loadLimits: loadLimits, levelFor: levelFor,
    csvCell: csvCell, csvFrom: csvFrom, download: download, debounce: debounce, todayYMD: todayYMD
  };
})();
