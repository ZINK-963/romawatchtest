# راهنمای دیپلوی ROMA WATCH روی VPS

این راهنما فرض می‌کنه یه VPS با اوبونتو (۲۲.۰۴ یا جدیدتر) داری و یه دامنه که DNS‌ش
(رکورد A) به IP همون سرور اشاره می‌کنه.

---

## ۱) نصب پیش‌نیازها روی سرور

```bash
sudo apt update && sudo apt upgrade -y

# Node.js (نسخه ۲۰ LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx
sudo apt install -y nginx

# PM2 (سراسری)
sudo npm install -g pm2

# Certbot (برای HTTPS رایگان Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
```

## ۲) آپلود پروژه

```bash
sudo mkdir -p /var/www/roma-watch-new
sudo chown $USER:$USER /var/www/roma-watch-new
# فایل zip پروژه رو با scp/rsync به همین مسیر منتقل کن، یا اگه گیت داری:
# git clone <repo-url> /var/www/roma-watch-new
cd /var/www/roma-watch-new
```

## ۳) راه‌اندازی بک‌اند

```bash
cd /var/www/roma-watch-new/backend
npm install --omit=dev

cp .env.example .env
nano .env    # همه‌ی مقادیر رو طبق بخش «متغیرهای محیطی» پایین همین فایل پر کن
```

**مهم:** `JWT_SECRET` رو حتماً با یه مقدار تصادفی و طولانی پر کن (نه مقدار پیش‌فرض)
- بدون این کار، سرور اصلاً بالا نمیاد (این چک از Phase 6 عمداً گذاشته شده).
یه مقدار امن اینطوری می‌تونی بسازی:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`FRONTEND_URL` رو دقیقاً برابر آدرس نهایی دامنه‌ت بذار (با https، بدون اسلش آخر):

```
FRONTEND_URL=https://YOUR_DOMAIN.ir
NODE_ENV=production
```

حالا بک‌اند رو با PM2 بالا بیار:

```bash
mkdir -p logs
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # دستوری که چاپ می‌کنه رو کپی و اجرا کن (برای بالا اومدن خودکار بعد از ریبوت)
```

چک کن داره درست کار می‌کنه:

```bash
curl http://127.0.0.1:4000/
# باید یه جواب JSON با ok:true برگردونه
pm2 logs roma-backend --lines 30
```

## ۴) تنظیم Nginx (فرانت‌اند + پراکسی API)

فایل `deploy/nginx.conf` توی پروژه از قبل آماده‌ست. فقط کافیه:

```bash
sudo cp /var/www/roma-watch-new/deploy/nginx.conf /etc/nginx/sites-available/romawatch
sudo nano /etc/nginx/sites-available/romawatch
# همه‌جای YOUR_DOMAIN.ir رو با دامنه‌ی واقعی جایگزین کن
# همه‌جای /var/www/roma-watch-new رو اگه مسیر پروژه‌ت فرق می‌کنه، اصلاح کن

sudo ln -s /etc/nginx/sites-available/romawatch /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # سایت پیش‌فرض nginx رو غیرفعال کن
sudo nginx -t     # باید بگه syntax ok
sudo systemctl reload nginx
```

این مرحله سایت رو روی HTTP (پورت ۸۰) بالا میاره. تا اینجا با `http://YOUR_DOMAIN.ir`
باید فروشگاه رو ببینی.

## ۵) گرفتن HTTPS (رایگان، با Let's Encrypt)

```bash
sudo certbot --nginx -d YOUR_DOMAIN.ir -d www.YOUR_DOMAIN.ir
```

Certbot خودش گواهی رو می‌گیره و فایل nginx رو برای HTTPS تنظیم می‌کنه. اگه ترجیح
می‌دی دستی انجام بدی: توی `deploy/nginx.conf` بلاک HTTPS (که کامنته) رو از کامنت
دربیار، بلاک HTTP رو به یه `return 301 https://$host$request_uri;` ساده تبدیل کن،
و خودت گواهی رو با `certbot certonly --nginx` بگیر.

بعد از این مرحله، `FRONTEND_URL` توی `backend/.env` باید حتماً `https://` باشه
(چون درگاه پرداخت و CORS دقیقاً به همین مقدار حساسن). اگه عوضش کردی:

```bash
pm2 restart roma-backend --update-env
```

## ۶) تست نهایی

- [ ] `https://YOUR_DOMAIN.ir` باز میشه و قفل HTTPS داره
- [ ] صفحه محصولات و عکس‌ها لود میشن
- [ ] ورود با OTP کار می‌کنه (کد رو فعلاً توی `pm2 logs roma-backend` می‌بینی تا وقتی SMS واقعی وصل نشده)
- [ ] افزودن به سبد خرید و چک‌اوت کار می‌کنه
- [ ] بعد از ثبت سفارش، به درگاه پرداخت (Sandbox یا زرین‌پال واقعی) هدایت میشه

---

## متغیرهای محیطی (`backend/.env`)

| متغیر | توضیح |
|---|---|
| `PORT` | پورت داخلی بک‌اند (پیش‌فرض 4000، نیازی به تغییر نیست چون Nginx پراکسی می‌کنه) |
| `NODE_ENV` | باید `production` باشه |
| `JWT_SECRET` | مقدار تصادفی طولانی - **اجباری در production** |
| `FRONTEND_URL` | آدرس واقعی سایت با https، بدون اسلش آخر |
| `SHIPPING_STANDARD_COST` / `SHIPPING_EXPRESS_COST` | هزینه ارسال به تومان |
| `SMS_API_KEY` / `SMS_OTP_TEMPLATE` | کاوه‌نگار |
| `SMS_USERNAME` / `SMS_PASSWORD` / `SMS_SENDER` | ملی‌پیامک (یا مشابه) - اگه کاوه‌نگار نیست |
| `PAYMENT_MERCHANT_ID` | زرین‌پال - با پر شدنش خودکار از Sandbox به واقعی سوییچ می‌کنه |

---

## آپدیت بعدی پروژه (وقتی تغییری دادیم)

```bash
cd /var/www/roma-watch-new
# فایل‌های جدید رو جایگزین کن (بدون دست زدن به backend/data و backend/.env)
cd backend
npm install --omit=dev   # فقط اگه package.json تغییر کرده باشه
pm2 restart roma-backend
```

## دستورهای مفید PM2

```bash
pm2 status                    # وضعیت پروسه‌ها
pm2 logs roma-backend         # لاگ زنده
pm2 restart roma-backend      # ری‌استارت
pm2 monit                     # مانیتور مصرف CPU/RAM
```
