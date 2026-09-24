(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

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
    if (e.target.open) hydrate(e.target);
  }, true);

  /* Open every <details> that contains the element, then scroll to it. */
  function reveal(el) {
    var d = el.closest("details");
    while (d) {
      d.open = true;
      d = d.parentElement && d.parentElement.closest("details");
    }
    hydrate(el);
  }
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (!el) return;
    reveal(el);
    el.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();

  /* Expand / collapse the top-level sections. */
  $("#expand-all").addEventListener("click", function () {
    $$("details.sec").forEach(function (d) { d.open = true; });
  });
  $("#collapse-all").addEventListener("click", function () {
    $$("details").forEach(function (d) { d.open = false; });
  });

  /* Copy */
  var toast = $("#toast");
  var toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1600);
  }
  function codeText(fig) {
    var lines = $$(".ln", fig);
    if (lines.length) {
      return lines.map(function (l) { return l.textContent === " " ? "" : l.textContent; }).join("\n");
    }
    return $("code", fig).textContent;
  }
  function selectFallback(fig) {
    var range = document.createRange();
    range.selectNodeContents($("code", fig));
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    say("Selected. Press Ctrl/Cmd C to copy.");
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var fig = btn.closest("figure");
    hydrate(fig);
    var text = codeText(fig);
    var done = function () {
      btn.textContent = "Copied";
      btn.classList.add("done");
      say("Copied to clipboard");
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { selectFallback(fig); });
    } else {
      selectFallback(fig);
    }
  });

  /* Long excerpts are capped in height; the reader can lift the cap. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".code-more");
    if (!btn) return;
    var body = btn.previousElementSibling;
    var capped = body.classList.toggle("capped");
    btn.textContent = capped ? btn.dataset.more : "Show less";
  });

  /* Line numbers */
  var lines = $("#lines");
  function applyLines(on) { document.body.classList.toggle("no-lines", !on); }
  if (store("istsos-guide-lines") === "0") lines.checked = false;
  applyLines(lines.checked);
  lines.addEventListener("change", function () {
    applyLines(lines.checked);
    store("istsos-guide-lines", lines.checked ? "1" : "0");
  });

  /* Filter the test list */
  var q = $("#q");
  function applyFilter() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    $$(".test").forEach(function (t) {
      var ok = !term || t.dataset.search.indexOf(term) !== -1;
      t.hidden = !ok;
      if (ok) shown++;
    });
    $$(".part").forEach(function (p) { p.hidden = !$(".test:not([hidden])", p); });
    $$("#contents a").forEach(function (a) {
      var t = document.getElementById(a.dataset.target);
      a.hidden = !!(t && t.hidden);
    });
    $("#empty").hidden = shown !== 0;
  }
  q.addEventListener("input", applyFilter);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { q.value = ""; applyFilter(); }
  });
})();
