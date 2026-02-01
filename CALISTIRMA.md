# Çalıştırma Rehberi

Sistemin (kuyruk, otomatik log, emir onayı / gönderimi) çalışması için **pipeline** ve **dashboard** aynı ortamda, **yazılabilir dosya sistemi** ile çalışmalıdır.

## 1. Local’de çalıştırma (önerilen)

```bash
# Bağımlılıklar
npm install

# .env dosyasını doldur (POLYMARKET_*, PRIVATE_KEY, GEMINI_API_KEY vb.)
# config/risk_params.yaml ve config/execution.yaml mevcut olmalı

# Dashboard + pipeline birlikte (tek komut)
npm run dashboard
```

Bu komut:
- Next.js’i `http://localhost:3000` üzerinde açar
- Pipeline’ı sürekli çalıştırır (fırsat tespiti, kuyruğa ekleme)

Tarayıcıda:
- **Config**: Tetikleyici (Otomatik/Manuel), ortam (Paper/Live), risk params
- **Manuel kuyruk**: Bekleyen fırsatları onayla/reddet; Live ise emir gerçekten gönderilir
- **Otomatik log**: Pipeline ve otomatik tetikleme kayıtları

## 2. Sadece pipeline (arka planda)

```bash
npm run pipeline:loop
```

Dashboard’u ayrı bir terminalde veya başka bir sunucuda çalıştırıyorsan, **aynı proje dizinini** kullanmalısın (aynı `data/`, `config/`, `logs/`).

## 3. Production benzeri (sunucuda sürekli)

Yazılabilir disk gerektiğinden Vercel yeterli değil. Bunun yerine:

- **VPS / sunucu** (DigitalOcean, Hetzner, AWS EC2 vb.): Projeyi at, `npm run dashboard` veya `npm run dashboard:build && npm run dashboard:start` + ayrı süreçte `npm run pipeline:loop` çalıştır (systemd / pm2 ile).
- **Railway, Render** gibi servisler: Uygulamayı “Web + Background Worker” olarak ayarla; web = Next.js, worker = `npm run pipeline:loop`. Aynı proje ve **persistent volume** kullanılırsa kuyruk ve loglar kalıcı olur.

## 4. Bulut hosting (Vercel alternatifi)

Pipeline + dashboard’u **yazılabilir disk** destekleyen bir bulut serviste çalıştırabilirsin; ek paket gerekmez, mevcut dosya tabanlı yapı aynen çalışır.

| Servis | Özellik | Not |
|--------|---------|-----|
| **Railway** | Web + Worker, persistent volume | Repo’dan deploy, “Volume” ekle, pipeline’ı worker olarak çalıştır. |
| **Render** | Web Service + Background Worker, persistent disk | Web = Next.js, Worker = `npm run pipeline:loop`. |
| **Fly.io** | VM + volume | `fly volumes create`, app + pipeline aynı makinede. |
| **DigitalOcean App Platform** | App + Worker | Benzer şekilde web + arka plan worker. |

Hepsi ücretsiz/deneme katmanı sunar; proje dizinini repo’dan alıp build/start + pipeline:loop komutlarını tanımlaman yeterli.

## 5. Vercel’de kalsan: bulut depolama (paket gerekir)

Vercel’de sadece paneli tutup, kuyruk/log/config’i **bulutta** tutmak istersen harici bir depolama kullanıp kodu ona göre değiştirmen gerekir:

- **Vercel KV** veya **Upstash Redis** (`@vercel/kv` / `@upstash/redis`): Kuyruk ve audit log’u Redis’e yaz; pipeline’ı Vercel Cron veya başka bir worker’da çalıştırıp aynı Redis’e yaz/oku.
- **Supabase** (PostgreSQL): Kuyruk ve log tabloları aç; `manual-review-queue`, `audit-log` dosya yerine DB’den okunur/yazılır.

Bu seçenek kod değişikliği (queue, audit-log, config okuma/yazma modülleri) gerektirir; istersen bu yönde adım adım yapılacakları çıkarabilirim.

## 6. Vercel’in rolü

Vercel’e deploy ettiğinde:
- Sadece **panel arayüzü** çalışır (sayfalar, config görüntüleme).
- Pipeline orada çalışmaz, kuyruk/log dosyaları yazılamaz; bu yüzden **işlem (emir) yapılmaz**, kuyruk ve otomatik log boş görünür.

Özet: **Ek paket istemiyorsan** Railway / Render / Fly.io gibi bir bulutla pipeline + dashboard’u birlikte çalıştır. **Vercel’de kalıp her şeyi bulutta tutmak istersen** Redis (Vercel KV / Upstash) veya Supabase gibi harici depolama + kod değişikliği gerekir.
