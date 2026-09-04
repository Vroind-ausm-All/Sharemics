#!/usr/bin/env node
/**
 * Statischer Seitengenerator ohne Abhaengigkeiten.
 *
 * src/pages/*.html  → dist/*.html   (Layout + Platzhalter)
 * src/assets/**     → dist/assets/**
 * dazu: sitemap.xml, robots.txt
 *
 *   node build.mjs [--watch]
 */

import { readFile, writeFile, mkdir, readdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

/* ------------------------------------------------------------------ Helfer */

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const euro = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

/** Ersetzt {{ key }} durch Werte aus dem Kontext. Unbekannte Schluessel bleiben leer. */
const render = (template, ctx) =>
  template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), ctx);
    return value == null ? "" : String(value);
  });

/** Liest eine SVG-Datei und gibt sie zum Inlinen zurueck (ohne XML-Prolog). */
const svgCache = new Map();
async function inlineSvg(relative) {
  if (!svgCache.has(relative)) {
    const raw = await readFile(path.join(SRC, "assets", "img", relative), "utf8");
    svgCache.set(relative, raw.replace(/<\?xml[^>]*\?>\s*/, "").trim());
  }
  return svgCache.get(relative);
}

/* --------------------------------------------------------------- Fragmente */

function navHtml(site, active) {
  const links = site.nav
    .map(
      ([id, label, href]) =>
        `<li><a href="${href}"${id === active ? ' aria-current="page"' : ""}>${label}</a></li>`
    )
    .join("");
  return `<ul class="nav-list">${links}</ul>`;
}

function headerHtml(site, active, mark) {
  return `
<a class="skip-link" href="#hauptinhalt">Zum Inhalt springen</a>
<div class="announcement">
  <p>Kleine Serien · Wochenendkurse in Leipzig-Plagwitz · Abholung ohne Versandkosten</p>
</div>
<header class="site-header" id="siteHeader">
  <div class="shell header-inner">
    <a class="brand" href="index.html">
      <span class="brand-mark">${mark}</span>
      <span class="brand-text">
        <strong>Sharemics</strong>
        <span>${site.tagline}</span>
      </span>
    </a>
    <nav class="site-nav" id="siteNav" aria-label="Hauptnavigation">${navHtml(site, active)}</nav>
    <div class="header-actions">
      <button class="icon-button" id="themeToggle" type="button" aria-pressed="false"
              aria-label="Zwischen hellem und dunklem Modus wechseln">
        <span class="theme-icon" aria-hidden="true"></span>
      </button>
      <button class="cart-button" id="cartButton" type="button" aria-expanded="false" aria-controls="cartDrawer">
        <span>Korb</span>
        <span class="cart-count" id="cartCount" aria-hidden="true">0</span>
        <span class="visually-hidden" id="cartCountLabel">0 Artikel im Warenkorb</span>
      </button>
      <button class="icon-button nav-toggle" id="navToggle" type="button"
              aria-expanded="false" aria-controls="siteNav" aria-label="Menü öffnen">
        <span class="burger" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</header>`;
}

function footerHtml(site, mark) {
  const list = (items) =>
    items.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join("");
  const hours = site.opening.map(([d, t]) => `<div><dt>${d}</dt><dd>${t}</dd></div>`).join("");
  return `
<footer class="site-footer">
  <div class="ornament-band" data-ornament="meander" aria-hidden="true"></div>
  <div class="shell footer-inner">
    <div class="footer-brand">
      <span class="brand-mark">${mark}</span>
      <p class="footer-claim">Handgedrehte Gebrauchskeramik aus der alten Schlosserei am Karl-Heine-Kanal. Kleine Serien, ruhige Glasuren und Wochenenden mit Ton an den Händen.</p>
      <p class="footer-address">
        ${site.contact.street}, ${site.contact.postal} ${site.contact.city}<br>
        <a href="mailto:${site.contact.email}">${site.contact.email}</a><br>
        <a href="tel:${site.contact.phone.replace(/\s/g, "")}">${site.contact.phoneLabel}</a>
      </p>
    </div>
    <nav class="footer-col" aria-label="Entdecken">
      <h2>Entdecken</h2>
      <ul>${list(site.footer.entdecken)}</ul>
    </nav>
    <nav class="footer-col" aria-label="Service">
      <h2>Service</h2>
      <ul>${list(site.footer.service)}</ul>
    </nav>
    <div class="footer-col">
      <h2>Offen</h2>
      <dl class="footer-hours">${hours}</dl>
    </div>
  </div>
  <div class="shell footer-bottom">
    <p>© ${new Date().getFullYear()} Sharemics · Marle Ostermann &amp; Jonas Reh GbR</p>
    <ul class="footer-legal">${list(site.footer.rechtliches)}</ul>
  </div>
</footer>`;
}

async function productCard(product, { featured = false } = {}) {
  const svg = await inlineSvg(`vessels/${product.vessel}.svg`);
  const badge = product.badge ? `<span class="product-badge">${esc(product.badge)}</span>` : "";
  const low = product.stock <= 2 ? `<span class="product-stock">nur noch ${product.stock} Stück</span>` : "";
  return `
<article class="product-card reveal" data-category="${product.category}" data-price="${product.price}" data-name="${esc(product.name)}">
  <div class="product-figure tone-${product.tone}">
    ${badge}
    ${svg}
  </div>
  <div class="product-body">
    <p class="product-meta">${esc(product.meta)}</p>
    <h3 class="product-title">${esc(product.name)}</h3>
    <p class="product-story">${esc(product.story)}</p>
    <div class="product-foot">
      <p class="product-price">${euro(product.price)}${low}</p>
      <button class="button button-primary button-sm add-to-cart" type="button"
              data-id="${product.id}" data-name="${esc(product.name)}" data-price="${product.price}"
              data-vessel="${product.vessel}" data-tone="${product.tone}">
        In den Korb<span class="visually-hidden"> — ${esc(product.name)}</span>
      </button>
    </div>
  </div>
</article>`;
}

async function productGrid(products, options) {
  const cards = await Promise.all(products.map((p) => productCard(p, options)));
  return cards.join("\n");
}

function courseCards(courses) {
  return courses.formats
    .map(
      (f) => `
<article class="course-card reveal">
  <h3>${esc(f.title)}</h3>
  <p class="course-facts"><span>${esc(f.duration)}</span><span>${esc(f.level)}</span><span>max. ${f.seats} Plätze</span></p>
  <p>${esc(f.text)}</p>
  <p class="course-price">${euro(f.price)} <span>pro Person</span></p>
</article>`
    )
    .join("\n");
}

function journalCards(articles) {
  return articles
    .map(
      (a) => `
<article class="article-card reveal">
  <a class="article-link" href="${a.slug}.html">
    <div class="article-figure" data-ornament="${a.ornament}" aria-hidden="true"></div>
    <div class="article-body">
      <p class="article-meta"><span class="tag">${esc(a.category)}</span><time datetime="${a.date}">${esc(a.dateLabel)}</time> · ${esc(a.reading)}</p>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.excerpt)}</p>
      <p class="article-more">Weiterlesen</p>
    </div>
  </a>
</article>`
    )
    .join("\n");
}

function testimonialCards(items) {
  return items
    .map(
      (t) => `
<figure class="testimonial reveal">
  <div class="ornament-rule" data-ornament="wave-scroll" aria-hidden="true"></div>
  <blockquote>${esc(t.quote)}</blockquote>
  <figcaption>${esc(t.author)}, ${esc(t.city)}</figcaption>
</figure>`
    )
    .join("\n");
}

function processSteps(items) {
  return items
    .map(
      (p) => `
<li class="process-step reveal">
  <p class="process-num">${p.step}</p>
  <h3>${esc(p.title)}</h3>
  <p>${esc(p.text)}</p>
</li>`
    )
    .join("\n");
}

function valueCards(items) {
  return items
    .map(
      (v) => `
<article class="value-card reveal">
  <p class="value-num">${v.num}</p>
  <h3>${esc(v.title)}</h3>
  <p>${esc(v.text)}</p>
</article>`
    )
    .join("\n");
}

function courseIncludes(courses) {
  return courses.includes.map((i) => `<li>${esc(i)}</li>`).join("");
}

/* ----------------------------------------------------------- Strukturdaten */

function structuredData(page, site, products, courses) {
  const base = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${site.domain}/#werkstatt`,
    name: site.name,
    description: site.defaultDescription,
    url: site.domain,
    email: site.contact.email,
    telephone: site.contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contact.street,
      postalCode: site.contact.postal,
      addressLocality: site.contact.city,
      addressCountry: "DE",
    },
  };

  const graph = [base];

  if (page.slug === "shop") {
    graph.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Keramik im Sharemics Shop",
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Product",
          name: p.name,
          description: p.story,
          category: p.categoryLabel,
          offers: {
            "@type": "Offer",
            price: p.price,
            priceCurrency: "EUR",
            availability:
              p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        },
      })),
    });
  }

  if (page.slug === "kurse") {
    const formats = Object.fromEntries(courses.formats.map((f) => [f.id, f]));
    graph.push(
      ...courses.dates.slice(0, 6).map((d) => {
        const f = formats[d.format];
        return {
          "@context": "https://schema.org",
          "@type": "Event",
          name: f.title,
          startDate: d.date,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: "Sharemics Werkstatt",
            address: {
              "@type": "PostalAddress",
              streetAddress: site.contact.street,
              postalCode: site.contact.postal,
              addressLocality: site.contact.city,
              addressCountry: "DE",
            },
          },
          offers: {
            "@type": "Offer",
            price: f.price,
            priceCurrency: "EUR",
            availability: d.seats > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
          },
        };
      })
    );
  }

  if (page.article) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.title,
      datePublished: page.article.date,
      description: page.description,
      author: { "@type": "Organization", name: site.name },
    });
  }

  return graph.map((item) => JSON.stringify(item)).join("</script>\n<script type=\"application/ld+json\">");
}

/* -------------------------------------------------------------------- Build */

async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest);
    else await copyFile(src, dest);
  }
}

function parsePage(raw) {
  const match = raw.match(/^<!--\s*meta\s*([\s\S]*?)-->\s*/);
  if (!match) throw new Error("Seite ohne meta-Block");
  return { meta: JSON.parse(match[1]), body: raw.slice(match[0].length) };
}

async function build() {
  const [site, products, courses, journal] = await Promise.all([
    readJson(path.join(SRC, "data", "site.json")),
    readJson(path.join(SRC, "data", "products.json")),
    readJson(path.join(SRC, "data", "courses.json")),
    readJson(path.join(SRC, "data", "journal.json")),
  ]);

  const layout = await readFile(path.join(SRC, "layouts", "base.html"), "utf8");
  const mark = await inlineSvg("mark.svg");

  const featured = [
    ...products.filter((p) => p.badge),
    ...products.filter((p) => !p.badge),
  ].slice(0, 4);

  const fragments = {
    productsFeatured: await productGrid(featured),
    productsAll: await productGrid(products),
    courseCards: courseCards(courses),
    courseIncludes: courseIncludes(courses),
    journalCards: journalCards(journal),
    testimonials: testimonialCards(site.testimonials),
    processSteps: processSteps(site.process),
    valueCards: valueCards(site.values),
    courseDataJson: JSON.stringify({ formats: courses.formats, dates: courses.dates }),
    footer: footerHtml(site, mark),
  };

  // Einzelne Gefaess-Illustrationen zum direkten Einsetzen in Seiten
  for (const name of ["becher", "schale", "vase", "teller", "krug", "espresso", "platte", "karaffe"]) {
    fragments[`svg_${name}`] = await inlineSvg(`vessels/${name}.svg`);
  }

  // Alte Seiten entfernen, damit umbenannte Slugs keine Leichen hinterlassen.
  await mkdir(DIST, { recursive: true });
  for (const file of await readdir(DIST)) {
    if (file.endsWith(".html")) await rm(path.join(DIST, file));
  }

  const pageFiles = (await readdir(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));
  const built = [];

  for (const file of pageFiles) {
    const raw = await readFile(path.join(SRC, "pages", file), "utf8");
    const { meta, body } = parsePage(raw);
    const slug = meta.slug ?? path.basename(file, ".html");
    const out = slug === "index" ? "index.html" : `${slug}.html`;

    const ctx = {
      ...site,
      ...fragments,
      ...meta,
      slug,
      site,
      header: headerHtml(site, meta.nav ?? "", mark),
      canonical: `${site.domain}/${out === "index.html" ? "" : out}`,
      description: meta.description ?? site.defaultDescription,
      bodyClass: meta.bodyClass ?? "",
      structuredData: structuredData({ ...meta, slug }, site, products, courses),
      contact: site.contact,
    };

    const content = render(body, ctx);
    const html = render(layout, { ...ctx, content });
    const target = path.join(DIST, out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html, "utf8");
    built.push({ out, priority: meta.priority ?? 0.6, noindex: Boolean(meta.noindex) });
  }

  // Assets
  await copyDir(path.join(SRC, "assets"), path.join(DIST, "assets"));

  // sitemap + robots
  const urls = built
    .filter((b) => !b.noindex)
    .sort((a, b) => b.priority - a.priority)
    .map(
      (b) =>
        `  <url><loc>${site.domain}/${b.out === "index.html" ? "" : b.out}</loc>` +
        `<priority>${b.priority.toFixed(1)}</priority></url>`
    )
    .join("\n");
  await writeFile(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "utf8"
  );
  await writeFile(
    path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${site.domain}/sitemap.xml\n`,
    "utf8"
  );
  // GitHub Pages soll den Ordner nicht durch Jekyll schicken
  await writeFile(path.join(DIST, ".nojekyll"), "", "utf8");

  console.log(`✓ ${built.length} Seiten, ${products.length} Produkte, ${courses.dates.length} Kurstermine`);
}

await build();

if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  let timer;
  watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
  console.log("… beobachtet src/ (Strg+C zum Beenden)");
}
