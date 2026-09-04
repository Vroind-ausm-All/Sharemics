#!/usr/bin/env node
/**
 * Packt die gebaute Website in eine einzige HTML-Datei.
 *
 * Praktisch zum Verschicken, Anschauen ohne Server und für ein schnelles
 * Feedback per Doppelklick. Für den echten Betrieb bleibt dist/ maßgeblich —
 * dort sind die Seiten einzeln, mit sauberen URLs und eigenen Metadaten.
 *
 *   node build.mjs && node preview.mjs   →  sharemics-vorschau.html
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "sharemics-vorschau.html");

const between = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Marker nicht gefunden: ${startMarker}`);
  return source.slice(start + startMarker.length, end);
};

/** SVG als data:-URI — url-kodiert statt base64, das ist kleiner und lesbar. */
const dataUri = (svg) =>
  "data:image/svg+xml," +
  encodeURIComponent(svg.replace(/\s+/g, " ").trim())
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/'/g, "%27");

async function main() {
  const files = (await readdir(DIST)).filter((f) => f.endsWith(".html")).sort();
  const pages = new Map();
  for (const file of files) {
    pages.set(file, await readFile(path.join(DIST, file), "utf8"));
  }

  const index = pages.get("index.html");

  // Ornamente in das Stylesheet einbetten, damit keine Datei mehr fehlen kann.
  let css = await readFile(path.join(DIST, "assets/css/style.css"), "utf8");
  for (const name of ["meander", "anthemion", "wave-scroll", "vitruvian"]) {
    const svg = await readFile(path.join(DIST, `assets/img/ornaments/${name}.svg`), "utf8");
    css = css.replaceAll(`url("../img/ornaments/${name}.svg")`, `url("${dataUri(svg)}")`);
  }

  const js = await readFile(path.join(DIST, "assets/js/app.js"), "utf8");

  const header = between(index, "<body class=\"\">", "<main id=\"hauptinhalt\">");
  const chrome = between(index, "</main>", "<script src=");

  const sections = [];
  const seenIds = new Map();
  for (const [file, html] of pages) {
    const slug = file.replace(/\.html$/, "");
    const content = between(html, '<main id="hauptinhalt">', "</main>");
    const title = between(html, "<title>", "</title>");
    for (const id of content.matchAll(/\sid="([^"]+)"/g)) {
      const previous = seenIds.get(id[1]);
      if (previous) console.warn(`  ! doppelte id "${id[1]}" in ${previous} und ${file}`);
      else seenIds.set(id[1], file);
    }
    sections.push(
      `<div class="preview-page" data-page="${slug}" data-title="${title}" hidden>\n${content}\n</div>`
    );
  }

  const router = `
/* Nur in der Vorschau: die Einzelseiten liegen alle im Dokument und werden
   über den Hash umgeschaltet. In dist/ sind es echte, getrennte Seiten. */
(() => {
  const pages = document.querySelectorAll(".preview-page");
  const links = document.querySelectorAll('a[href$=".html"]');

  function show(slug) {
    let found = false;
    pages.forEach((page) => {
      const match = page.dataset.page === slug;
      page.hidden = !match;
      if (match) {
        found = true;
        document.title = page.dataset.title;
        page.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
      }
    });
    if (!found && slug !== "index") return show("index");
    document.querySelectorAll(".nav-list a").forEach((a) => {
      const target = a.getAttribute("href").replace(/\\.html$/, "");
      a.toggleAttribute("aria-current", target === slug);
      if (target === slug) a.setAttribute("aria-current", "page");
    });
    window.scrollTo({ top: 0 });
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const slug = link.getAttribute("href").replace(/\\.html$/, "");
      history.replaceState(null, "", "#" + slug);
      show(slug);
      document.getElementById("siteNav")?.classList.remove("is-open");
    });
  });

  addEventListener("hashchange", () => show(location.hash.slice(1) || "index"));
  show(location.hash.slice(1) || "index");
})();`;

  const head = between(index, "<head>", "</head>")
    .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
    .replace(/<link rel="icon"[^>]*>/, "")
    .replace(/<title>[^<]*<\/title>/, "<title>Sharemics — Vorschau</title>");

  const html = `<!doctype html>
<html lang="de">
<head>
${head}
<style>.preview-page[hidden]{display:none}</style>
</head>
<body>
${header}
<main id="hauptinhalt">
${sections.join("\n\n")}
</main>
${chrome}
<script>
${js}
${router}
</script>
</body>
</html>
`;

  await writeFile(OUT, html, "utf8");
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`✓ sharemics-vorschau.html — ${pages.size} Seiten in einer Datei, ${kb} kB`);
}

await main();
