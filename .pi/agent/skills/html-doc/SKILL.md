---
name: html-doc
description: Convert any markdown document into self-contained HTML views — a slide deck (deck.html) and a vertical-scroll page with sticky left nav (scroll.html). Pure mechanical transform; no rewriting, no judgment. Trigger when user asks to render markdown as HTML deck/scroll, make slides, or convert docs to HTML.
---

# html-doc

Convert any markdown file into HTML files. Mechanical transform. No rewriting — only re-layout into the templates below.

## Input

Path to a markdown file (absolute or relative). Optional second arg: output directory (defaults to same dir as input).

## Output

Write files alongside input (or in specified output dir):
- `<basename>.scroll.html` — vertical-scroll page with sticky left nav
- `<basename>.deck.html` — slide deck, arrow-key nav

## Workflow

1. Read input markdown.
2. Extract H1 (`# `) as `{{TITLE}}`. If no H1, use input filename.
3. Extract any meta lines directly under H1 (lines starting with `**` or short paragraphs before first `##`) as `{{META_LINES}}`.
4. Parse sections by `## ` headings. Each `##` = one slide / one nav entry.
5. Treat `### ` as subheadings inside the same section (do not split).
6. Generate section IDs by slugifying heading text: lowercase, strip punctuation, replace whitespace with `-`. If duplicate slug, append `-2`, `-3`.
7. Convert markdown → HTML inline:
   - `**bold**` → `<strong>`
   - `*italic*` → `<em>`
   - `` `code` `` → `<code>`
   - Triple-backtick fenced blocks → `<pre><code>...</code></pre>` (preserve language class)
   - `[text](url)` → `<a href="url">text</a>`
   - `![alt](url)` → `<img src="url" alt="alt">`
   - Markdown tables → `<table><tr><th>...</th></tr><tr><td>...</td></tr></table>`
   - Lists (`- `, `* `, `1.`) → `<ul>` / `<ol>` (nested lists supported)
   - Blockquotes (`> `) → `<blockquote>`
   - Horizontal rules (`---` inside sections) → `<hr>`
   - `~~strikethrough~~` → `<del>`
8. Detect pill keywords in table cells or list items: standalone "High"/"Medium"/"Low" → `<span class="pill high|med|low">`. Skip ambiguous.
9. Report: file paths + section count + done.

## Style Rules

- Self-contained. No external CSS, JS, fonts, or images.
- Dark theme. Use colors from templates below exactly — do not change palette.
- Tables: render as-is, don't collapse rows or summarize.
- Code blocks: monospace font, dark background, no syntax highlighting.
- Don't summarize. Don't drop bullets. Don't reorder. Faithful 1:1 conversion.

---

## Scroll Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{TITLE}} — Scroll</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #0f1419; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .layout { display: flex; min-height: 100vh; }
  nav.side { width: 260px; background: #161b22; border-right: 1px solid #30363d; padding: 1.5rem 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; }
  nav.side h3 { color: #f78166; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; padding: 0 1.2rem 0.8rem; border-bottom: 1px solid #30363d; margin-bottom: 0.5rem; }
  nav.side a { display: block; padding: 0.5rem 1.2rem; color: #8b949e; text-decoration: none; font-size: 0.9rem; border-left: 3px solid transparent; transition: all 0.15s; }
  nav.side a:hover { color: #e6edf3; background: #21262d; }
  nav.side a.active { color: #58a6ff; border-left-color: #58a6ff; background: #21262d; }
  nav.side .num { color: #6e7681; margin-right: 0.5em; font-variant-numeric: tabular-nums; }
  main { flex: 1; max-width: 1100px; padding: 2rem 4rem 6rem; }
  section { min-height: 60vh; padding: 3rem 0; border-bottom: 1px solid #21262d; scroll-margin-top: 1rem; }
  section:last-child { border-bottom: none; }
  h1 { font-size: 2.6rem; margin-bottom: 0.4em; color: #f78166; }
  h2 { font-size: 1.9rem; margin-bottom: 0.7em; color: #58a6ff; border-bottom: 2px solid #30363d; padding-bottom: 0.3em; }
  h3 { font-size: 1.25rem; margin: 1em 0 0.4em; color: #7ee787; }
  p, li { font-size: 1rem; line-height: 1.65; margin-bottom: 0.5em; }
  ul, ol { padding-left: 1.5em; margin-bottom: 0.8em; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.95rem; }
  th, td { border: 1px solid #30363d; padding: 0.5em 0.8em; text-align: left; vertical-align: top; }
  th { background: #161b22; color: #58a6ff; }
  code { background: #161b22; padding: 0.1em 0.4em; border-radius: 3px; color: #f78166; font-family: "SF Mono", Monaco, monospace; font-size: 0.9em; }
  pre { background: #161b22; padding: 1em; border-radius: 4px; overflow-x: auto; margin: 0.8em 0; }
  pre code { background: transparent; padding: 0; color: #e6edf3; font-size: 0.9rem; }
  blockquote { border-left: 4px solid #30363d; padding: 0.5em 1em; margin: 0.8em 0; color: #8b949e; }
  a { color: #58a6ff; }
  .meta { color: #8b949e; font-size: 1rem; margin-top: 0.3em; }
  .pill { display: inline-block; padding: 0.2em 0.7em; border-radius: 12px; font-size: 0.85rem; margin: 0.2em 0.3em 0.2em 0; }
  .pill.high { background: #5a1d1d; color: #ffa198; }
  .pill.med { background: #5a4a1d; color: #ffd866; }
  .pill.low { background: #1d3b1d; color: #7ee787; }
  .pill.good { background: #1d3b5a; color: #79c0ff; }
  .small { font-size: 0.85rem; color: #8b949e; }
  hr { border: none; border-top: 1px solid #30363d; margin: 1em 0; }
  img { max-width: 100%; }
  @media (max-width: 900px) {
    nav.side { width: 180px; }
    main { padding: 1.5rem 1.5rem 4rem; }
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="side">
    <h3>{{NAV_TITLE}}</h3>
{{NAV_LINKS}}
  </nav>
  <main>
    <section id="title"><h1>{{TITLE}}</h1>{{META_LINES}}</section>
{{SECTIONS}}
  </main>
</div>
<script>
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('nav.side a');
  const linkMap = {};
  navLinks.forEach(a => linkMap[a.getAttribute('href').slice(1)] = a);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const link = linkMap[e.target.id];
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(s => observer.observe(s));
</script>
</body>
</html>
```

`{{NAV_TITLE}}` = `{{TITLE}}` truncated to ~30 chars if longer.
`{{NAV_LINKS}}` = one line per section: `    <a href="#SLUG"><span class="num">NN</span>HEADING</a>` (NN is zero-padded 01, 02, ...).
`{{SECTIONS}}` = `<section id="SLUG"><h2>HEADING</h2>BODY_HTML</section>`

---

## Deck Template

Use the same styles as scroll, plus:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{TITLE}} — Deck</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: #0f1419; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; overflow: hidden; }
  .deck { height: 100vh; width: 100vw; overflow: hidden; position: relative; }
  .slide { position: absolute; inset: 0; padding: 4vh 6vw; display: none; flex-direction: column; overflow-y: auto; }
  .slide.active { display: flex; }
  h1 { font-size: 2.8rem; margin-bottom: 0.3em; color: #f78166; }
  h2 { font-size: 2.2rem; margin-bottom: 0.6em; color: #58a6ff; border-bottom: 2px solid #30363d; padding-bottom: 0.3em; }
  h3 { font-size: 1.4rem; margin: 0.8em 0 0.4em; color: #7ee787; }
  p, li { font-size: 1.1rem; line-height: 1.6; margin-bottom: 0.5em; }
  ul, ol { padding-left: 1.5em; margin-bottom: 0.8em; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.95rem; }
  th, td { border: 1px solid #30363d; padding: 0.5em 0.8em; text-align: left; vertical-align: top; }
  th { background: #161b22; color: #58a6ff; }
  code { background: #161b22; padding: 0.1em 0.4em; border-radius: 3px; color: #f78166; font-family: "SF Mono", Monaco, monospace; font-size: 0.9em; }
  pre { background: #161b22; padding: 1em; border-radius: 4px; overflow-x: auto; margin: 0.8em 0; }
  pre code { background: transparent; padding: 0; color: #e6edf3; font-size: 0.9rem; }
  blockquote { border-left: 4px solid #30363d; padding: 0.5em 1em; margin: 0.8em 0; color: #8b949e; }
  .meta { color: #8b949e; font-size: 1rem; margin-top: 0.5em; }
  .nav { position: fixed; bottom: 1rem; right: 1.5rem; color: #8b949e; font-size: 0.9rem; z-index: 100; }
  .controls { position: fixed; bottom: 1rem; left: 1.5rem; z-index: 100; }
  .controls button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; padding: 0.4em 1em; margin-right: 0.5em; cursor: pointer; border-radius: 4px; font-size: 0.9rem; }
  .controls button:hover { background: #30363d; }
  .title-slide { justify-content: center; align-items: center; text-align: center; }
  .title-slide h1 { font-size: 4rem; }
  .title-slide .meta { font-size: 1.3rem; margin-top: 1em; }
  .pill { display: inline-block; padding: 0.2em 0.7em; border-radius: 12px; font-size: 0.85rem; margin: 0.2em 0.3em 0.2em 0; }
  .pill.high { background: #5a1d1d; color: #ffa198; }
  .pill.med { background: #5a4a1d; color: #ffd866; }
  .pill.low { background: #1d3b1d; color: #7ee787; }
  .pill.good { background: #1d3b5a; color: #79c0ff; }
  a { color: #58a6ff; }
  .progress { position: fixed; top: 0; left: 0; height: 3px; background: #58a6ff; transition: width 0.3s; z-index: 200; }
  .small { font-size: 0.85rem; color: #8b949e; }
  hr { border: none; border-top: 1px solid #30363d; margin: 1em 0; }
  img { max-width: 100%; }
</style>
</head>
<body>
<div class="progress" id="progress"></div>
<div class="deck" id="deck">
{{SLIDES}}
</div>
<div class="controls">
  <button onclick="prev()">← Prev</button>
  <button onclick="next()">Next →</button>
</div>
<div class="nav"><span id="counter">1 / {{COUNT}}</span> · ← → arrows</div>
<script>
  const slides = document.querySelectorAll('.slide');
  let idx = 0;
  function show(i) {
    slides[idx].classList.remove('active');
    idx = (i + slides.length) % slides.length;
    slides[idx].classList.add('active');
    document.getElementById('counter').textContent = (idx + 1) + ' / ' + slides.length;
    document.getElementById('progress').style.width = ((idx + 1) / slides.length * 100) + '%';
  }
  function next() { show(idx + 1); }
  function prev() { show(idx - 1); }
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') next();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
    if (e.key === 'Home') show(0);
    if (e.key === 'End') show(slides.length - 1);
  });
  show(0);
</script>
</body>
</html>
```

`{{SLIDES}}` = concatenation of:
- First: `<section class="slide active title-slide"><h1>{{TITLE}}</h1>{{META_LINES}}</section>`
- Then one `<section class="slide">...</section>` per `##` heading.

`{{COUNT}}` = total slides (title + content).

## Done Criteria

- Files exist alongside input (or in specified output dir).
- Open in browser without errors.
- Section count matches.
- All markdown content preserved.
