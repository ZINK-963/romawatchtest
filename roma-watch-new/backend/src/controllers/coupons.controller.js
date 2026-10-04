const crypto = require("crypto");
const store = require("../db/store");

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * منطق اصلی اعتبارسنجی کوپن - هم موقع پیش‌نمایش توی چک‌اوت و هم موقع ثبت
 * واقعی سفارش از همینجا استفاده میشه تا دو تا منطق جدا نداشته باشیم که از
 * هم عقب بیفتن.
 */
async function evaluateCoupon(rawCode, itemsTotal) {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, reason: "کد تخفیف رو وارد کن." };

  const coupons = await store.read("coupons", []);
  const coupon = coupons.find((c) => c.code === code);
  if (!coupon) return { valid: false, reason: "کد تخفیف پیدا نشد." };
  if (!coupon.active) return { valid: false, reason: "این کد تخفیف غیرفعال شده." };
  if (coupon.expiresAt && Date.now() > coupon.expiresAt) {
    return { valid: false, reason: "این کد تخفیف منقضی شده." };
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, reason: "ظرفیت استفاده از این کد تخفیف تموم شده." };
  }
  if (coupon.minOrderAmount && itemsTotal < coupon.minOrderAmount) {
    return {
      valid: false,
      reason: `این کد فقط برای خریدهای بالای ${coupon.minOrderAmount.toLocaleString("fa-IR")} تومان معتبره.`,
    };
  }

  let discount = 0;
  if (coupon.type === "percent") {
    discount = Math.round((itemsTotal * coupon.value) / 100);
  } else {
    discount = coupon.value;
  }
  discount = Math.max(0, Math.min(discount, itemsTotal)); // هیچ‌وقت بیشتر از جمع کالاها تخفیف نده

  return { valid: true, discount, coupon };
}

async function validate(req, res, next) {
  try {
    const { code, itemsTotal } = req.body || {};
    const amount = Number(itemsTotal) || 0;
    const result = await evaluateCoupon(code, amount);
    if (!result.valid) return res.status(400).json({ ok: false, error: result.reason });
    res.json({
      ok: true,
      discount: result.discount,
      code: result.coupon.code,
      description: result.coupon.description || "",
    });
  } catch (err) {
    next(err);
  }
}

// اگه سفارش موفق ثبت بشه، شمارنده‌ی استفاده رو یکی زیاد کن (createOrder صدا می‌زنه)
async function incrementUsage(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const coupons = await store.read("coupons", []);
  const coupon = coupons.find((c) => c.code === normalized);
  if (coupon) {
    coupon.usedCount = (coupon.usedCount || 0) + 1;
    await store.write("coupons", coupons);
  }
}

// ---------------- مدیریت ادمین ----------------
function validateCouponInput(body, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!body.code || !String(body.code).trim()) errors.push("کد تخفیف الزامیه.");
    if (!["percent", "fixed"].includes(body.type)) errors.push("نوع تخفیف باید percent یا fixed باشه.");
    if (body.value === undefined || isNaN(Number(body.value)) || Number(body.value) < 0) {
      errors.push("value باید عدد نامنفی باشه.");
    }
  }
  if (body.type === "percent" && Number(body.value) > 100) {
    errors.push("درصد تخفیف نمی‌تونه بیشتر از ۱۰۰ باشه.");
  }
  if (body.minOrderAmount !== undefined && Number(body.minOrderAmount) < 0) {
    errors.push("minOrderAmount باید نامنفی باشه.");
  }
  if (body.usageLimit !== undefined && body.usageLimit !== null && Number(body.usageLimit) < 0) {
    errors.push("usageLimit باید نامنفی باشه.");
  }
  return errors;
}

async function listCoupons(req, res, next) {
  try {
    const coupons = await store.read("coupons", []);
    res.json({ ok: true, coupons });
  } catch (err) {
    next(err);
  }
}

async function createCoupon(req, res, next) {
  try {
    const errors = validateCouponInput(req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const code = normalizeCode(req.body.code);
    const coupons = await store.read("coupons", []);
    if (coupons.some((c) => c.code === code)) {
      return res.status(400).json({ ok: false, error: "این کد قبلاً ثبت شده." });
    }

    const coupon = {
      id: crypto.randomUUID(),
      code,
      type: req.body.type,
      value: Number(req.body.value),
      description: req.body.description || "",
      minOrderAmount: req.body.minOrderAmount ? Number(req.body.minOrderAmount) : 0,
      usageLimit: req.body.usageLimit ? Number(req.body.usageLimit) : null,
      usedCount: 0,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt).getTime() : null,
      active: true,
      createdAt: new Date().toISOString(),
    };
    coupons.push(coupon);
    await store.write("coupons", coupons);
    res.status(201).json({ ok: true, coupon });
  } catch (err) {
    next(err);
  }
}

async function updateCoupon(req, res, next) {
  try {
    const errors = validateCouponInput(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ ok: false, error: errors[0], errors });

    const coupons = await store.read("coupons", []);
    const coupon = coupons.find((c) => c.id === req.params.id);
    if (!coupon) return res.status(404).json({ ok: false, error: "کد تخفیف پیدا نشد." });

    if (req.body.type !== undefined) coupon.type = req.body.type;
    if (req.body.value !== undefined) coupon.value = Number(req.body.value);
    if (req.body.description !== undefined) coupon.description = req.body.description;
    if (req.body.minOrderAmount !== undefined) coupon.minOrderAmount = Number(req.body.minOrderAmount) || 0;
    if (req.body.usageLimit !== undefined) coupon.usageLimit = req.body.usageLimit ? Number(req.body.usageLimit) : null;
    if (req.body.expiresAt !== undefined) {
      coupon.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt).getTime() : null;
    }
    if (req.body.active !== undefined) coupon.active = Boolean(req.body.active);

    await store.write("coupons", coupons);
    res.json({ ok: true, coupon });
  } catch (err) {
    next(err);
  }
}

async function deleteCoupon(req, res, next) {
  try {
    const coupons = await store.read("coupons", []);
    const idx = coupons.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "کد تخفیف پیدا نشد." });
    coupons.splice(idx, 1);
    await store.write("coupons", coupons);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  evaluateCoupon,
  incrementUsage,
  validate,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
