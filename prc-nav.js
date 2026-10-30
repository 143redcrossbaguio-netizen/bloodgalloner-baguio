/* PRC Blood Releasing - shared phone helpers (prc-nav.js)
   1. bottom navigation bar on phones
   2. "no internet" warning banner
   3. home-screen / theme-color tags so it behaves like an app on a phone
   4. stops the mouse wheel / trackpad from silently changing a number box */
(function(){
  "use strict";
  var PAGES = [
    { file:"releasing.html",            icon:"\uD83C\uDFE0", label:"Menu"    },
    { file:"releasing-entry.html",      icon:"\u270F\uFE0F", label:"Entry"   },
    { file:"releasing-tracking.html",   icon:"\uD83D\uDCCB", label:"Records" },
    { file:"posted-documents.html",     icon:"\uD83D\uDCC4", label:"Posted"  },
    { file:"releasing-statistics.html", icon:"\uD83D\uDCCA", label:"Stats"   }
  ];

  function ensureMeta(name, content){
    if(document.querySelector('meta[name="'+name+'"]')) return;
    var m = document.createElement("meta");
    m.name = name; m.content = content;
    document.head.appendChild(m);
  }

  function init(){
    ensureMeta("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
    ensureMeta("theme-color", "#c62828");
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "default");
    ensureMeta("apple-mobile-web-app-title", "PRC Releasing");

    /* bottom nav */
    if(!document.getElementById("prcNav")){
      var current = (location.pathname.split("/").pop() || "").toLowerCase();
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
