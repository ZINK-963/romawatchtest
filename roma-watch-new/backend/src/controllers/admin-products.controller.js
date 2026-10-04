const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { loadProducts, saveProducts, productImagesDir } = require("./products.controller");

const VALID_GENDERS = ["مردانه", "زنانه", "ست"];
const VALID_OPTIONS = ["ضد آب", "تقویم", "کرنوگراف", "شب نما", "تایمر"];
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB برای هر عکس
const ALLOWED_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function validateProduct(body, { partial = false } = {}) {
  const errors = [];
  const required = ["brand", "name", "price", "gender"];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === "" || body[key] === null) {
        errors.push(`فیلد ${key} الزامیه.`);
      }
    }
  }
  if (body.gender !== undefined && !VALID_GENDERS.includes(body.gender)) {
    errors.push(`gender باید یکی از ${VALID_GENDERS.join(", ")} باشه.`);
  }
  if (body.price !== undefined && (isNaN(Number(body.price)) || Number(body.price) < 0)) {
    errors.push("price باید عدد نامنفی باشه.");
  }
  if (body.discount !== undefined) {
    if (isNaN(Number(body.discount)) || Number(body.discount) < 0) {
      errors.push("discount باید عدد نامنفی باشه.");
    } else if (body.price !== undefined && Number(body.discount) > Number(body.price)) {
      errors.push("discount نمی‌تونه از price بیشتر باشه.");
    }
  }
  if (body.stock !== undefined && (isNaN(Number(body.stock)) || Number(body.stock) < 0 || !Number.isInteger(Number(body.stock)))) {
    errors.push("stock باید عدد صحیح نامنفی باشه.");
  }
  for (const key of ["option1", "option2", "option3"]) {
    if (body[key] && !VALID_OPTIONS.includes(body[key])) {
      errors.push(`${key} باید یکی از ${VALID_OPTIONS.join(", ")} یا خالی باشه.`);
    }
  }
  return errors;
}

const EDITABLE_FIELDS = [
  "brand", "name", "price", "discount", "gender", "displayColor", "bodyColor",
  "material", "motorType", "style", "option1", "option2", "option3", "country", "stock",
];

async function listProducts(req, res, next) {
  try {
    const products = await loadProducts();
    res.json({ ok: true, products });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const errors = validateProduct(req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const products = await loadProducts();
    const nextId = products.length ? Math.max(...products.map((p) => Number(p.id))) + 1 : 1;

    const product = { id: nextId, image: "", images: [] };
    for (const field of EDITABLE_FIELDS) {
      product[field] = req.body[field] !== undefined ? req.body[field] : "";
    }
    product.price = Number(product.price) || 0;
    product.discount = Number(product.discount) || 0;
    product.stock = product.stock === "" ? 0 : Number(product.stock) || 0;

    products.push(product);
    await saveProducts(products);
    res.status(201).json({ ok: true, product });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const errors = validateProduct(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const products = await loadProducts();
    const product = products.find((p) => Number(p.id) === Number(req.params.id));
    if (!product) return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    }
    if (req.body.price !== undefined) product.price = Number(req.body.price) || 0;
    if (req.body.discount !== undefined) product.discount = Number(req.body.discount) || 0;
    if (req.body.stock !== undefined) product.stock = Number(req.body.stock) || 0;

    await saveProducts(products);
    res.json({ ok: true, product });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const products = await loadProducts();
    const idx = products.findIndex((p) => Number(p.id) === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });

    const [removed] = products.splice(idx, 1);
    // فایل‌های عکس این محصول هم پاک بشن که فضای مرده روی دیسک نمونه
    for (const img of removed.images || []) {
      fs.unlink(path.join(productImagesDir, path.basename(img))).catch(() => {});
    }
    await saveProducts(products);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function uploadImage(req, res, next) {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ ok: false, error: "dataUrl الزامیه." });
    }
    const match = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
    if (!match || !ALLOWED_MIME[match[1].toLowerCase()]) {
      return res.status(400).json({ ok: false, error: "فرمت عکس باید jpeg، png یا webp باشه." });
    }
    const ext = ALLOWED_MIME[match[1].toLowerCase()];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ ok: false, error: "حجم عکس نباید بیشتر از ۳ مگابایت باشه." });
    }

    const products = await loadProducts();
    const product = products.find((p) => Number(p.id) === Number(req.params.id));
    if (!product) return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });

    product.images = product.images || [];
    if (product.images.length >= MAX_IMAGES) {
      return res.status(400).json({ ok: false, error: `هر محصول حداکثر ${MAX_IMAGES} عکس می‌تونه داشته باشه. اول یکی رو حذف کن.` });
    }

    await fs.mkdir(productImagesDir, { recursive: true });
    const slot = product.images.length + 1;
    const filename = `p${product.id}-${slot}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(productImagesDir, filename), buffer);

    const url = `./images/products/${filename}`;
    product.images.push(url);
    if (!product.image) product.image = url;

    await saveProducts(products);
    res.status(201).json({ ok: true, product });
  } catch (err) {
    next(err);
  }
}

async function deleteImage(req, res, next) {
  try {
    const index = Number(req.params.index);
    const products = await loadProducts();
    const product = products.find((p) => Number(p.id) === Number(req.params.id));
    if (!product) return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });
    if (!product.images || !product.images[index]) {
      return res.status(404).json({ ok: false, error: "عکسی با این شماره پیدا نشد." });
    }

    const [removedUrl] = product.images.splice(index, 1);
    fs.unlink(path.join(productImagesDir, path.basename(removedUrl))).catch(() => {});
    product.image = product.images[0] || "";

    await saveProducts(products);
    res.json({ ok: true, product });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct, uploadImage, deleteImage };
