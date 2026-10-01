// Shared by the browser and the server: both must generate the same text from the
// same seed so that the Daily Grand Prix is identical for every pilot.

export const WORDS = {
  tr: `ve bir bu da ne için ile çok daha gibi kadar sonra şimdi her ben sen o biz siz onlar
    var yok evet hayır iyi güzel büyük küçük yeni eski uzun kısa hızlı yavaş sıcak soğuk
    gün gece sabah akşam zaman yıl ay hafta saat dakika bugün yarın dün hep bazen asla
    ev yol araba şehir köy deniz dağ orman nehir göl ağaç çiçek taş toprak hava su ateş
    insan çocuk kadın adam anne baba kardeş arkadaş öğretmen doktor pilot usta takım
    gel git bak gör yap et al ver söyle bil düşün iste sev çalış oku yaz koş dur başla
    bitir dön kal otur kalk aç kapa bekle bul ara sor cevap ver getir götür kazan
    kitap kalem masa kapı pencere oda mutfak bahçe okul sınıf ders soru iş para fiyat
    renk kırmızı mavi yeşil sarı siyah beyaz turuncu mor gri ses müzik şarkı resim film
    yarış pist tur hız motor lastik direksiyon vites fren benzin bayrak kupa podyum zafer
    parmak klavye tuş ekran fare tık refleks hedef rekor puan skor sıra lider şampiyon
    önce arka ön yan üst alt iç dış sağ sol orta yakın uzak burada orada nerede neden
    nasıl hangi kim kaç biraz hemen artık bile ancak çünkü fakat ama veya ise eğer
    kolay zor doğru yanlış tam yarım ilk son tek çift bütün hepsi hiç birlikte yalnız
    sevgi umut güç cesaret sabır akıl fikir plan hayal rüya yolculuk macera hikaye`,
  en: `the be to of and a in that have it for not on with he as you do at this but his by
    from they we say her she or an will my one all would there their what so up out if
    about who get which go me when make can like time no just him know take people into
    year your good some could them see other than then now look only come its over think
    also back after use two how our work first well way even new want because any these
    give day most us race track lap speed engine tire wheel gear brake fuel flag trophy
    podium victory finger keyboard key screen mouse click reflex target record score rank
    leader champion fast slow quick start finish line pit stop green light red yellow
    turn corner straight boost drive driver crew team garage road city town river world
    house water fire earth wind sky night morning evening hand eye mind heart dream plan
    small large long short high low early late right left open close always never often
    learn play move find show tell ask try call keep let begin seem help talk run write
    read sit stand lose pay meet include continue set change lead watch follow stop create
    speak spend grow walk win offer remember love consider appear buy wait serve build stay`
};

for (const lang of Object.keys(WORDS)) {
  WORDS[lang] = [...new Set(WORDS[lang].split(/\s+/).filter(Boolean))];
}

export const LANGS = Object.keys(WORDS);

// mulberry32: tiny deterministic PRNG.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateWords(lang = 'tr', count = 200, seed = Math.floor(Math.random() * 2 ** 32)) {
  const list = WORDS[lang] || WORDS.tr;
  const rand = seededRandom(seed);
  const out = [];
  while (out.length < count) {
    const w = list[Math.floor(rand() * list.length)];
    if (w !== out[out.length - 1]) out.push(w);
  }
  return out;
}

// The Daily Grand Prix: same words for everyone on a given UTC day.
export const DAILY_WORD_COUNT = 40;

export function dailyKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailyWords(key = dailyKey(), lang = 'tr') {
  return generateWords(lang, DAILY_WORD_COUNT, hashString(`fmq-daily-${key}-${lang}`));
}
