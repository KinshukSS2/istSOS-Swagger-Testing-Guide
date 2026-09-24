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


# Who acts in each test: drives the role filter chips and the at-a-glance table.
ROLES = {
    "s0": ["admin"], "a1": ["anonymous"], "a2": ["admin"], "a3": ["admin"], "a4": ["admin"],
    "a5": ["viewer"], "a6": ["viewer"], "a7": ["viewer"], "a8": ["admin"], "a9": ["editor"],
    "a10": ["editor"], "a11": ["admin", "anonymous"], "a12": ["admin"],
    "b1": ["external"], "b2": ["external"], "b3": ["admin", "external"], "b4": ["external"],
    "c1": ["admin"], "c2": ["anonymous"], "c3": ["viewer", "admin"], "c4": ["viewer"],
    "c5": ["viewer"], "c6": ["editor"], "c7": ["editor"], "c8": ["viewer"],
    "c9": ["viewer", "admin"], "c10": ["viewer", "external"],
    "d1": ["admin", "custom"], "d2": ["admin"], "d3": ["custom"], "d4": ["admin", "custom"],
    "d5": ["external", "custom", "admin"],
}
TABS = [
    ("swagger", "Swagger steps"),
    ("implementation", "Implementation"),
    ("logic", "Test logic"),
    ("exchanges", "Request/Response"),
    ("assertions", "Assertions"),
]
IO_CAP_LINES = 14


def badge(m):
    return f'<span class="method m-{m.lower()}">{m}</span>'


def wrap_exchanges(exch_html):
    """Give every recorded body a copy button, and cap long ones behind a toggle."""
    xs = BeautifulSoup(exch_html, "html.parser")
    for pre in xs.select("pre.io"):
        long = pre.get_text().count("\n") + 1 > IO_CAP_LINES
        wrap = xs.new_tag("div", attrs={"class": "io-wrap" + (" capped" if long else "")})
        pre.wrap(wrap)
        btn = xs.new_tag("button", attrs={"type": "button", "class": "io-copy"})
        btn.string = "Copy"
        wrap.append(btn)
        if long:
            more = xs.new_tag("button", attrs={"type": "button", "class": "io-more"})
            more.string = "Show full response"
            wrap.insert_after(more)
    return str(xs)


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
        cid = c["id"]
        tid = c.select_one(".tid").text
        title = c.select_one("h3").text
        status = c["data-status"]
        # overview -> implementation tab
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
                source_rows.append((tds[1].text.strip(), a["href"] if a else None, tds[2].text.strip(), tds[3].text.strip(), cid))
        files_html = f'<div class="table-wrap">{table}</div>'
        impl_figs = "".join(render_fig(f) for f in panel(c, "impl").select("figure.code"))
        test_panel = panel(c, "test")
        check_figs, unit_figs = "", ""
        for f in test_panel.select("figure.code"):
            if f["data-kind"] == "unit":
                unit_figs += render_fig(f)
            else:
                check_figs += render_fig(f)
        res = panel(c, "result")
        asserts = res.select_one("ul.asserts")
        exch = res.select_one(".exchs")
        n_exch = len(res.select("details.exch"))
        sw = panel(c, "swagger")
        sw_html = "".join(str(ch) if ch.name == "ol" else render_fig(ch) if ch.name == "figure" else "" for ch in sw.children if getattr(ch, "name", None))

        # endpoint: method badges + path
        ep = c.select_one(".endpoint")
        mspan = ep.select_one(".method").text
        path = ep.select_one("code").text
        methods = list(OrderedDict.fromkeys(re.findall(r"\b(GET|POST|PATCH|PUT|DELETE|SQL)\b", mspan + " " + path)))
        badges = "".join(badge(m) for m in [m.strip() for m in mspan.split("·")])
        exp = inner(c.select_one(".outcome dd"))
        act = inner(c.select_one(".outcome .actual dd"))
        codes = list(OrderedDict.fromkeys(re.findall(r"\b([1-5]\d\d)\b", c.select_one(".outcome dd").text)))
        roles = ROLES.get(cid, [])

        panels = OrderedDict()
        panels["swagger"] = (
            f'<section class="swagger-panel" aria-label="Run {esc(tid)} in Swagger">'
            f'<header><span class="sp-label">Run in Swagger</span>'
            f'<a class="sp-open" href="{esc(swagger_href)}" target="_blank" rel="noopener">Open Swagger</a></header>'
            f'{sw_html}</section>'
        )
        panels["implementation"] = f'{how}<h5>Source files</h5>{files_html}{impl_figs}'
        logic = check_figs
        if unit_figs:
            logic += f'<h5>Repository tests covering the same behaviour</h5>{unit_figs}'
        panels["logic"] = logic
        if n_exch:
            panels["exchanges"] = (
                f'<p class="panel-note">{n_exch} request{"s" if n_exch != 1 else ""} recorded during the verified run, in order. Open one to see its body.</p>'
                + wrap_exchanges(str(exch))
            )
        panels["assertions"] = str(asserts)

        tabs_html = ""
        panels_html = ""
        for i, (key_, label) in enumerate([t for t in TABS if t[0] in panels]):
            sel = i == 0
            tabs_html += (
                f'<button type="button" role="tab" id="{cid}-tab-{key_}" aria-controls="{cid}-p-{key_}" '
                f'aria-selected="{"true" if sel else "false"}" tabindex="{0 if sel else -1}" data-tab="{key_}">'
                f'<span class="tab-n" aria-hidden="true">{i + 1}</span>{label}'
                + (f'<span class="tab-count">{n_exch}</span>' if key_ == "exchanges" else "")
                + "</button>"
            )
            panels_html += (
                f'<div class="tabpanel" role="tabpanel" id="{cid}-p-{key_}" aria-labelledby="{cid}-tab-{key_}" data-tab="{key_}" tabindex="0"{"" if sel else " hidden"}>'
                f"{panels[key_]}</div>"
            )

        search = " ".join([c["data-search"], " ".join(roles), " ".join(m.lower() for m in methods)])
        t = {
            "id": cid, "tid": tid, "title": title, "status": status, "path": path,
            "methods": methods, "badges": badges, "roles": roles, "codes": codes,
            "part": part["short"],
            "search": search, "sum": inner(c.select_one(".card-sum")), "exp": exp, "act": act,
            "tabs": tabs_html, "panels": panels_html,
        }
        part["tests"].append(t)
        tests.append(t)

n_tests = len(tests)
n_passed = sum(1 for c in soup.select("article.card") if c["data-status"] == "passed")


def render_test(t, prev, nxt):
    nav = '<nav class="test-nav" aria-label="Adjacent tests">'
    nav += (f'<a class="tn-prev" href="#{prev["id"]}"><span class="tn-k">Previous</span><span><b>{esc(prev["tid"])}</b> {esc(prev["title"])}</span></a>'
            if prev else '<span></span>')
    nav += (f'<a class="tn-next" href="#{nxt["id"]}"><span class="tn-k">Next</span><span><b>{esc(nxt["tid"])}</b> {esc(nxt["title"])}</span></a>'
            if nxt else '<span></span>')
    nav += "</nav>"
    cid = t["id"]
    return (
        f'<article class="test" id="{cid}" data-search="{esc(t["search"].lower())}" '
        f'data-methods="{" ".join(m.lower() for m in t["methods"])}" data-roles="{" ".join(t["roles"])}" '
        f'data-part="{t["part"]}" aria-labelledby="{cid}-title">'
        f'<header class="test-head">'
        f'<div class="test-meta"><span class="tid">{esc(t["tid"])}</span>{t["badges"]}'
        f'<code class="ep">{esc(t["path"])}</code>'
        f'<span class="pill {t["status"]}">{t["status"].capitalize()}</span>'
        f'<a class="anchor" href="#{cid}" aria-label="Link to {esc(t["tid"])}" title="Copy link to {esc(t["tid"])}">#</a></div>'
        f'<h4 id="{cid}-title"><button type="button" class="test-toggle" aria-expanded="false" aria-controls="{cid}-body">'
        f'<span class="tt" data-text="{esc(t["title"])}">{esc(t["title"])}</span></button>'
        f'<span class="chev" aria-hidden="true"></span></h4>'
        f'<p class="sum">{t["sum"]}</p>'
        f'<dl class="outcome"><div><dt>Expected</dt><dd>{t["exp"]}</dd></div><div class="actual"><dt>Actual</dt><dd>{t["act"]}</dd></div></dl>'
        f"</header>"
        f'<div class="test-body" id="{cid}-body" hidden>'
        f'<div class="tabs" role="tablist" aria-label="{esc(t["tid"])} details">{t["tabs"]}</div>'
        f'{t["panels"]}{nav}</div>'
        f"</article>"
    )


tests_html = ""
nav_tests = ""
glance_rows = ""
flat = [t for p in parts.values() for t in p["tests"]]
pos = {t["id"]: i for i, t in enumerate(flat)}
for pid, p in parts.items():
    count = len(p["tests"])
    label = "Setup" if p["short"] == "S" else p["key"]
    eyebrow = label + f" · {count} test{'s' if count != 1 else ''}"
    sec_id = f'part-{p["short"].lower()}'
    body = ""
    for t in p["tests"]:
        i = pos[t["id"]]
        body += render_test(t, flat[i - 1] if i > 0 else None, flat[i + 1] if i + 1 < len(flat) else None)
    tests_html += (
        f'<section class="part" id="{sec_id}" data-label="{esc(label)}"><header class="part-head"><span class="part-letter" aria-hidden="true">{esc(p["short"])}</span>'
        f'<div class="ph-text"><p class="eyebrow">{esc(eyebrow)}</p>'
        f'<h3>{esc(p["title"])}</h3><p class="part-intro">{p["intro"]}</p>'
        f'<p class="part-tools"><button type="button" class="linkbtn" data-expand="{sec_id}">Expand all</button>'
        f'<span class="sep" aria-hidden="true">/</span><button type="button" class="linkbtn" data-collapse="{sec_id}">Collapse all</button></p>'
        f'</div></header>{body}</section>'
    )
    items = "".join(
        f'<li><a class="nav-item" href="#{t["id"]}" data-id="{t["id"]}" title="{esc(t["tid"])} · {esc(t["title"])}">'
        f'<span class="nid">{esc(t["tid"])}</span>{badge(t["methods"][0])}'
        f'<span class="nt" data-text="{esc(t["title"])}">{esc(t["title"])}</span>'
        f'<span class="dot {t["status"]}" title="{t["status"].capitalize()}"></span></a></li>'
        for t in p["tests"]
    )
    nav_tests += (
        f'<details class="nav-group" data-group="{sec_id}"><summary>'
        f'<a class="ng-link" href="#{sec_id}" data-id="{sec_id}"><span class="ng-k">{esc(label)}</span>'
        f'<span class="ng-title">{esc(p["title"])}</span></a><span class="ng-count">{count}</span></summary>'
        f'<ul>{items}</ul></details>'
    )
    for t in p["tests"]:
        roles = " ".join(f'<span class="role">{r}</span>' for r in t["roles"])
        codes = " ".join(f'<span class="st st-{c[0]}">{c}</span>' for c in t["codes"]) or '<span class="muted">—</span>'
        glance_rows += (
            f'<tr data-id="{t["id"]}"><td><a class="g-id" href="#{t["id"]}">{esc(t["tid"])}</a></td>'
            f'<td class="g-m">{t["badges"]}</td>'
            f'<td><a class="g-title" href="#{t["id"]}">{esc(t["title"])}</a><code class="g-ep">{esc(t["path"])}</code></td>'
            f'<td class="g-roles">{roles}</td><td class="g-codes">{codes}</td>'
            f'<td><span class="dot {t["status"]}"></span><span class="sr">{t["status"]}</span></td></tr>'
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
    "%%NAV_TESTS%%": nav_tests,
    "%%GLANCE_ROWS%%": glance_rows,
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
