const rateLimit = require("express-rate-limit");

// چون در .env جدید هستیم و req.ip بعد از trust proxy درست تنظیم میشه،
// همه‌ی این limiterها بر اساس IP واقعی کاربر (نه IP خودِ nginx) کار می‌کنن.

// محدودیت عمومی برای کل API - جلوگیری از سیل درخواست (فقط یه سد اول، نه دقیق)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "تعداد درخواست‌های شما زیاده. کمی صبر کن." },
});

// OTP/ورود حساس‌ترین بخش برای Brute-force و هزینه‌ی پیامکه - محدودیت سخت‌گیرانه‌تر
// (این جدای از cooldown ۶۰ ثانیه‌ای per-phone توی auth.controller.js عمل می‌کنه؛
// اون از spam روی یه شماره جلوگیری می‌کنه، این از یه IP که شماره عوض می‌کنه)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "تعداد تلاش‌های شما برای این عملیات زیاده. کمی صبر کن." },
});

// ثبت سفارش / ساخت پرداخت - جلوگیری از سفارش‌سازی انبوه یا سوءاستفاده از درگاه
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "تعداد درخواست‌های شما برای سفارش/پرداخت زیاده. کمی صبر کن." },
});

module.exports = { generalLimiter, otpLimiter, orderLimiter };
