// Server-side page shells: every URL gets its own <title>, description, canonical link
// and a readable first paint, so search engines see distinct pages without running JS.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, PATHS, pageFor } from '../public/js/pages.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createSeo(publicDir, site = process.env.SITE_URL || 'https://www.fingergp.com') {
  const SITE = site.replace(/\/+$/, '');
  const template = readFileSync(join(publicDir, 'index.html'), 'utf8');

  function head({ title, description, canonical, index = true, jsonLd }) {
    return [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(description)}">`,
      `<meta name="robots" content="${index ? 'index, follow' : 'noindex, follow'}">`,
      canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="FingerGP">`,
      `<meta property="og:locale" content="tr_TR">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
      `<meta property="og:image" content="${SITE}/img/icon-512.png">`,
      `<meta name="twitter:card" content="summary">`,
      jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''
    ].filter(Boolean).join('\n  ');
  }

  function body(page) {
    const about = (page.about || [])
      .map(([q, a]) => `<div><h2>${esc(q)}</h2><p>${esc(a)}</p></div>`).join('');
    return `<div class="page-head"><div><h1>${esc(page.heading)}</h1></div></div>
      <p class="muted">${esc(page.description)}</p>
      ${about ? `<section class="seo-copy">${about}</section>` : ''}`;
  }

  const fill = (h, b) => template.replace('<!--seo-->', h).replace('<!--prerender-->', b);

  // → { status, html }
  function render(rawPath) {
    const path = rawPath.replace(/\/+$/, '') || '/';
    const key = pageFor(path);

    if (key === 'pilot') {
      const name = decodeURIComponent(path.slice('/pilot/'.length));
      const page = { heading: name, description: `${name} adlı pilotun FingerGP rekorları ve son turları.` };
      return { status: 200, html: fill(head({ title: `${name} — Pilot profili | FingerGP`, description: page.description, index: false }), body(page)) };
    }
    if (!key) {
      const page = { heading: 'Pist bulunamadı', description: 'Aradığın sayfa yok. Ana sayfadan bir teste başlayabilirsin.' };
      return { status: 404, html: fill(head({ title: 'Sayfa bulunamadı | FingerGP', description: page.description, index: false }), body(page)) };
    }

    const page = PAGES[key];
    const isRoot = path === page.path;
    // sub-pages (a race room code, a specific board) point search engines at the main page
    const canonical = SITE + page.path;
    const jsonLd = key === 'home' ? {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'FingerGP',
      url: `${SITE}/`,
      inLanguage: 'tr',
      description: page.description
    } : {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.heading,
      url: canonical,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      inLanguage: 'tr',
      isAccessibleForFree: true,
      description: page.description
    };
    const index = isRoot;
    return { status: 200, html: fill(head({ title: page.title, description: page.description, canonical, index, jsonLd }), body(page)) };
  }

  const robots = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;

  function sitemap() {
    const priority = { home: '1.0', typing: '0.9', reflex: '0.9', clicks: '0.9', race: '0.8', daily: '0.8', leaderboard: '0.6' };
    const urls = Object.entries(PATHS).map(([key, p]) =>
      `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc><changefreq>${key === 'daily' || key === 'leaderboard' ? 'daily' : 'weekly'}</changefreq><priority>${priority[key]}</priority></url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  }

  return { render, robots, sitemap };
}
