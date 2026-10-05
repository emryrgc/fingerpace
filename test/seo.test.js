import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

async function start(t) {
  const server = createApp(openDb(':memory:')).listen(0);
  await new Promise((r) => server.once('listening', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path) => {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
  };
}

test('each test page is served with its own title, description and canonical URL', async (t) => {
  const get = await start(t);
  const typing = await get('/klavye-hiz-testi');
  assert.equal(typing.status, 200);
  assert.match(typing.body, /<title>Klavye Hız Testi \(WPM\)/);
  assert.match(typing.body, /<meta name="description" content="Ücretsiz klavye hız testi/);
  assert.match(typing.body, /<link rel="canonical" href="https:\/\/www\.fingergp\.com\/klavye-hiz-testi">/);
  assert.match(typing.body, /<meta name="robots" content="index, follow">/);
  assert.match(typing.body, /WPM nasıl hesaplanır\?/, 'readable copy is in the HTML itself');
  assert.doesNotMatch(typing.body, /<!--seo-->|<!--prerender-->/);

  const reflex = await get('/refleks-testi/');
  assert.match(reflex.body, /<title>Refleks Testi/);

  const home = await get('/');
  assert.match(home.body, /"@type":"WebSite"/);
});

test('room links and profiles are not indexed; unknown pages are 404', async (t) => {
  const get = await start(t);
  const room = await get('/canli-yaris/ABC12');
  assert.equal(room.status, 200);
  assert.match(room.body, /noindex/);
  assert.match(room.body, /<link rel="canonical" href="https:\/\/www\.fingergp\.com\/canli-yaris">/);

  const pilot = await get('/pilot/%3Cscript%3E');
  assert.match(pilot.body, /noindex/);
  assert.doesNotMatch(pilot.body, /<script>[^<]*— Pilot/, 'name is escaped');

  const missing = await get('/yok-boyle-bir-sayfa');
  assert.equal(missing.status, 404);
  assert.match(missing.body, /noindex/);
  assert.equal((await get('/js/yok.js')).status, 404);
});

test('robots.txt and sitemap.xml list the public pages', async (t) => {
  const get = await start(t);
  const robots = await get('/robots.txt');
  assert.match(robots.body, /Sitemap: https:\/\/www\.fingergp\.com\/sitemap\.xml/);
  assert.match(robots.body, /Disallow: \/api\//);
  const sitemap = await get('/sitemap.xml');
  assert.match(sitemap.type, /xml/);
  for (const p of ['/', '/klavye-hiz-testi', '/refleks-testi', '/cpm-testi', '/canli-yaris', '/gunluk-grand-prix', '/siralama']) {
    assert.ok(sitemap.body.includes(`<loc>https://www.fingergp.com${p}</loc>`), p);
  }
});
