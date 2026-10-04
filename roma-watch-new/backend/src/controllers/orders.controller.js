const crypto = require("crypto");
const store = require("../db/store");
const { loadProducts, saveProducts, finalPrice } = require("./products.controller");
const { SHIPPING_METHODS, ORDER_STATUS, PAYMENT_METHODS } = require("../constants");
const {
  sendOrderConfirmationSms,
  sendNewOrderOwnerAlert,
  sendOrderStatusSms,
  sendOrderCancelledOwnerAlert,
} = require("../services/sms.service");
const { evaluateCoupon, incrementUsage: incrementCouponUsage } = require("./coupons.controller");

function generateTrackingCode() {
  const n = crypto.randomInt(10000, 99999);
  return `ROMA-${n}`;
}

function validateCheckoutInfo(body) {
  const errors = [];
  const required = {
    fullName: "نام و نام خانوادگی",
    phone: "شماره موبایل",
    province: "استان",
    city: "شهر",
    address: "آدرس",
    postalCode: "کد پستی",
  };
  for (const [key, label] of Object.entries(required)) {
    if (!body[key] || !String(body[key]).trim()) {
      errors.push(`${label} الزامی است.`);
    }
  }
  const maxLengths = { fullName: 80, province: 50, city: 50, address: 300 };
  for (const [key, max] of Object.entries(maxLengths)) {
    if (body[key] && String(body[key]).trim().length > max) {
      errors.push(`${required[key]} نمی‌تونه بیشتر از ${max} کاراکتر باشه.`);
    }
  }
  if (body.phone && !/^09\d{9}$/.test(String(body.phone).trim())) {
    errors.push("شماره موبایل معتبر نیست.");
  }
  if (body.postalCode && !/^\d{10}$/.test(String(body.postalCode).trim())) {
    errors.push("کد پستی باید ۱۰ رقم باشد.");
  }
  const method = body.shippingMethod;
  if (!method || !SHIPPING_METHODS[method]) {
    errors.push("روش ارسال نامعتبر است.");
  }
  const paymentMethod = body.paymentMethod || "online";
  if (!PAYMENT_METHODS[paymentMethod]) {
    errors.push("روش پرداخت نامعتبر است.");
  }
  return errors;
}

async function createOrder(req, res, next) {
  try {
    const carts = await store.read("carts", {});
    const cartItems = carts[req.user.id] || [];
    if (!cartItems.length) {
      return res.status(400).json({ ok: false, error: "سبد خرید خالیه." });
    }

    const errors = validateCheckoutInfo(req.body || {});
    if (errors.length) {
      return res.status(400).json({ ok: false, error: errors[0], errors });
    }

    const products = await loadProducts();
    const items = cartItems
      .map((item) => {
        const p = products.find((x) => Number(x.id) === Number(item.id));
        if (!p) return null;
        const qty = Math.max(1, Number(item.qty) || 1);
        return {
          id: p.id,
          brand: p.brand,
          name: p.name,
          qty,
          unitPrice: finalPrice(p),
        };
      })
      .filter(Boolean);

    if (!items.length) {
      return res.status(400).json({ ok: false, error: "محصولات سبد خرید دیگر موجود نیستند." });
    }

    // بررسی موجودی انبار - بدون این، دو مشتری می‌تونن همزمان آخرین موجودی
    // یه ساعت رو بخرن و هر دو سفارش ثبت بشه.
    const outOfStock = [];
    for (const item of items) {
      const p = products.find((x) => Number(x.id) === Number(item.id));
      const available = Number(p.stock);
      // محصولاتی که هنوز فیلد stock براشون تعریف نشده محدودیتی ندارن
      if (!Number.isFinite(available)) continue;
      if (available <= 0) {
        outOfStock.push(`${p.brand} ${p.name} (ناموجود)`);
      } else if (item.qty > available) {
        outOfStock.push(`${p.brand} ${p.name} (فقط ${available} عدد موجوده)`);
      }
    }
    if (outOfStock.length) {
      return res.status(409).json({
        ok: false,
        error: `موجودی این محصولات کافی نیست: ${outOfStock.join("، ")}`,
        outOfStock,
      });
    }

    const itemsTotal = items.reduce((sum, x) => sum + x.unitPrice * x.qty, 0);
    const shippingMethod = req.body.shippingMethod;
    const shippingCost = SHIPPING_METHODS[shippingMethod].cost;
    const paymentMethod = req.body.paymentMethod || "online";
    const codExtraCost = PAYMENT_METHODS[paymentMethod].extraCost;

    // کد تخفیف - دوباره سمت سرور اعتبارسنجی و محاسبه میشه، هیچ‌وقت مبلغ
    // تخفیفی که فرانت‌اند ادعا می‌کنه مستقیم قبول نمیشه.
    let couponCode = null;
    let couponDiscount = 0;
    if (req.body.couponCode) {
      const result = await evaluateCoupon(req.body.couponCode, itemsTotal);
      if (!result.valid) {
        return res.status(400).json({ ok: false, error: result.reason });
      }
      couponCode = result.coupon.code;
      couponDiscount = result.discount;
    }

    const total = itemsTotal + shippingCost + codExtraCost - couponDiscount;

    const orders = await store.read("orders", []);
    const order = {
      id: crypto.randomUUID(),
      code: generateTrackingCode(),
      userId: req.user.id,
      items,
      itemsTotal,
      shippingMethod,
      shippingMethodLabel: SHIPPING_METHODS[shippingMethod].label,
      shippingCost,
      paymentMethod,
      paymentMethodLabel: PAYMENT_METHODS[paymentMethod].label,
      codExtraCost,
      couponCode,
      couponDiscount,
      total,
      // پرداخت نقدی درب منزل نیازی به درگاه آنلاین نداره - سفارش مستقیم
      // تایید‌شده در نظر گرفته میشه، نه در انتظار پرداخت.
      status: paymentMethod === "cod" ? ORDER_STATUS.PROCESSING : ORDER_STATUS.PENDING_PAYMENT,
      customer: {
        fullName: String(req.body.fullName).trim(),
        phone: String(req.body.phone).trim(),
        province: String(req.body.province).trim(),
        city: String(req.body.city).trim(),
        address: String(req.body.address).trim(),
        postalCode: String(req.body.postalCode).trim(),
        notes: req.body.notes ? String(req.body.notes).trim().slice(0, 500) : "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.push(order);
    await store.write("orders", orders);

    // کم کردن موجودی انبار بعد از ثبت موفق سفارش
    let stockChanged = false;
    for (const item of items) {
      const p = products.find((x) => Number(x.id) === Number(item.id));
      if (p && Number.isFinite(Number(p.stock))) {
        p.stock = Math.max(0, Number(p.stock) - item.qty);
        stockChanged = true;
      }
    }
    if (stockChanged) {
      await saveProducts(products);
    }

    if (couponCode) {
      await incrementCouponUsage(couponCode);
    }

    // بعد از ثبت سفارش، سبد خرید خالی میشه
    carts[req.user.id] = [];
    await store.write("carts", carts);

    // ارسال پیامک تاییدیه - اگه Provider پیامک خطا بده، نباید سفارش رو خراب کنه
    sendOrderConfirmationSms(order.customer.phone, order).catch((err) =>
      console.error("ROMA order-confirmation SMS failed:", err.message)
    );
    sendNewOrderOwnerAlert(order).catch((err) =>
      console.error("ROMA owner-alert SMS failed:", err.message)
    );

    res.status(201).json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

async function myOrders(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const mine = orders
      .filter((o) => o.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ ok: true, orders: mine });
  } catch (err) {
    next(err);
  }
}

// جزئیات یک سفارش با بررسی مالکیت - کاربر فقط سفارش خودش رو می‌بینه
async function getOrderById(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
    }
    if (order.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "دسترسی به این سفارش مجاز نیست." });
    }
    res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const orders = await store.read("orders", []);
    const order = orders.find((o) => o.code === code);
    if (!order) {
      return res.status(404).json({ ok: false, error: "سفارشی با این کد پیدا نشد." });
    }
    // برای رهگیری عمومی فقط اطلاعات لازم رو برمی‌گردونیم، نه کل اطلاعات کاربر
    res.json({
      ok: true,
      order: {
        code: order.code,
        status: order.status,
        total: order.total,
        paymentMethod: order.paymentMethod || "online",
        itemsCount: order.items.reduce((n, i) => n + i.qty, 0),
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// لغو سفارش توسط خود مشتری - فقط سفارش‌هایی که هنوز ارسال نشدن
async function cancelOrder(req, res, next) {
  try {
    const orders = await store.read("orders", []);
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
    if (order.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "دسترسی به این سفارش مجاز نیست." });
    }

    const CANCELLABLE = [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING];
    if (!CANCELLABLE.includes(order.status)) {
      return res.status(400).json({
        ok: false,
        error: "این سفارش دیگه قابل لغو نیست. برای پیگیری با پشتیبانی تماس بگیرید.",
      });
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date().toISOString();
    order.cancelledBy = "customer";
    order.updatedAt = new Date().toISOString();
    await store.write("orders", orders);

    // موجودی رزروشده برگرده به انبار
    try {
      const products = await loadProducts();
      let stockChanged = false;
      for (const item of order.items) {
        const p = products.find((x) => Number(x.id) === Number(item.id));
        if (p && Number.isFinite(Number(p.stock))) {
          p.stock = Number(p.stock) + item.qty;
          stockChanged = true;
        }
      }
      if (stockChanged) await saveProducts(products);
    } catch (err) {
      console.error("ROMA restore-stock on cancel failed:", err.message);
    }

    sendOrderStatusSms(order.customer.phone, order).catch((err) =>
      console.error("ROMA cancel SMS failed:", err.message)
    );
    sendOrderCancelledOwnerAlert(order).catch((err) =>
      console.error("ROMA cancel owner-alert failed:", err.message)
    );

    res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, myOrders, getOrderById, trackOrder, cancelOrder };
