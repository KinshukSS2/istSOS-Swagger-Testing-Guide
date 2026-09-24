#!/usr/bin/env python3
"""Build index.html, the istSOS4 Swagger Guide.

Input:  tools/report.source.html  (generated report: test results, recorded HTTP
        exchanges and the real source excerpts, already syntax-highlighted)
Output: index.html                (one self-contained page)

Needs beautifulsoup4 and lxml:  pip install beautifulsoup4 lxml
"""
import html
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
raw = (TOOLS / "report.source.html").read_text(encoding="utf-8")
soup = BeautifulSoup(raw, "lxml")

# Source excerpts are stored once each in <template> elements at the end of the report.
templates = {m.group(1): m.group(2) for m in re.finditer(r'<template id="tpl-(\w+)">(.*?)</template>', raw, re.S)}
esc = html.escape


def inner(el):
    return el.decode_contents() if el is not None else ""


# ---------------------------------------------------------------- run metadata
runmeta = [inner(s) for s in soup.select(".runmeta > span")]
last_run = re.sub(r"<[^>]+>", "", runmeta[0]).replace("Last run", "").strip()
commit_a = soup.select_one(".runmeta a[href*='github.com']")
commit_href, commit_short = commit_a["href"], commit_a.text
swagger_href = soup.select_one(".swagger-link")["href"]
flags = [(f.select_one("span").text, f.select_one("b").text) for f in soup.select(".flags .flag")]
source_files_traced = soup.select_one(".metric:last-child dd").text

# ---------------------------------------------------------------- code figures
def render_fig(f):
    sym = f.select_one(".sym").text
    path_el = f.select_one(".path")
    path = path_el.text if path_el else ""
    a = f.select_one("a.icon-btn")
    lang = f.select_one(".lang").text if f.select_one(".lang") else ""
    note = f.select_one(".code-note")
    code = f.select_one("code")
    body_el = f.select_one(".code-body")
    inline_snippet = "nolines" in (body_el.get("class") or [])
    if code.get("data-tpl"):
        n = templates[code["data-tpl"]].count('class="ln"')
        code_html = f'<code data-tpl="{code["data-tpl"]}"></code>'
    else:
        code_html = f"<code>{inner(code)}</code>"
        n = code_html.count('class="ln"')
    capped = n > 24
    title = f'<span class="sym">{esc(sym)}</span>'
    if path:
        title += f'<span class="path">{esc(path)}</span>'
    elif lang:
        title += f'<span class="path">{esc(lang)}</span>'
    tools = ""
    if a is not None:
        tools += f'<a href="{esc(a["href"])}" target="_blank" rel="noopener">GitHub</a>'
    tools += '<button type="button" class="copy">Copy</button>'
    cls = "code-body" + (" nolines" if inline_snippet else "") + (" capped" if capped else "")
    more = (
        f'<button type="button" class="code-more" data-more="Show all {n} lines">Show all {n} lines</button>'
        if capped else ""
    )
    note_html = f'<p class="code-note">{inner(note)}</p>' if note else ""
    return (
        f'<figure class="code" data-kind="{f["data-kind"]}">'
        f'<figcaption><span class="cap-title">{title}</span><span class="cap-tools">{tools}</span></figcaption>'
        f'{note_html}<div class="{cls}" tabindex="0" role="region" aria-label="{esc(sym)}"><pre>{code_html}</pre></div>{more}'
        f"</figure>"
    )


# ---------------------------------------------------------------- tests
def panel(card, suffix):
    return card.select_one(f'[id$="-panel-{suffix}"]')


parts = OrderedDict()
tests = []
source_rows = []  # (path, href, symbol, lines, test id)

for sec in soup.select("section.part"):
    eyebrow = sec.select_one(".eyebrow").text
    key = eyebrow.split("·")[0].strip()
    part = {
        "key": key,
        "short": key.replace("Part ", "") if key.startswith("Part") else "S",
        "title": sec.select_one("h2").text,
        "intro": inner(sec.select_one(".part-intro")),
        "tests": [],
    }
    parts[sec["id"]] = part
    for c in sec.select("article.card"):
        tid = c.select_one(".tid").text
        title = c.select_one("h3").text
        status = c["data-status"]
        # overview
        ov = panel(c, "overview")
        how = "".join(
            f'<p><b class="run-in">{esc(kv.select_one("dt").text)}.</b> {inner(kv.select_one("dd"))}</p>'
            for kv in ov.select(".kvs .kv")
        )
        table = ov.select_one("table.files")
        for tr in table.select("tbody tr"):
            tds = tr.select("td")
            if tds[0].text.strip() == "Implementation":
                a = tds[1].select_one("a")
                source_rows.append((tds[1].text.strip(), a["href"] if a else None, tds[2].text.strip(), tds[3].text.strip(), c["id"]))
        files_html = f'<div class="table-wrap">{table}</div>'
        # implementation + test logic
        impl_figs = "".join(render_fig(f) for f in panel(c, "impl").select("figure.code"))
        test_panel = panel(c, "test")
        check_figs, unit_figs = "", ""
        for f in test_panel.select("figure.code"):
            if f["data-kind"] == "unit":
                unit_figs += render_fig(f)
            else:
                check_figs += render_fig(f)
        # result
        res = panel(c, "result")
        asserts = res.select_one("ul.asserts")
        exch = res.select_one(".exchs")
        exch_html = ""
        n_exch = len(res.select("details.exch"))
        if n_exch:
            exch_html = str(exch).replace("<h5>", "<h6>").replace("</h5>", "</h6>")
        # swagger
        sw = panel(c, "swagger")
        sw_html = "".join(str(ch) if ch.name == "ol" else render_fig(ch) if ch.name == "figure" else "" for ch in sw.children if getattr(ch, "name", None))

        parts_html = [
            how,
            f'<h5>Implementation</h5>{files_html}{impl_figs}',
            f'<h5>Test logic</h5>{check_figs}',
        ]
        if unit_figs:
            parts_html.append(f'<h5>Repository tests covering the same behaviour</h5>{unit_figs}')
        if exch_html:
            parts_html.append(f'<h5>Request and response flow <span class="muted">({n_exch} recorded)</span></h5>{exch_html}')
        parts_html.append(f'<h5>Assertions</h5>{asserts}')

        swagger_panel = (
            f'<section class="swagger-panel" aria-label="Run {esc(tid)} in Swagger">'
            f'<header><span class="sp-label">Run in Swagger</span>'
            f'<a class="sp-open" href="{esc(swagger_href)}" target="_blank" rel="noopener">Open Swagger</a></header>'
            f'{sw_html}</section>'
        )
        endpoint = inner(c.select_one(".endpoint"))
        exp = inner(c.select_one(".outcome dd"))
        act = inner(c.select_one(".outcome .actual dd"))
        t = {
            "id": c["id"],
            "tid": tid,
            "title": title,
            "html": (
                f'<article class="test" id="{c["id"]}" data-search="{esc(c["data-search"])}">'
                f'<div class="test-meta"><span class="tid">{esc(tid)}</span><span class="verdict {status}">{status.capitalize()}</span></div>'
                f'<h4>{esc(title)}</h4>'
                f'<div class="endpoint">{endpoint}</div>'
                f'<p class="sum">{inner(c.select_one(".card-sum"))}</p>'
                f'<dl class="outcome"><div><dt>Expected</dt><dd>{exp}</dd></div><div class="actual"><dt>Actual</dt><dd>{act}</dd></div></dl>'
                f'{swagger_panel}'
                f'<details class="impl"><summary>Implementation details<span class="chev" aria-hidden="true"></span></summary>'
                f'<div class="impl-body">{"".join(parts_html)}</div></details>'
                f"</article>"
            ),
        }
        part["tests"].append(t)
        tests.append(t)

n_tests = len(tests)
n_passed = sum(1 for c in soup.select("article.card") if c["data-status"] == "passed")

# tests HTML + contents
tests_html = ""
contents_html = ""
for p in parts.values():
    count = len(p["tests"])
    eyebrow = ("Setup" if p["short"] == "S" else p["key"]) + f" · {count} test{'s' if count != 1 else ''}"
    tests_html += (
        f'<section class="part" id="part-{p["short"].lower()}"><header class="part-head"><span class="part-letter" aria-hidden="true">{esc(p["short"])}</span>'
        f'<div><p class="eyebrow">{esc(eyebrow)}</p>'
        f'<h3>{esc(p["title"])}</h3><p class="part-intro">{p["intro"]}</p></div></header>'
        + "".join(t["html"] for t in p["tests"])
        + "</section>"
    )
    ids = "".join(f'<a href="#{t["id"]}" data-target="{t["id"]}" title="{esc(t["title"])}">{esc(t["tid"])}</a>' for t in p["tests"])
    contents_html += (
        f'<li><span class="k">{esc(p["short"] if p["short"] == "S" else "Part " + p["short"])}</span>'
        f'<span><span class="n">{esc(p["title"])}</span><span class="ids">{ids}</span></span></li>'
    )

# ---------------------------------------------------------------- source index
by_file = OrderedDict()
for path, href, sym, lines, tid in sorted(source_rows, key=lambda r: r[0]):
    e = by_file.setdefault(path, {"href": href, "syms": OrderedDict()})
    e["syms"].setdefault(sym, [])
    if tid not in e["syms"][sym]:
        e["syms"][sym].append(tid)
rows = ""
for path, e in by_file.items():
    link = esc(e["href"].split("#")[0]) if e["href"] else None
    p_html = f'<a href="{link}" target="_blank" rel="noopener">{esc(path)}</a>' if link else esc(path)
    syms = "<br>".join(f"<code>{esc(s)}</code>" for s in e["syms"])
    ts = "<br>".join(" ".join(f'<a href="#{t}">{t.upper()}</a>' for t in tt) for tt in e["syms"].values())
    rows += f'<tr><td class="mono">{p_html}</td><td>{syms}</td><td class="mono">{ts}</td></tr>'
n_source_files = len(by_file)

# ---------------------------------------------------------------- page
flags_rows = "".join(f"<tr><td><code>{esc(k)}</code></td><td><code>{esc(v)}</code></td></tr>" for k, v in flags)
flag_d = dict(flags)

PAGE = (TOOLS / "page.html").read_text(encoding="utf-8")
subs = {
    "%%STYLE%%": (TOOLS / "style.css").read_text(encoding="utf-8"),
    "%%SCRIPT%%": (TOOLS / "app.js").read_text(encoding="utf-8"),
    "%%SWAGGER_HREF%%": esc(swagger_href),
    "%%COMMIT_HREF%%": esc(commit_href),
    "%%COMMIT_SHORT%%": esc(commit_short),
    "%%LAST_RUN%%": esc(last_run),
    "%%N_TESTS%%": str(n_tests),
    "%%N_PASSED%%": str(n_passed),
    "%%N_SOURCE%%": source_files_traced,
    "%%N_INDEX_FILES%%": str(n_source_files),
    "%%FLAGS_ROWS%%": flags_rows,
    "%%CONTENTS%%": contents_html,
    "%%TESTS%%": tests_html,
    "%%SOURCE_INDEX_ROWS%%": rows,
    "%%TEMPLATES%%": "".join(f'<template id="tpl-{k}">{v}</template>' for k, v in templates.items()),
}
for k, v in subs.items():
    PAGE = PAGE.replace(k, v)
left = re.findall(r"%%[A-Z_]+%%", PAGE)
if left:
    sys.exit(f"unresolved placeholders: {set(left)}")
(ROOT / "index.html").write_text(PAGE, encoding="utf-8")
print(f"index.html: {len(PAGE) / 1024:.0f} KiB, {n_tests} tests, {n_source_files} source files, {len(templates)} excerpts")
