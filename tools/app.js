(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobileMq = window.matchMedia("(max-width: 899px)");

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function isTyping(el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  }

  var tests = $$("article.test");
  var byId = {};
  tests.forEach(function (t, i) { byId[t.id] = i; });

  /* ------------------------------------------------------------ hydration */
  /* Source excerpts live in <template> elements until a reader opens them. */
  function hydrate(root) {
    $$("code[data-tpl]", root).forEach(function (el) {
      if (el.dataset.ready) return;
      var tpl = document.getElementById("tpl-" + el.dataset.tpl);
      if (tpl) el.innerHTML = tpl.innerHTML;
      el.dataset.ready = "1";
    });
  }
  document.addEventListener("toggle", function (e) {
    if (e.target.open && e.target.matches && !e.target.matches(".nav-group")) hydrate(e.target);
  }, true);

  /* ------------------------------------------------------------ toast */
  var toast = $("#toast");
  var toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1600);
  }
  function copyText(text, onDone, onFail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, onFail);
    } else {
      onFail();
    }
  }
  function linkFor(hash) {
    return location.href.split("#")[0] + "#" + hash;
  }
  function copyLink(hash) {
    var url = linkFor(hash);
    copyText(url, function () { say("Link copied"); }, function () { say(url); });
  }

  /* ------------------------------------------------------------ test cards */
  function isOpen(t) { return t.classList.contains("open"); }
  function setOpen(t, open) {
    var btn = $(".test-toggle", t);
    var body = $(".test-body", t);
    if (open === isOpen(t)) return;
    t.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
    if (open) {
      var panel = $(".tabpanel:not([hidden])", t);
      if (panel) hydrate(panel);
    }
  }
  function selectTab(t, key, focus) {
    var tab = $('[role=tab][data-tab="' + key + '"]', t);
    if (!tab) return false;
    $$("[role=tab]", t).forEach(function (b) {
      var on = b === tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    $$(".tabpanel", t).forEach(function (p) { p.hidden = p.dataset.tab !== key; });
    var panel = document.getElementById(tab.getAttribute("aria-controls"));
    hydrate(panel);
    if (focus) tab.focus();
    if (t.id === currentId) renderRail(t);
    return true;
  }
  function tabKeys(t) { return $$("[role=tab]", t).map(function (b) { return b.dataset.tab; }); }
  function currentTab(t) {
    var b = $("[role=tab][aria-selected=true]", t);
    return b ? b.dataset.tab : null;
  }

  document.addEventListener("click", function (e) {
    var toggle = e.target.closest(".test-toggle");
    if (toggle) {
      var t = toggle.closest(".test");
      setOpen(t, !isOpen(t));
      setCurrent(t.id);
      if (isOpen(t)) replaceHash(t.id);
      return;
    }
    var tab = e.target.closest("[role=tab]");
    if (tab) {
      var tt = tab.closest(".test");
      selectTab(tt, tab.dataset.tab);
      replaceHash(tt.id + "/" + tab.dataset.tab);
      return;
    }
    var anchor = e.target.closest(".test .anchor");
    if (anchor) {
      e.preventDefault();
      var at = anchor.closest(".test");
      var tk = isOpen(at) ? currentTab(at) : null;
      var h = at.id + (tk && tk !== tabKeys(at)[0] ? "/" + tk : "");
      replaceHash(h);
      copyLink(h);
    }
  });

  /* Arrow keys move between tabs (WAI-ARIA tabs pattern). */
  document.addEventListener("keydown", function (e) {
    var tab = e.target.closest && e.target.closest("[role=tab]");
    if (!tab) return;
    var t = tab.closest(".test");
    var keys = tabKeys(t);
    var i = keys.indexOf(tab.dataset.tab);
    var n = null;
    if (e.key === "ArrowRight") n = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + keys.length) % keys.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = keys.length - 1;
    if (n === null) return;
    e.preventDefault();
    e.stopPropagation();
    selectTab(t, keys[n], true);
  });

  /* Expand / collapse: per part, all tests, and the reference sections. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-expand], [data-collapse]");
    if (!b) return;
    var part = document.getElementById(b.dataset.expand || b.dataset.collapse);
    var open = !!b.dataset.expand;
    $$(".test:not([hidden])", part).forEach(function (t) { setOpen(t, open); });
  });
  $("#expand-tests").addEventListener("click", function () {
    tests.forEach(function (t) { if (!t.hidden) setOpen(t, true); });
  });
  $("#collapse-tests").addEventListener("click", function () {
    tests.forEach(function (t) { setOpen(t, false); });
  });
  $("#expand-all").addEventListener("click", function () {
    $$("details.sec").forEach(function (d) { d.open = true; });
  });
  $("#collapse-all").addEventListener("click", function () {
    $$("#reference details").forEach(function (d) { d.open = false; });
  });

  /* ------------------------------------------------------------ deep links */
  var suppressHash = false;
  function replaceHash(h) {
    suppressHash = true;
    if (history.replaceState) history.replaceState(null, "", "#" + h);
    else location.hash = h;
    setTimeout(function () { suppressHash = false; }, 0);
  }
  function scrollToEl(el) {
    el.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }
  function reveal(el) {
    var d = el.closest("details");
    while (d) {
      if (!d.matches(".nav-group")) d.open = true;
      d = d.parentElement && d.parentElement.closest("details");
    }
    hydrate(el);
  }
  function openFromHash() {
    if (suppressHash) return;
    var raw = decodeURIComponent(location.hash.slice(1));
    if (!raw) return;
    var bits = raw.split("/");
    var el = document.getElementById(bits[0]);
    if (!el) return;
    if (el.matches(".test")) {
      if (el.hidden) clearFilters();
      setOpen(el, true);
      if (bits[1]) selectTab(el, bits[1]);
      setCurrent(el.id);
    } else {
      if (el.hidden) clearFilters();
      reveal(el);
      var target = el;
      while (target && !navLinks[target.id]) target = target.parentElement && target.parentElement.closest("[id]");
      if (target) setCurrent(target.id);
    }
    closeDrawer();
    pin();
    scrollToEl(el);
  }
  window.addEventListener("hashchange", openFromHash);

  /* Plain in-page links: open what they point at, even when the hash is unchanged. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains("anchor") || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var h = a.getAttribute("href").slice(1);
    if (!h) return;
    if (a.closest("summary") && a.closest(".nav-group")) {
      /* The group title navigates; stop the summary toggling closed. */
      var g = a.closest(".nav-group");
      setTimeout(function () { g.open = true; }, 0);
    }
    if ("#" + h === location.hash) {
      e.preventDefault();
      openFromHash();
    }
    closeDrawer();
  });

  /* ------------------------------------------------------------ filtering */
  var q = $("#q");
  var countEl = $("#count");
  var clearBtn = $("#clear-filters");
  var fCount = $("#f-count");
  var total = tests.length;
  var active = { method: [], role: [] };
  var navItems = {};
  $$(".nav-item").forEach(function (a) { navItems[a.dataset.id] = a; });
  var glanceRows = {};
  $$("#glance-body tr").forEach(function (r) { glanceRows[r.dataset.id] = r; });

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function highlight(el, re) {
    var text = el.dataset.text;
    if (!re) { el.textContent = text; return; }
    var out = "";
    var last = 0;
    text.replace(re, function (m, _g, idx) {
      out += escapeHtml(text.slice(last, idx)) + "<mark>" + escapeHtml(m) + "</mark>";
      last = idx + m.length;
      return m;
    });
    el.innerHTML = out + escapeHtml(text.slice(last));
  }
  function matchesAny(list, want) {
    if (!want.length) return true;
    return want.some(function (w) { return list.indexOf(w) !== -1; });
  }
  function applyFilter() {
    var term = q.value.trim().toLowerCase();
    var words = term.split(/\s+/).filter(Boolean);
    var re = words.length ? new RegExp("(" + words.map(escapeRe).join("|") + ")", "gi") : null;
    var shown = 0;
    tests.forEach(function (t) {
      var ok = words.every(function (w) { return t.dataset.search.indexOf(w) !== -1; }) &&
        matchesAny(t.dataset.methods.split(" "), active.method) &&
        matchesAny(t.dataset.roles.split(" "), active.role);
      t.hidden = !ok;
      if (navItems[t.id]) navItems[t.id].parentNode.hidden = !ok;
      if (glanceRows[t.id]) glanceRows[t.id].hidden = !ok;
      $$(".tt", t).forEach(function (s) { highlight(s, re); });
      if (navItems[t.id]) highlight($(".nt", navItems[t.id]), re);
      if (ok) shown++;
    });
    var filtering = words.length || active.method.length || active.role.length;
    $$(".part").forEach(function (p) { p.hidden = !$(".test:not([hidden])", p); });
    $$(".nav-group[data-group^='part-']").forEach(function (g) {
      var visible = $$("li:not([hidden])", g).length;
      g.hidden = !visible;
      $(".ng-count", g).textContent = filtering ? visible + "/" + $$("li", g).length : $$("li", g).length;
      if (filtering && visible) autoOpen(g);
    });
    countEl.textContent = filtering ? shown + " of " + total + " tests" : total + " tests";
    clearBtn.hidden = !filtering;
    var nChips = active.method.length + active.role.length;
    fCount.hidden = !nChips;
    fCount.textContent = nChips;
    $("#empty").hidden = shown !== 0;
    updateMobileSteps();
  }
  function clearFilters() {
    q.value = "";
    active.method = [];
    active.role = [];
    $$(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    applyFilter();
  }
  q.addEventListener("input", applyFilter);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (q.value) { q.value = ""; applyFilter(); } else q.blur();
    } else if (e.key === "Enter") {
      var first = tests.filter(function (t) { return !t.hidden; })[0];
      if (first) { location.hash = first.id; q.blur(); }
    }
  });
  $$(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      var list = active[c.dataset.filter];
      var on = c.getAttribute("aria-pressed") !== "true";
      c.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) list.push(c.dataset.value);
      else list.splice(list.indexOf(c.dataset.value), 1);
      applyFilter();
    });
  });
  clearBtn.addEventListener("click", clearFilters);
  $$("[data-clear]").forEach(function (b) { b.addEventListener("click", clearFilters); });

  /* ------------------------------------------------------------ nav groups */
  /* Groups the reader opens stay open (and are remembered); groups the page
     opens while following the reading position close again once it moves on. */
  var groupsKey = "istsos-guide-groups";
  var savedGroups = store(groupsKey);
  if (savedGroups !== null) {
    var openSet = savedGroups.split(",");
    $$(".nav-group").forEach(function (g) { g.open = openSet.indexOf(g.dataset.group) !== -1; });
  }
  function saveGroups() {
    store(groupsKey, $$(".nav-group[open]:not([data-auto])").map(function (g) { return g.dataset.group; }).join(","));
  }
  function autoOpen(g) {
    if (g.open) return;
    g.dataset.auto = "1";
    g.open = true;
  }
  function autoCloseExcept(keep) {
    if (!clearBtn.hidden) return; /* keep matches visible while a filter is on */
    $$(".nav-group[data-auto]").forEach(function (g) {
      if (g === keep) return;
      g.open = false;
      delete g.dataset.auto;
    });
  }
  $$(".nav-group > summary").forEach(function (sm) {
    sm.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var g = sm.parentNode;
      delete g.dataset.auto;
      setTimeout(saveGroups, 0);
    });
  });

  /* ------------------------------------------------------------ scroll spy */
  /* One IntersectionObserver watches every landmark the sidebar links to. */
  var currentId = null;
  var navLinks = {};
  $$("#side-nav a[data-id]").forEach(function (a) { navLinks[a.dataset.id] = a; });
  var spyTargets = Object.keys(navLinks).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var crumbs = $("#crumbs");

  function setCrumbs(el) {
    var html = "";
    if (el && el.matches(".test")) {
      var part = el.closest(".part");
      html = '<a href="#test-features">Tests</a><span class="sep">›</span>' +
        '<a href="#' + part.id + '">' + escapeHtml(part.dataset.label) + '</a><span class="sep">›</span>' +
        '<span class="cur">' + escapeHtml($(".tid", el).textContent + " " + $(".tt", el).dataset.text) + "</span>";
    } else if (el && el.matches(".part")) {
      html = '<a href="#test-features">Tests</a><span class="sep">›</span><span class="cur">' +
        escapeHtml(el.dataset.label + " · " + $("h3", el).textContent) + "</span>";
    } else if (el && el.closest("#reference")) {
      var sec = el.closest("details.sec");
      html = '<a href="#reference">Reference</a>';
      if (sec) {
        var t = $(".sec-title", sec).textContent;
        html += '<span class="sep">›</span>' + (sec === el
          ? '<span class="cur">' + escapeHtml(t) + "</span>"
          : '<a href="#' + sec.id + '">' + escapeHtml(t) + '</a><span class="sep">›</span><span class="cur">' + escapeHtml(el.textContent) + "</span>");
      }
    } else if (el && el.closest("#run-swagger") && el.id !== "run-swagger") {
      html = '<a href="#run-swagger">Run Swagger</a><span class="sep">›</span><span class="cur">' + escapeHtml(el.textContent) + "</span>";
    } else if (el) {
      var h = $("h2", el);
      html = '<span class="cur">' + escapeHtml(h ? h.textContent : "") + "</span>";
    }
    crumbs.innerHTML = html;
  }

  function setCurrent(id) {
    if (id === currentId) return;
    if (currentId && navLinks[currentId]) navLinks[currentId].removeAttribute("aria-current");
    var prev = currentId && document.getElementById(currentId);
    if (prev) prev.classList.remove("is-current");
    currentId = id;
    var el = id && document.getElementById(id);
    var link = id && navLinks[id];
    if (link) {
      link.setAttribute("aria-current", "location");
      var g = link.closest(".nav-group");
      if (g) autoOpen(g);
      autoCloseExcept(g);
      var nav = $("#side-nav");
      var lr = link.getBoundingClientRect();
      var nr = nav.getBoundingClientRect();
      if (lr.top < nr.top + 40 || lr.bottom > nr.bottom - 40) {
        nav.scrollTop += lr.top - nr.top - nr.height / 3;
      }
    }
    setCrumbs(el);
    if (el && el.matches(".test")) {
      store("istsos-guide-last", id);
      renderRail(el);
    } else {
      $("#rail-in").hidden = true;
    }
    updateMobileSteps();
  }

  /* After a jump (j/k, a link, a deep link) the chosen item stays current until the reader scrolls. */
  var pinned = false;
  function pin() {
    pinned = true;
    clearTimeout(pin.t);
    /* Released when the jump's scroll settles; the timer covers browsers without scrollend. */
    pin.t = setTimeout(function () { pinned = false; }, "onscrollend" in window ? 4000 : 1500);
  }
  window.addEventListener("scrollend", function () {
    if (!pinned) return;
    clearTimeout(pin.t);
    pin.t = setTimeout(function () { pinned = false; }, 150);
  });
  ["wheel", "touchmove"].forEach(function (ev) {
    window.addEventListener(ev, function () { pinned = false; }, { passive: true });
  });
  /* Hidden by a filter, or folded inside a closed section (which Chrome still lays out). */
  function shown(el) {
    if (el.hidden || el.offsetParent === null) return false;
    var p = el.parentElement && el.parentElement.closest("details:not([open])");
    return !p;
  }
  function spy() {
    if (pinned) return;
    /* The active item is the last landmark whose top has passed the reading line. */
    var line = window.innerHeight * 0.25 + 1;
    var best = null;
    spyTargets.forEach(function (el) {
      if (!shown(el)) return;
      if (el.getBoundingClientRect().top <= line) best = el;
    });
    /* At the very bottom nothing more can reach the line: take the last landmark on screen. */
    var doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 4) {
      spyTargets.forEach(function (el) {
        if (!shown(el)) return;
        if (el.getBoundingClientRect().top < window.innerHeight) best = el;
      });
    }
    if (!best) best = spyTargets[0];
    /* Tests follow their part in document order, so a test beats the part that contains it. */
    setCurrent(best ? best.id : null);
  }
  var io = new IntersectionObserver(spy, { rootMargin: "0px 0px -75% 0px", threshold: 0 });
  spyTargets.forEach(function (el) { io.observe(el); });

  /* ------------------------------------------------------------ right rail */
  var railList = $("#rail-list");
  function renderRail(t) {
    if (!t || !t.matches(".test")) return;
    $("#rail-in").hidden = false;
    $("#rail-title").innerHTML = '<span class="tid">' + escapeHtml($(".tid", t).textContent) + "</span>" + escapeHtml($(".tt", t).dataset.text);
    var sel = isOpen(t) ? currentTab(t) : null;
    railList.innerHTML = $$("[role=tab]", t).map(function (b) {
      var label = b.cloneNode(true);
      $$(".tab-n, .tab-count", label).forEach(function (n) { n.remove(); });
      return '<li><button type="button" data-tab="' + b.dataset.tab + '"' + (b.dataset.tab === sel ? ' aria-current="true"' : "") + ">" +
        escapeHtml(label.textContent) + "</button></li>";
    }).join("");
  }
  railList.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    var t = currentId && document.getElementById(currentId);
    if (!b || !t) return;
    setOpen(t, true);
    selectTab(t, b.dataset.tab);
    replaceHash(t.id + "/" + b.dataset.tab);
    var panel = $('.tabpanel[data-tab="' + b.dataset.tab + '"]', t);
    scrollToEl($(".tabs", t));
    if (panel) panel.focus({ preventScroll: true });
  });
  $("#rail-copy").addEventListener("click", function () {
    if (!currentId) return;
    var t = document.getElementById(currentId);
    var tk = isOpen(t) ? currentTab(t) : null;
    copyLink(currentId + (tk && tk !== tabKeys(t)[0] ? "/" + tk : ""));
  });

  /* ------------------------------------------------------------ keyboard */
  function visibleTests() { return tests.filter(function (t) { return !t.hidden; }); }
  function currentTest() {
    var t = currentId && document.getElementById(currentId);
    return t && t.matches(".test") && !t.hidden ? t : null;
  }
  function step(dir) {
    var list = visibleTests();
    if (!list.length) return;
    var cur = currentTest();
    var i = cur ? list.indexOf(cur) : -1;
    if (!cur) {
      /* Nothing selected yet: pick the first test below the reading line. */
      var line = window.innerHeight * 0.3;
      i = dir > 0 ? -1 : list.length;
      for (var k = 0; k < list.length; k++) {
        if (list[k].getBoundingClientRect().top > line) { i = dir > 0 ? k - 1 : k; break; }
      }
    }
    var next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    goTo(next);
  }
  function goTo(t) {
    pin();
    setCurrent(t.id);
    replaceHash(t.id);
    scrollToEl(t);
    $(".test-toggle", t).focus({ preventScroll: true });
  }

  var help = $("#help");
  var helpReturn = null;
  function openHelp() {
    helpReturn = document.activeElement;
    help.hidden = false;
    $("#help-close").focus();
  }
  function closeHelp() {
    help.hidden = true;
    if (helpReturn && helpReturn.focus) helpReturn.focus();
  }
  $("#help-btn").addEventListener("click", openHelp);
  $("#help-link").addEventListener("click", openHelp);
  $("#help-close").addEventListener("click", closeHelp);
  help.addEventListener("click", function (e) { if (e.target === help) closeHelp(); });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!help.hidden) {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); closeHelp(); }
      else if (e.key === "Tab") { e.preventDefault(); $("#help-close").focus(); }
      return;
    }
    if (e.key === "Escape") {
      if (drawerOpen()) { closeDrawer(); $("#menu-btn").focus(); return; }
      if (q.value || active.method.length || active.role.length) { clearFilters(); return; }
      return;
    }
    if (isTyping(e.target)) return;
    var t = currentTest();
    switch (e.key) {
      case "/":
        e.preventDefault();
        if (mobileMq.matches) openDrawer();
        q.focus();
        q.select();
        break;
      case "?":
        e.preventDefault();
        openHelp();
        break;
      case "j":
        e.preventDefault();
        step(1);
        break;
      case "k":
        e.preventDefault();
        step(-1);
        break;
      case "o":
        if (!t) return;
        e.preventDefault();
        setOpen(t, !isOpen(t));
        renderRail(t);
        break;
      case "Enter":
        if (!t || e.target !== document.body) return;
        e.preventDefault();
        setOpen(t, !isOpen(t));
        renderRail(t);
        break;
      case "1": case "2": case "3": case "4": case "5":
        if (!t) return;
        var key = tabKeys(t)[+e.key - 1];
        if (!key) return;
        e.preventDefault();
        setOpen(t, true);
        selectTab(t, key);
        replaceHash(t.id + "/" + key);
        break;
    }
  });

  /* ------------------------------------------------------------ progress + back to top */
  var bar = $("#progress-bar");
  var toTop = $("#to-top");
  var ticking = false;
  function onScroll() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.transform = "scaleX(" + p + ")";
    toTop.hidden = window.scrollY < window.innerHeight * 1.2;
    if (max - window.scrollY < 4) spy();
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    replaceHash("top");
    $("#content").focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------ mobile drawer */
  var sidebar = $("#sidebar");
  var scrim = $("#scrim");
  var menuBtn = $("#menu-btn");
  function drawerOpen() { return sidebar.classList.contains("open"); }
  function openDrawer() {
    if (!mobileMq.matches) return;
    sidebar.classList.add("open");
    scrim.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    if (!drawerOpen()) return;
    sidebar.classList.remove("open");
    scrim.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  menuBtn.addEventListener("click", function () {
    if (drawerOpen()) closeDrawer();
    else { openDrawer(); var cur = $("#side-nav [aria-current]"); (cur || q).focus({ preventScroll: true }); }
  });
  scrim.addEventListener("click", closeDrawer);
  mobileMq.addEventListener && mobileMq.addEventListener("change", function () { if (!mobileMq.matches) closeDrawer(); });

  /* Bottom prev / next bar on phones */
  var mSteps = $("#mobile-steps");
  var mPrev = $("#m-prev");
  var mNext = $("#m-next");
  function updateMobileSteps() {
    var list = visibleTests();
    var cur = currentTest();
    if (!cur) { mSteps.hidden = true; return; }
    mSteps.hidden = false;
    var i = list.indexOf(cur);
    var p = list[i - 1];
    var n = list[i + 1];
    mPrev.disabled = !p;
    mNext.disabled = !n;
    $("span", mPrev).textContent = p ? $(".tid", p).textContent : "Start";
    $("span", mNext).textContent = n ? $(".tid", n).textContent : "End";
    mPrev.setAttribute("aria-label", p ? "Previous test: " + $(".tid", p).textContent : "No previous test");
    mNext.setAttribute("aria-label", n ? "Next test: " + $(".tid", n).textContent : "No next test");
  }
  mPrev.addEventListener("click", function () { step(-1); });
  mNext.addEventListener("click", function () { step(1); });

  /* ------------------------------------------------------------ resume */
  var last = store("istsos-guide-last");
  var resume = $("#resume");
  if (last && byId[last] !== undefined && !location.hash) {
    var lt = tests[byId[last]];
    resume.href = "#" + last;
    resume.textContent = "Resume at " + $(".tid", lt).textContent + " · " + $(".tt", lt).dataset.text;
    resume.hidden = false;
    resume.addEventListener("click", function () { resume.hidden = true; });
  }

  /* ------------------------------------------------------------ code copy */
  function codeText(fig) {
    var lines = $$(".ln", fig);
    if (lines.length) {
      return lines.map(function (l) { return l.textContent === " " ? "" : l.textContent; }).join("\n");
    }
    return $("code", fig).textContent;
  }
  function selectFallback(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    say("Selected. Press Ctrl/Cmd C to copy.");
  }
  function flash(btn) {
    btn.textContent = "Copied";
    btn.classList.add("done");
    say("Copied to clipboard");
    setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1400);
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (btn) {
      var fig = btn.closest("figure");
      hydrate(fig);
      copyText(codeText(fig), function () { flash(btn); }, function () { selectFallback($("code", fig)); });
      return;
    }
    var io = e.target.closest(".io-copy");
    if (io) {
      var pre = $("pre.io", io.closest(".io-wrap"));
      copyText(pre.textContent, function () { flash(io); }, function () { selectFallback(pre); });
      return;
    }
    var more = e.target.closest(".io-more");
    if (more) {
      var wrap = more.previousElementSibling;
      var capped = wrap.classList.toggle("capped");
      more.textContent = capped ? "Show full response" : "Show less";
      return;
    }
    var cm = e.target.closest(".code-more");
    if (cm) {
      var body = cm.previousElementSibling;
      var c = body.classList.toggle("capped");
      cm.textContent = c ? cm.dataset.more : "Show less";
    }
  });

  /* ------------------------------------------------------------ line numbers */
  var lines = $("#lines");
  function applyLines(on) { document.body.classList.toggle("no-lines", !on); }
  if (store("istsos-guide-lines") === "0") lines.checked = false;
  applyLines(lines.checked);
  lines.addEventListener("change", function () {
    applyLines(lines.checked);
    store("istsos-guide-lines", lines.checked ? "1" : "0");
  });

  /* ------------------------------------------------------------ start */
  applyFilter();
  onScroll();
  if (location.hash) openFromHash();
})();
