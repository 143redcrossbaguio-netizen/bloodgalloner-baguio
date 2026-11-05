/* PRC Blood Releasing + Donor Database - shared phone helpers (prc-nav.js)
   1. bottom navigation bar on phones / tablets (releasing pages OR donor pages)
   2. "back to top" button on long pages
   3. "no internet" warning banner
   4. home-screen / theme-color tags so it behaves like an app on a phone
   5. stops the mouse wheel / trackpad from silently changing a number box */
(function(){
  "use strict";

  var RELEASING = [
    { file:"releasing.html",            icon:"\uD83C\uDFE0", label:"Menu"    },
    { file:"releasing-entry.html",      icon:"\u270F\uFE0F", label:"Entry"   },
    { file:"releasing-tracking.html",   icon:"\uD83D\uDCCB", label:"Records" },
    { file:"posted-documents.html",     icon:"\uD83D\uDCC4", label:"Posted"  },
    { file:"releasing-statistics.html", icon:"\uD83D\uDCCA", label:"Stats"   }
  ];
  var DONOR = [
    { file:"donor-database-entry.html",       icon:"\u270F\uFE0F", label:"Entry"     },
    { file:"donor-database-tracking.html",    icon:"\uD83D\uDCCB", label:"Records"   },
    { file:"donor-database-deferrals.html",   icon:"\uD83D\uDEAB", label:"Deferrals" },
    { file:"donor-database-statistics.html",  icon:"\uD83D\uDCCA", label:"Stats"     }
  ];

  /* Inside the dashboard frame the dashboard already provides navigation (and decides who may see what).
     A second bottom bar there would be redundant and would show links to people who should not see them. */
  var framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  var SHOW_NAV_IN_FRAME = false;       // set to true if you ever want the bottom bar inside the dashboard too
  var BRAND = "#b30000";

  var current = (location.pathname.split("/").pop() || "").toLowerCase();
  var isDonor = current.indexOf("donor-database") === 0;
  var skipNav = current.indexOf("metadata-repair") !== -1 || (framed && !SHOW_NAV_IN_FRAME);   // admin tool / inside the dashboard: no bottom bar
  var PAGES = isDonor ? DONOR : RELEASING;

  function ensureMeta(name, content){
    if(document.querySelector('meta[name="'+name+'"]')) return;
    var m = document.createElement("meta");
    m.name = name; m.content = content;
    document.head.appendChild(m);
  }

  function addFabCss(){
    if(document.getElementById("prcTopCss")) return;
    var s = document.createElement("style");
    s.id = "prcTopCss";
    s.textContent =
      "#prcTop{display:none;position:fixed;right:14px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:890;" +
      "width:44px;height:44px;border-radius:50%;border:none;background:#b30000;color:#fff;font-size:18px;line-height:1;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;opacity:0;transition:opacity .2s ease;padding:0;}" +
      "#prcTop.show{opacity:.92;}" +
      "@media (max-width:980px){#prcTop{display:block;pointer-events:none;}#prcTop.show{pointer-events:auto;}}" +
      "@media print{#prcTop{display:none !important;}}" +
      /* inside the dashboard frame: no space reserved for a bottom bar, and a compact header (the dashboard shows the title) */
      "html.prc-framed #prcTop{bottom:16px;}" +
      "@media (max-width:980px){html.prc-framed body{padding-bottom:12px !important;}" +
      "html.prc-framed header{padding:8px 12px !important;}" +
      "html.prc-framed header h1,html.prc-framed header h2{font-size:16px !important;}" +
      "html.prc-framed header .logo{display:none !important;}}";
    document.head.appendChild(s);
  }

  function init(){
    if(framed) document.documentElement.classList.add("prc-framed");
    ensureMeta("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
    ensureMeta("theme-color", BRAND);
    var tc = document.querySelector('meta[name="theme-color"]');      // pages still carry the old red: match the dashboard
    if(tc) tc.setAttribute("content", BRAND);
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "default");
    ensureMeta("apple-mobile-web-app-title", isDonor ? "PRC Donors" : "PRC Releasing");

    /* bottom nav */
    if(!skipNav && !document.getElementById("prcNav")){
      var nav = document.createElement("nav");
      nav.id = "prcNav";
      nav.setAttribute("aria-label", "Main navigation");
      PAGES.forEach(function(p){
        var a = document.createElement("a");
        a.href = p.file;
        if(current === p.file) a.className = "on";
        a.innerHTML = '<span class="ic">'+p.icon+'</span><span>'+p.label+'</span>';
        nav.appendChild(a);
      });
      document.body.appendChild(nav);
    }

    addFabCss();
    /* back to top */
    if(!document.getElementById("prcTop")){
      var fab = document.createElement("button");
      fab.id = "prcTop";
      fab.type = "button";
      fab.setAttribute("aria-label", "Back to top");
      fab.textContent = "\u25B2";
      fab.addEventListener("click", function(){ window.scrollTo({ top:0, behavior:"smooth" }); });
      document.body.appendChild(fab);
      var ticking = false;
      window.addEventListener("scroll", function(){
        if(ticking) return;
        ticking = true;
        window.requestAnimationFrame(function(){
          fab.classList.toggle("show", window.scrollY > 700);
          ticking = false;
        });
      }, { passive:true });
    }

    /* offline banner */
    var bar = document.getElementById("prcOffline");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "prcOffline";
      bar.textContent = "\u26A0 No internet connection \u2014 do not rely on saving until it is back.";
      document.body.appendChild(bar);
    }
    function sync(){ bar.style.display = navigator.onLine ? "none" : "block"; }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();

    /* a scrolling wheel must not change the number you typed */
    document.addEventListener("wheel", function(e){
      var el = document.activeElement;
      if(el && el.type === "number" && el === e.target) el.blur();
    }, { passive:true });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
