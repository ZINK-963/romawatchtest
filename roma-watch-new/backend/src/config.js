const path = require("path");
require("dotenv").config();

const DEV_JWT_SECRET = "roma-watch-dev-secret-change-me";
const jwtSecret = process.env.JWT_SECRET || DEV_JWT_SECRET;

if (process.env.NODE_ENV === "production" && jwtSecret === DEV_JWT_SECRET) {
  throw new Error(
    "JWT_SECRET در حالت production تنظیم نشده! یه مقدار طولانی و تصادفی توی .env قرار بده و دوباره اجرا کن."
  );
}

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret,
  jwtExpiresIn: "30d",
  otpExpiresMs: 2 * 60 * 1000, // 2 دقیقه اعتبار کد
  otpMaxAttempts: 5,
  otpResendCooldownMs: 60 * 1000, // حداقل فاصله بین دو درخواست کد برای یک شماره
  // فایل محصولات از پوشه فرانت‌اند خونده میشه تا یه منبع دیتای واحد داشته باشیم
  productsFile: path.join(__dirname, "..", "..", "data", "products.json"),
  // این دو تا فقط "آینه"ی همون فایل بالان (برای سازگاری با صفحاتی که مستقیم
  // این مسیرها رو فچ می‌کنن) - هر بار که ادمین محصولی رو تغییر بده، این دوتا
  // هم خودکار بازسازی میشن تا هیچ‌جا از داده‌ی کهنه استفاده نکنه.
  productsMirrorFile: path.join(__dirname, "..", "..", "products.json"),
  productsDataJsFile: path.join(__dirname, "..", "..", "products-data.js"),
  productImagesDir: path.join(__dirname, "..", "..", "images", "products"),
  dataDir: path.join(__dirname, "..", "data"),
  // آدرس(های) فرانت‌اند - هم برای ساختن لینک بازگشت از درگاه پرداخت و هم
  // به‌عنوان لیست مجاز CORS استفاده میشه. چند دامنه رو با کاما جدا کن؛
  // دامنه‌ی اول به‌عنوان آدرس اصلی برای ساختن لینک‌ها استفاده میشه.
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5500")
    .split(",")[0]
    .trim()
    .replace(/\/$/, ""),
  frontendUrls: (process.env.FRONTEND_URL || "http://localhost:5500")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  // شماره(های) مدیر فروشگاه - هرکس با یکی از این شماره‌ها وارد بشه (از همون
  // مسیر OTP معمولی)، توکنش نقش admin می‌گیره و به پنل مدیریت دسترسی داره.
  // چند شماره رو با کاما جدا کن.
  adminPhones: (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // شماره‌ی صاحب فروشگاه - وقتی سفارش جدید ثبت میشه، یه پیامک اطلاع‌رسانی
  // به همین شماره فرستاده میشه.
  ownerPhone: process.env.OWNER_PHONE || "",
  sms: {
    apiKey: process.env.SMS_API_KEY || "", // کاوه‌نگار
    username: process.env.SMS_USERNAME || "", // ملی‌پیامک (یا مشابه، مبتنی بر نام‌کاربری/رمز)
    password: process.env.SMS_PASSWORD || "",
    sender: process.env.SMS_SENDER || "",
    otpTemplate: process.env.SMS_OTP_TEMPLATE || "", // اختیاری - نام پترن تاییدشده کاوه‌نگار برای OTP
  },
  // تنظیمات درگاه پرداخت - مقادیر واقعی (مثلاً از زرین‌پال) رو در .env قرار بده
  payment: {
    apiKey: process.env.PAYMENT_API_KEY || "",
    merchantId: process.env.PAYMENT_MERCHANT_ID || "",
  },
};
