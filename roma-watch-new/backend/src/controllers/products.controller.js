const fs = require("fs/promises");
const path = require("path");
const {
  productsFile,
  productsMirrorFile,
  productsDataJsFile,
  productImagesDir,
} = require("../config");

let cache = null;
let cacheAt = 0;
const CACHE_MS = 5000; // چون فایل استاتیکه، کش کوتاه برای کم‌کردن خوندن دیسک کافیه

async function loadProducts() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  const raw = await fs.readFile(productsFile, "utf8");
  cache = JSON.parse(raw);
  cacheAt = now;
  return cache;
}

// بعد از هر تغییر (افزودن/ویرایش/حذف محصول توسط ادمین)، هم فایل اصلی و هم
// دو تا "آینه"ی فایل‌های استاتیکی که فرانت‌اند مستقیم فچ می‌کنه رو بازسازی
// می‌کنیم - تا هیچ صفحه‌ای دیتای کهنه نشون نده. این‌ها همیشه باید سه‌تا
// دقیقاً یکی باشن، پس نباید مستقیم دستکاری بشن، فقط از همینجا.
async function saveProducts(products) {
  const json = JSON.stringify(products, null, 2);
  await fs.writeFile(productsFile, json, "utf8");
  await fs.writeFile(productsMirrorFile, json, "utf8").catch(() => {});
  try {
    const jsContent = await fs.readFile(productsDataJsFile, "utf8");
    const prefix = jsContent.split("=")[0];
    await fs.writeFile(productsDataJsFile, `${prefix}= ${json};\n`, "utf8");
  } catch {
    // فایل fallback جاوااسکریپتی اختیاریه؛ نبودش نباید کل عملیات رو خراب کنه
  }
  cache = products;
  cacheAt = Date.now();
}

function finalPrice(p) {
  const price = Number(p.price) || 0;
  const d = Number(p.discount) || 0; // مبلغ ثابت تخفیف به تومان (نه درصد)
  return Math.max(0, Math.round(price - d));
}

async function list(req, res, next) {
  try {
    const products = await loadProducts();
    const { brand, gender, country, minPrice, maxPrice, discount, options, sort } = req.query;

    let result = products;

    if (brand) result = result.filter((p) => p.brand === brand);
    if (gender) result = result.filter((p) => p.gender === gender);
    if (country) result = result.filter((p) => p.country === country);
    if (discount === "true") result = result.filter((p) => Number(p.discount) > 0);
    if (minPrice) result = result.filter((p) => Number(p.price) >= Number(minPrice));
    if (maxPrice) result = result.filter((p) => Number(p.price) <= Number(maxPrice));
    if (options) {
      const wanted = String(options).split(",").filter(Boolean);
      result = result.filter((p) =>
        wanted.every((o) => [p.option1, p.option2, p.option3].includes(o)),
      );
    }
    if (sort === "price-asc") result = [...result].sort((a, b) => finalPrice(a) - finalPrice(b));
    if (sort === "price-desc") result = [...result].sort((a, b) => finalPrice(b) - finalPrice(a));

    res.json({ ok: true, count: result.length, products: result });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const products = await loadProducts();
    const product = products.find((p) => Number(p.id) === Number(req.params.id));
    if (!product) return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });
    res.json({ ok: true, product });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getOne,
  loadProducts,
  saveProducts,
  finalPrice,
  productImagesDir,
};
