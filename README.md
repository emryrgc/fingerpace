# FingerGP

**[www.fingergp.com](https://www.fingergp.com)**

**Parmakların pistte.** Klavye hız testi, refleks testi ve mouse CPM testi — hepsi motorsporları temalı ve rekabetçi bir sıralama sistemiyle.

## Testler

| Test | Ne ölçer | Detay |
| --- | --- | --- |
| **Klavye GP** | WPM, doğruluk, ham hız | 15 / 30 / 60 sn, Türkçe & İngilizce. Kendi rekorunun "hayalet arabası"na karşı yarışırsın. |
| **Günlük Grand Prix** | WPM | Her gün (00:00 UTC) herkese aynı 40 kelimelik metin. Tek günlük sıralama. |
| **Start Işıkları** | Tepki süresi (ms) | F1 tarzı 5 ışık, rastgele bekleme. Her start ayrı bir oyun; en iyi tepki süresi sıralamaya girer (100 ms altı erken kalkış sayılır). |
| **Pit Stop** | CPM (dakikada tık) | 5 / 10 sn mouse tıklama testi, canlı devir saati. |
| **Canlı Yarış** | Sıralama, WPM | 2-5 pilot aynı anda aynı metni yazar; herkes rakiplerin arabasını canlı görür. |

## Rekabet sistemi

- **Canlı yarış odaları (WebSocket):**
  - *Hızlı yarış* — bekleyen pilotlarla eşleşir; 2 pilot olunca 8 sn sonra, 5 pilot olunca hemen başlar.
  - *Özel oda* — 5 haneli kod / davet linki; oda sahibi başlatır, bitince rövanş.
  - Start ışıkları herkes için senkron yanar. Zamanı ve WPM'i sunucu ölçer; istemci yalnızca ne kadar yazdığını bildirir ve bu da saniyede 25 karakter tavanıyla sınırlanır.
  - En az 2 pilotlu yarışlar profile işlenir (yarış, galibiyet, podyum, en iyi yarış hızı).
- **Pilot lisansı:** Şifresiz kayıt — benzersiz bir pilot adı seçilir, sunucu gizli bir anahtar verir ve bu anahtar tarayıcıda saklanır.
- **Sıralamalar:** Her test için *Bugün / Bu hafta / Tüm zamanlar*. Her pilotun en iyi skoru sayılır; podyum (P1-P3) + starting grid.
- **Pilot profili:** Kişisel rekorlar, sıralamadaki yer ve son turlar.
- **Temel hile koruması:** İnsanüstü skorlar (ör. >300 WPM, <100 ms tepki, >25 tık/sn) ve tutarsız sonuçlar sunucuda reddedilir; IP başına hız limiti vardır.

## Çalıştırma

Node.js **22.5+** gerekir (yerleşik `node:sqlite` kullanılır, ek veritabanı kurulumu yok).

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # dosya değişince otomatik yeniden başlatır
npm test           # API testleri
```

Ortam değişkenleri: `PORT` (varsayılan `3000`), `DB_FILE` (varsayılan `data/fingermcqueen.db`).

## Yapı

```
server/
  index.js     giriş noktası
  app.js       Express uygulaması + REST API
  catalog.js   sıralama listesi ve skor doğrulama kuralları
  race.js      canlı yarış odaları (WebSocket, /ws)
  db.js        SQLite şeması
public/
  index.html   tek sayfa uygulama
  css/style.css
  js/          app (router), engine (ortak yazma motoru), typing, race, reflex,
               clicks, leaderboard, api, ui, words
test/          node:test ile API testleri
```

### API

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| `POST` | `/api/players` | `{ name }` → `{ name, token }` |
| `GET` | `/api/me` | Bearer token ile pilot doğrulama |
| `GET` | `/api/players/:name` | Pilot profili |
| `POST` | `/api/scores` | `{ test, score, details }` (Bearer token gerekli) |
| `GET` | `/api/leaderboard/:test?period=day\|week\|all` | Sıralama |
| `GET` | `/api/daily` | Günün anahtarı ve sıfırlanma zamanı |
| `GET` | `/api/catalog` | Tüm sıralama tanımları |

### Canlı yarış protokolü (`/ws`)

İstemci → sunucu: `hello {token}`, `quick`, `create`, `join {code}`, `start`, `progress {chars}`, `finish {accuracy}`, `leave`
Sunucu → istemci: `welcome`, `room {room}` (odanın tam durumu), `error {message, fatal?}`, `left`, `closed`

## Yayına alma

Uygulama **sürekli çalışan bir Node sunucusu** (WebSocket bağlantıları için) ve **kalıcı bir disk** (SQLite dosyası için) ister. Bu yüzden Vercel/Netlify gibi "serverless" platformlar uygun değildir; Railway, Render, Fly.io veya bir VPS uygundur.

```bash
docker build -t fingergp .
docker run -p 3000:3000 -v fingergp-data:/data fingergp
```

Veritabanı `/data` altında tutulur; platformda bu yola kalıcı bir disk/volume bağlanmalıdır.

### Railway

Depoda `Dockerfile` ve `railway.json` hazır; Railway ikisini de otomatik algılar.

1. railway.com → GitHub ile giriş → **New Project → Deploy from GitHub repo** → bu depoyu seç.
2. Servisin **Variables** sekmesine `PORT=3000` ekle (`TRUST_PROXY=1` ve `DB_FILE` Dockerfile'da zaten tanımlı).
3. Servise bir **Volume** ekle, bağlama yolu (mount path): `/data`. Bu olmazsa her yeniden yayında skorlar silinir.
4. **Settings → Networking → Generate Domain** (port sorulursa `3000`).
5. Deploy loglarında `FingerGP pistte` satırını gör, verilen adresi aç.

> **Tek kopya (replica) çalıştır.** Yarış odaları sunucu belleğinde, veritabanı da tek bir SQLite dosyasında tutulur; birden fazla kopya ölçeklemek odaları böler.

Ortam değişkenleri: `PORT`, `DB_FILE`, `TRUST_PROXY` (proxy arkasında `1`; gerçek ziyaretçi IP'si hız limitinde kullanılır), `CANONICAL_HOST` (ör. `www.fingergp.com`; çıplak/www diğer yazımı buraya 301 ile yönlenir). Sağlık kontrolü: `GET /api/health`.

#### Alan adı (GoDaddy)

GoDaddy kök alan adına (`@`) CNAME/ALIAS desteklemediği için site `www.fingergp.com` üzerinden yayınlanır:
Railway'e `www.fingergp.com` eklenir → GoDaddy'de `www` CNAME kaydı Railway'in verdiği hedefe çevrilir → `fingergp.com` GoDaddy *Yönlendirme* ile `https://www.fingergp.com`'a kalıcı (301) yönlendirilir.
