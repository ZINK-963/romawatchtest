const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { frontendUrls } = require("./config");
const { generalLimiter } = require("./middleware/rate-limit");

const productsRoutes = require("./routes/products.routes");
const authRoutes = require("./routes/auth.routes");
const cartRoutes = require("./routes/cart.routes");
const favoritesRoutes = require("./routes/favorites.routes");
const ordersRoutes = require("./routes/orders.routes");
const usersRoutes = require("./routes/users.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminRoutes = require("./routes/admin.routes");
const adminProductsRoutes = require("./routes/admin-products.routes");
const couponsRoutes = require("./routes/coupons.routes");
const adminCouponsRoutes = require("./routes/admin-coupons.routes");

const app = express();

// پشت nginx/pm2 اجرا میشه، پس باید به express بگیم به هدر X-Forwarded-For
// اعتماد کنه، وگرنه req.ip همیشه IP خودِ nginx میشه (rate-limit را بی‌اثر می‌کنه)
app.set("trust proxy", 1);

app.use(helmet()); // هدرهای امنیتی HTTP استاندارد (X-Frame-Options, HSTS, ...)

// درخواست‌های بدون Origin (مثل خودِ callback درگاه پرداخت، curl، اپ موبایل)
// همیشه مجازن. توی حالت production فقط دامنه‌های FRONTEND_URL مجازن؛ توی
// development (که فرانت‌اند معمولاً با یه static server دلخواه با پورت
// متغیر، یا حتی مستقیم با دوبار کلیک روی فایل HTML - که Origin رو رشته‌ی
// "null" می‌فرسته نه بدون-Origin - باز میشه) سخت‌گیری روی Origin باعث میشه
// همه‌چی (لاگین، سبد خرید، ثبت سفارش) بی‌سروصدا از کار بیفته؛ برای همین
// توی dev هر origin لوکال یا حالت file:// رو قبول می‌کنیم.
const allowedOrigins = frontendUrls;
const isProd = process.env.NODE_ENV === "production";
function isAllowedDevOrigin(origin) {
  if (origin === "null") return true; // file:// (باز کردن مستقیم فایل HTML)
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd && isAllowedDevOrigin(origin)) return callback(null, true);
      callback(new Error("این دامنه اجازه‌ی دسترسی به API رو نداره."));
    },
    credentials: true,
  })
);

app.use(generalLimiter);

// این روت قبل از express.json سراسری میاد چون آپلود عکس محصول به محدودیت
// بزرگ‌تری از حجم بدنه نیاز داره؛ خودش جداگانه بدنه‌ش رو پارس می‌کنه.
app.use("/api/admin/products", adminProductsRoutes);

app.use(express.json({ limit: "100kb" })); // جلوگیری از payload خیلی بزرگ (DoS ساده)

app.get("/", (req, res) => {
  res.json({ ok: true, message: "roma watch backend is running" });
});

app.use("/api/products", productsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/admin/coupons", adminCouponsRoutes);

// روت پیدا نشد
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "مسیر مورد نظر پیدا نشد." });
});

// هندلر خطای کلی - همیشه آخرین میدلور باید همین باشه.
// جزئیات خطا (stack, message داخلی) هیچ‌وقت به کلاینت درز نمی‌کنه، فقط لاگ سرور.
app.use((err, req, res, next) => {
  console.error(err);
  const isCorsError = err.message === "این دامنه اجازه‌ی دسترسی به API رو نداره.";
  res.status(isCorsError ? 403 : 500).json({
    ok: false,
    error: isCorsError ? err.message : "خطای داخلی سرور.",
  });
});

module.exports = app;
