# 🏁 FingerMcQueen

**Parmakların pistte.** Klavye hız testi, refleks testi ve mouse CPM testi — hepsi motorsporları temalı ve rekabetçi bir sıralama sistemiyle.

## Testler

| Test | Ne ölçer | Detay |
| --- | --- | --- |
| **Klavye GP** | WPM, doğruluk, ham hız | 15 / 30 / 60 sn, Türkçe & İngilizce. Kendi rekorunun "hayalet arabası"na karşı yarışırsın. |
| **Günlük Grand Prix** | WPM | Her gün (00:00 UTC) herkese aynı 40 kelimelik metin. Tek günlük sıralama. |
| **Start Işıkları** | Tepki süresi (ms) | F1 tarzı 5 ışık, rastgele bekleme, erken kalkış cezası. 5 startın ortalaması. |
| **Pit Stop** | CPM (dakikada tık) | 5 / 10 sn mouse tıklama testi, canlı devir saati. |

## Rekabet sistemi

- **Pilot lisansı:** Şifresiz kayıt — benzersiz bir pilot adı seçilir, sunucu gizli bir anahtar verir ve bu anahtar tarayıcıda saklanır.
- **Sıralamalar:** Her test için *Bugün / Bu hafta / Tüm zamanlar*. Her pilotun en iyi skoru sayılır; podyum (P1-P3) + starting grid.
- **Pilot profili:** Kişisel rekorlar, sıralamadaki yer ve son turlar.
- **Temel hile koruması:** İnsanüstü skorlar (ör. >300 WPM, <80 ms ortalama tepki, >25 tık/sn) ve tutarsız sonuçlar sunucuda reddedilir; IP başına hız limiti vardır.

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
  db.js        SQLite şeması
public/
  index.html   tek sayfa uygulama
  css/style.css
  js/          app (router), typing, reflex, clicks, leaderboard, api, ui, words
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
