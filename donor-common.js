/* =====================================================================
   PRC Donor Database - SHARED HELPERS  (donor-common.js)
   Used by: donor-database-entry / -tracking / -deferrals / -metadata-repair

   WHY THIS FILE EXISTS
   Before, searching for a donor downloaded the WHOLE donor collection into the
   browser and filtered it there. That gets slower and more expensive with every
   record you add. Now the search is done by the database itself, so only the few
   matching records are downloaded - it stays fast with 1,000 or 1,000,000 donors.

   HOW THE FAST SEARCH WORKS
   Each donor record gets three lowercase helper fields:
       surnameSearch, firstNameSearch, middleNameSearch
   New records get them automatically when saved or edited.
   Older records get them once through "donor-database-metadata-repair.html"
   (section 3).  Until that is done, the search ALSO checks the original
   fields in UPPER / Title case, so older records are still found.
   ===================================================================== */
window.DonorCommon = (function () {
  "use strict";

  var COL = "donorDatabase";

  /* ---------- name helpers ---------- */
  function norm(v) {
    return String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, " ");
  }
  function titleCase(s) {
    return String(s).replace(/(^|[\s\-'.])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }
  function firstNameOf(r) { return r ? (r.firstName != null ? r.firstName : r.firstname) : ""; }

  /* the three helper fields stored on every donor record */
  function searchFields(rec) {
    rec = rec || {};
    return {
      surnameSearch: norm(rec.surname),
      firstNameSearch: norm(firstNameOf(rec)),
      middleNameSearch: norm(rec.middleName)
    };
  }

  /* true when a record is missing helper fields or they are out of date */
  function needsSearchFields(rec) {
    var s = searchFields(rec);
    return rec.surnameSearch !== s.surnameSearch ||
           rec.firstNameSearch !== s.firstNameSearch ||
           rec.middleNameSearch !== s.middleNameSearch;
  }

  /* when an edit changes a name, keep the helper fields in step */
  function withSearchFields(changes, original) {
    var keys = ["surname", "firstName", "middleName"];
    var touched = keys.some(function (k) { return Object.prototype.hasOwnProperty.call(changes, k); });
    if (!touched) return changes;
    var merged = Object.assign({}, original || {}, changes);
    return Object.assign({}, changes, searchFields(merged));
  }

  /* same rule the tracking / statistics pages use for "deleted" */
  function isVisible(r) {
    if (!r || typeof r !== "object") return false;
    if (r.isDeleted === true) return false;
    if (typeof r.deletedBatchId === "string" && r.deletedBatchId.trim() !== "") return false;
    return true;
  }

  /* ---------- tiny in-memory cache so backspacing does not re-read ---------- */
  var cache = new Map();
  var CACHE_MS = 20000;
  function cacheGet(k) {
    var e = cache.get(k);
    if (e && Date.now() - e.t < CACHE_MS) return e.v;
    cache.delete(k);
    return null;
  }
  function cacheSet(k, v) {
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(k, { t: Date.now(), v: v });
  }
  function clearCache() { cache.clear(); }

  /* ---------- low level: prefix query on one field ---------- */
  function prefixQuery(db, field, term, limit) {
    return db.collection(COL)
      .where(field, ">=", term)
      .where(field, "<=", term + "\uf8ff")
      .limit(limit)
      .get();
  }

  /* run several queries, tolerate a few failing, throw only if ALL fail */
  async function runAll(jobs) {
    var firstErr = null, ok = 0;
    var snaps = await Promise.all(jobs.map(function (p) {
      return p.then(function (s) { ok++; return s; }, function (e) { if (!firstErr) firstErr = e; return null; });
    }));
    if (!ok && firstErr) throw firstErr;
    return snaps.filter(Boolean);
  }

  function collect(snaps, limit, into) {
    var truncated = false;
    snaps.forEach(function (s) {
      if (s.size >= limit) truncated = true;
      s.forEach(function (d) {
        if (!into.has(d.id)) {
          var r = Object.assign({ id: d.id }, d.data());
          if (isVisible(r)) into.set(d.id, r);
        }
      });
    });
    return truncated;
  }

  /* all records whose <base> (surname | firstName | middleName) STARTS WITH term */
  async function byField(db, base, term, limit, into) {
    var n = norm(term);
    if (!n) return false;
    var jobs = [prefixQuery(db, base + "Search", n, limit)];
    var seen = {};
    [String(term).trim().replace(/\s+/g, " ").toUpperCase(),
     titleCase(n),
     String(term).trim().replace(/\s+/g, " ")].forEach(function (v) {
      if (v && !seen[v]) { seen[v] = 1; jobs.push(prefixQuery(db, base, v, limit)); }
    });
    var snaps = await runAll(jobs);
    return collect(snaps, limit, into);
  }

  /* ---------- search by Surname / First name / Middle name boxes ---------- */
  async function searchByName(db, q, opts) {
    var limit = (opts && opts.limit) || 150;
    var s = norm(q.surname), f = norm(q.firstName), m = norm(q.middleName);
    if (!s && !f && !m) return { records: [], truncated: false };

    var key = "n|" + s + "|" + f + "|" + m;
    var hit = cacheGet(key);
    if (hit) return hit;

    var base = s ? "surname" : (f ? "firstName" : "middleName");
    var term = s || f || m;
    var into = new Map();
    var truncated = await byField(db, base, term, limit, into);

    var records = Array.from(into.values()).filter(function (r) {
      return (!s || norm(r.surname).indexOf(s) !== -1) &&
             (!f || norm(firstNameOf(r)).indexOf(f) !== -1) &&
             (!m || norm(r.middleName).indexOf(m) !== -1);
    });
    var out = { records: records, truncated: truncated };
    cacheSet(key, out);
    return out;
  }

  /* text used by the deferrals live search (any word order) */
  function recordText(r) {
    return [r.serialNumber, r.surname, firstNameOf(r), r.middleName, r.bloodType, r.sex, r.age]
      .join(" ").toLowerCase();
  }

  /* ---------- one search box: name words and/or a serial number ---------- */
  async function searchByText(db, text, opts) {
    var limit = (opts && opts.limit) || 30;
    var words = norm(text).split(" ").filter(Boolean).slice(0, 4);
    if (!words.length) return { records: [], truncated: false };

    var key = "t|" + words.join(" ");
    var hit = cacheGet(key);
    if (hit) return hit;

    var anchors = [words[0]];
    if (words.length > 1 && words[words.length - 1] !== words[0]) anchors.push(words[words.length - 1]);

    var into = new Map(), truncated = false, jobs = [];
    anchors.forEach(function (w) {
      ["surname", "firstName"].forEach(function (b) {
        jobs.push(byField(db, b, w, limit, into).then(function (t) { if (t) truncated = true; }));
      });
      if (/\d/.test(w) && w.length >= 2) {          // looks like (part of) a serial number
        var prefixes = [w.toUpperCase(), w];
        if (/^\d+$/.test(w)) {                        // digits only: add the usual PRC2600-YY00 prefix
          var yr = new Date().getFullYear();
          [yr, yr - 1].forEach(function (y) { prefixes.push("PRC2600-" + String(y).slice(-2) + "00" + w); });
        }
        var snapJobs = prefixes.filter(function (v, i, a) { return a.indexOf(v) === i; })
          .map(function (v) { return prefixQuery(db, "serialNumber", v, limit); });
        jobs.push(runAll(snapJobs).then(function (snaps) { if (collect(snaps, limit, into)) truncated = true; }));
      }
    });
    var results = await Promise.allSettled(jobs);
    if (results.every(function (r) { return r.status === "rejected"; })) throw results[0].reason;

    var records = Array.from(into.values()).filter(function (r) {
      var t = recordText(r);
      return words.every(function (w) { return t.indexOf(w) !== -1; });
    });
    var out = { records: records, truncated: truncated };
    cacheSet(key, out);
    return out;
  }

  /* newest record per donor identity (surname + first name + birthday) */
  function latestPerDonor(records) {
    var latest = {};
    records.forEach(function (r) {
      var k = [norm(r.surname).replace(/[^a-z0-9]/g, ""),
               norm(firstNameOf(r)).replace(/[^a-z0-9]/g, ""),
               String(r.birthday || "").trim()].join("|");
      if (!latest[k] || String(r.entryDate || "") > String(latest[k].entryDate || "")) latest[k] = r;
    });
    return Object.keys(latest).map(function (k) { return latest[k]; });
  }

  /* ---------- suggestions (city / occupation): small sample, cached on device ---------- */
  var SUG_KEY = "donorSuggestSample_v1";
  var SUG_TTL = 12 * 60 * 60 * 1000;   // 12 hours
  var sugPromise = null;
  function getSuggestionSample(db) {
    if (sugPromise) return sugPromise;
    sugPromise = (async function () {
      try {
        var raw = localStorage.getItem(SUG_KEY);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && Array.isArray(o.rows) && Date.now() - o.t < SUG_TTL) return o.rows;
        }
      } catch (e) { /* ignore */ }
      // newest 1200 records are plenty to learn common cities / occupations
      var snap = await db.collection(COL).orderBy("entryDate", "desc").limit(1200).get();
      var rows = [];
      snap.forEach(function (d) {
        var r = d.data() || {};
        if (!isVisible(r)) return;
        rows.push({ c: r.cityProvince || r.provinceCity || r.city || r.province || "", o: r.occupation || "" });
      });
      try { localStorage.setItem(SUG_KEY, JSON.stringify({ t: Date.now(), rows: rows })); } catch (e) { /* storage full */ }
      return rows;
    })();
    sugPromise.catch(function () { sugPromise = null; });
    return sugPromise;
  }

  return {
    norm: norm,
    searchFields: searchFields,
    needsSearchFields: needsSearchFields,
    withSearchFields: withSearchFields,
    isVisible: isVisible,
    searchByName: searchByName,
    searchByText: searchByText,
    latestPerDonor: latestPerDonor,
    getSuggestionSample: getSuggestionSample,
    clearCache: clearCache
  };
})();
