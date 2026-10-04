#!/usr/bin/env node
/**
 * بک‌آپ خودکار از کل دیتای فروشگاه.
 *
 * چون دیتا روی فایل‌های JSON ذخیره میشه (نه دیتابیس واقعی)، خراب شدن یا
 * پاک شدن این فایل‌ها یعنی از دست رفتن کامل سفارش‌ها، کاربرها و محصولات -
 * بدون هیچ راه برگشتی. این اسکریپت یه کپی تاریخ‌دار از همه‌شون می‌گیره.
 *
 * اجرای دستی:
 *   node scripts/backup.js
 *
 * اجرای خودکار روزانه (روی VPS) - با crontab -e این خط رو اضافه کن تا هر
 * شب ساعت ۳ بامداد بک‌آپ بگیره:
 *   0 3 * * * cd /var/www/roma-watch-new/backend && /usr/bin/node scripts/backup.js >> logs/backup.log 2>&1
 *
 * برای بازگردانی: فایل‌های داخل پوشه‌ی بک‌آپ موردنظر رو کپی کن روی
 * backend/data/ و بعد pm2 restart roma-backend بزن.
 */
const fs = require("fs/promises");
const path = require("path");

const BACKEND_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(BACKEND_DIR, "data");
const PRODUCTS_FILE = path.join(BACKEND_DIR, "..", "data", "products.json");
const BACKUP_ROOT = path.join(BACKEND_DIR, "backups");

// چند بک‌آپ آخر نگه داشته بشه (بقیه خودکار پاک میشن تا دیسک پر نشه)
const KEEP_LAST = Number(process.env.BACKUP_KEEP_LAST) || 30;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function copyIfExists(src, destDir, name) {
  try {
    const content = await fs.readFile(src, "utf8");
    // قبل از ذخیره، سالم بودن JSON رو چک کن - بک‌آپِ خراب بدتر از نداشتنشه
    JSON.parse(content);
    await fs.writeFile(path.join(destDir, name), content, "utf8");
    return { name, ok: true, bytes: Buffer.byteLength(content) };
  } catch (err) {
    return { name, ok: false, error: err.message };
  }
}

async function pruneOld() {
  try {
    const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const extra = dirs.length - KEEP_LAST;
    for (let i = 0; i < extra; i++) {
      await fs.rm(path.join(BACKUP_ROOT, dirs[i]), { recursive: true, force: true });
      console.log(`  پاک شد (قدیمی): ${dirs[i]}`);
    }
  } catch {
    // پوشه‌ی بک‌آپ هنوز وجود نداره - مشکلی نیست
  }
}

async function run() {
  const stamp = timestamp();
  const destDir = path.join(BACKUP_ROOT, stamp);
  await fs.mkdir(destDir, { recursive: true });

  const results = [];

  // همه‌ی فایل‌های دیتای عملیاتی
  let dataFiles = [];
  try {
    dataFiles = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error("پوشه‌ی data پیدا نشد:", err.message);
  }
  for (const f of dataFiles) {
    results.push(await copyIfExists(path.join(DATA_DIR, f), destDir, f));
  }

  // کاتالوگ محصولات (بیرون از پوشه‌ی data نگهداری میشه)
  results.push(await copyIfExists(PRODUCTS_FILE, destDir, "products.json"));

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`\nبک‌آپ ${stamp} ساخته شد:`);
  ok.forEach((r) => console.log(`  ✓ ${r.name} (${r.bytes} بایت)`));
  failed.forEach((r) => console.log(`  ✗ ${r.name} — ${r.error}`));

  await pruneOld();

  if (!ok.length) {
    console.error("هیچ فایلی بک‌آپ نشد!");
    process.exitCode = 1;
  } else {
    console.log(`\nمسیر: ${destDir}`);
  }
}

run().catch((err) => {
  console.error("بک‌آپ با خطا مواجه شد:", err);
  process.exitCode = 1;
});
