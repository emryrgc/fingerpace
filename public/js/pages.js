// Page addresses and search-engine copy. Shared by the browser (titles, the "about"
// blocks under each test) and the server (pre-rendered <title>/<meta>, sitemap).

export const PATHS = {
  home: '/',
  typing: '/klavye-hiz-testi',
  daily: '/gunluk-grand-prix',
  reflex: '/refleks-testi',
  clicks: '/cpm-testi',
  race: '/canli-yaris',
  leaderboard: '/siralama'
};

// Old hash routes (#/typing …) → new paths, so shared links keep working.
export const LEGACY = {
  typing: PATHS.typing, daily: PATHS.daily, reflex: PATHS.reflex, clicks: PATHS.clicks,
  race: PATHS.race, leaderboard: PATHS.leaderboard, pilot: '/pilot'
};

export const PAGES = {
  home: {
    path: PATHS.home,
    title: 'FingerGP — Klavye Hız Testi, Refleks Testi ve CPM Testi',
    description: 'Klavye hız testi (WPM), F1 start ışıklı refleks testi ve mouse tıklama hızı (CPM) testi. Canlı yazma yarışlarında arkadaşlarınla yarış, sıralamada podyuma çık.',
    heading: 'Parmakların pistte',
    about: [
      ['FingerGP nedir?', 'FingerGP; klavye hız testi, refleks testi ve mouse CPM testini tek yerde toplayan, yarış temalı ücretsiz bir sitedir. Kayıt için şifre gerekmez: bir pilot adı seçersin, skorların günlük, haftalık ve tüm zamanlar sıralamalarına girer.'],
      ['Canlı yazma yarışı', 'Canlı yarışta 5 kişiye kadar pilot aynı anda aynı metni yazar. Start ışıkları sönünce yarış başlar, herkes rakiplerinin arabasını pistte canlı görür.']
    ]
  },
  typing: {
    path: PATHS.typing,
    title: 'Klavye Hız Testi (WPM) — Yazma Hızını Ölç | FingerGP',
    description: 'Ücretsiz klavye hız testi: 15, 30 veya 60 saniyede dakikada kaç kelime (WPM) yazdığını, doğruluğunu ve tuş vuruşu sayını ölç. Türkçe ve İngilizce.',
    heading: 'Klavye hız testi',
    about: [
      ['Klavye hız testi nasıl yapılır?', 'Süreyi (15, 30 veya 60 saniye) ve dili seç, ilk tuşa bastığın an saat başlar. Ekrandaki kelimeleri olabildiğince hızlı ve doğru yaz; süre bitince WPM, doğruluk, hata ve tuş vuruşu sayın gösterilir.'],
      ['WPM nasıl hesaplanır?', 'WPM (words per minute), dakikada yazılan kelime sayısıdır. Standart olarak her 5 doğru karakter (boşluklar dahil) bir kelime sayılır: WPM = (doğru karakter / 5) / dakika. Ham hız ise hatalı karakterleri de sayar.'],
      ['İyi bir yazma hızı kaçtır?', 'Ortalama bir kullanıcı 35–45 WPM civarında yazar. 60 WPM üzeri iyi, 80 WPM üzeri çok iyi, 100 WPM üzeri ise profesyonel seviye kabul edilir.']
    ]
  },
  daily: {
    path: PATHS.daily,
    title: 'Günlük Grand Prix — Her Gün Yeni Yazma Yarışı | FingerGP',
    description: 'Her gün herkese aynı metin: Günlük Grand Prix yazma yarışında metni en hızlı bitiren podyuma çıkar. Sıralama her gün 00:00 UTC’de sıfırlanır.',
    heading: 'Günlük Grand Prix',
    about: [
      ['Günlük Grand Prix nedir?', 'Her gün herkes aynı 40 kelimelik metni yazar. Metni hatasız bitirdiğin süreye göre WPM hesaplanır ve günün sıralamasına girer. İstediğin kadar deneyebilirsin, en iyi sonucun sayılır.']
    ]
  },
  reflex: {
    path: PATHS.reflex,
    title: 'Refleks Testi — F1 Start Işıkları ile Tepki Süreni Ölç | FingerGP',
    description: 'F1 start ışıklarıyla refleks testi: beş kırmızı ışık söndüğü an tıkla, tepki süreni milisaniye (ms) olarak ölç ve sıralamada yarış.',
    heading: 'Refleks testi',
    about: [
      ['Refleks testi nasıl yapılır?', 'Beş kırmızı ışık tek tek yanar ve rastgele bir süre sonra hepsi birden söner. Işıklar söndüğü an tıkla; ışığın sönmesiyle tıklaman arasındaki süre tepki süren olarak ölçülür.'],
      ['Ortalama tepki süresi kaç ms?', 'İnsanların görsel uyarana ortalama tepki süresi 200–250 ms civarındadır. 150 ms altı çok hızlı kabul edilir. 100 ms altındaki basışlar tahmin sayılır ve geçersizdir.']
    ]
  },
  clicks: {
    path: PATHS.clicks,
    title: 'CPM Testi — Mouse Tıklama Hızı Testi | FingerGP',
    description: 'Mouse tıklama hızı (CPM / CPS) testi: 5 veya 10 saniyede kaç kez tıklayabildiğini ölç, dakikadaki tıklama sayını gör ve sıralamaya gir.',
    heading: 'CPM testi',
    about: [
      ['CPM nedir?', 'CPM (clicks per minute) dakikadaki tıklama sayısıdır; CPS (clicks per second) ise saniyedeki tıklama sayısı. 5 saniyede 40 tık atarsan CPS 8, CPM 480 olur.'],
      ['Tıklama hızı testi nasıl yapılır?', 'Süreyi seç ve tıklama alanına tıklamaya başla; ilk tıkla saat başlar. Süre bitince toplam tık, CPS ve CPM değerin gösterilir.']
    ]
  },
  race: {
    path: PATHS.race,
    title: 'Canlı Yazma Yarışı — Arkadaşlarınla Yarış | FingerGP',
    description: 'Gerçek zamanlı yazma yarışı: hızlı eşleş ya da özel oda kurup arkadaşlarını davet et. Aynı metni aynı anda yaz, rakiplerinin arabasını canlı izle.',
    heading: 'Canlı yazma yarışı',
    about: [
      ['Canlı yarış nasıl oynanır?', 'Hızlı yarışta bekleyen pilotlarla eşleşirsin; özel odada ise 5 haneli kodu ya da davet linkini arkadaşlarına gönderirsin. Start ışıkları sönünce herkes aynı metni yazar, metni ilk bitiren kazanır.']
    ]
  },
  leaderboard: {
    path: PATHS.leaderboard,
    title: 'Sıralama — Klavye, Refleks ve CPM Rekorları | FingerGP',
    description: 'FingerGP sıralamaları: klavye hız testi, refleks testi, CPM testi ve Günlük Grand Prix için bugünün, haftanın ve tüm zamanların en iyileri.',
    heading: 'Sıralama'
  }
};

// Which page a path belongs to (null = unknown).
export function pageFor(path) {
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/pilot/')) return 'pilot';
  for (const [key, p] of Object.entries(PATHS)) {
    if (key !== 'home' && (path === p || path.startsWith(`${p}/`))) return key;
  }
  return null;
}
