// Every leaderboard the site has. `better` decides how a pilot's best run is
// picked and how the board is ordered; `min`/`max` are sanity bounds that reject
// obviously impossible (scripted or tampered) results.
import { LANGS, dailyKey } from '../public/js/words.js';

const catalog = {};

for (const lang of LANGS) {
  for (const seconds of [15, 30, 60]) {
    catalog[`typing-${seconds}-${lang}`] = {
      group: 'typing', better: 'high', unit: 'WPM', min: 1, max: 300,
      label: `Klavye GP · ${seconds} sn · ${lang.toUpperCase()}`,
      validate: (d) => num(d.accuracy, 75, 100) && num(d.raw, 0, 350)
    };
  }
  catalog[`typing-daily-${lang}`] = {
    group: 'daily', better: 'high', unit: 'WPM', min: 1, max: 300, period: 'day',
    label: `Günlük Grand Prix · ${lang.toUpperCase()}`,
    validate: (d) => num(d.accuracy, 75, 100) && d.day === dailyKey()
  };
}

catalog.reflex = {
  group: 'reflex', better: 'low', unit: 'ms', min: 100, max: 1500,
  label: 'Start Işıkları',
  // one start = one result; under 100 ms is anticipation, not reaction (rejected by `min`)
  validate: () => true
};

for (const seconds of [5, 10]) {
  catalog[`cpm-${seconds}`] = {
    group: 'cpm', better: 'high', unit: 'CPM', min: 1, max: 1500, // 25 clicks/sec ceiling
    label: `Pit Stop Tıklama · ${seconds} sn`,
    validate: (d) => num(d.clicks, 1, 25 * seconds) && Math.abs(d.clicks * (60 / seconds) - d._score) < 1
  };
}

function num(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

export const CATALOG = catalog;

export function validateScore(test, score, details) {
  const entry = catalog[test];
  if (!entry) return 'Bilinmeyen test.';
  if (!num(score, entry.min, entry.max)) return 'Skor geçerli aralıkta değil.';
  if (!details || typeof details !== 'object' || Array.isArray(details)) return 'Detaylar eksik.';
  if (JSON.stringify(details).length > 500) return 'Detaylar çok büyük.';
  if (!entry.validate({ ...details, _score: score })) return 'Sonuç doğrulanamadı.';
  return null;
}

export function publicCatalog() {
  return Object.fromEntries(
    Object.entries(catalog).map(([k, v]) => [k, { group: v.group, better: v.better, unit: v.unit, label: v.label }])
  );
}
