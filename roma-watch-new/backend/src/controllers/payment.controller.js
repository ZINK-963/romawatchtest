const store = require("../db/store");
const paymentService = require("../services/payment.service");
const { sendOrderStatusSms } = require("../services/sms.service");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants");
const { frontendUrl } = require("../config");

async function findOrder(orderId) {
  const orders = await store.read("orders", []);
  return { orders, order: orders.find((o) => o.id === orderId) };
}

// Checkout -> Create Order (قبلاً انجام شده) -> این تابع: Create Payment
async function createPayment(req, res, next) {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: "شناسه سفارش الزامیه." });

    const { order } = await findOrder(orderId);
    if (!order) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
    if (order.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "دسترسی به این سفارش مجاز نیست." });
    }
    if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_FAILED].includes(order.status)) {
      return res.status(400).json({ ok: false, error: "این سفارش قابل پرداخت نیست." });
    }

    const callbackUrl = `${req.protocol}://${req.get("host")}/api/payment/callback`;
    const { authority, redirectUrl } = await paymentService.createPayment({
      amount: order.total,
      orderCode: order.code,
      callbackUrl,
    });

    const payments = await store.read("payments", []);
    payments.push({
      id: authority,
      orderId: order.id,
      orderCode: order.code,
      userId: req.user.id,
      amount: order.total,
      status: PAYMENT_STATUS.INITIATED,
      createdAt: new Date().toISOString(),
    });
    await store.write("payments", payments);

    res.json({ ok: true, redirectUrl, authority });
  } catch (err) {
    next(err);
  }
}

// هسته‌ی مشترک تایید پرداخت - هم از callback و هم از verify دستی صدا زده میشه.
// همیشه صرف‌نظر از اینکه از کجا صدا زده شده، مبلغ و نتیجه رو از Provider/Sandbox
// (نه از ورودی کاربر) می‌خونه.
async function settlePayment(authority) {
  const payments = await store.read("payments", []);
  const payment = payments.find((p) => p.id === authority);
  if (!payment) return { ok: false, error: "پرداخت پیدا نشد." };

  // اگه قبلاً نهایی شده (idempotent) - دوباره پردازش نکن، فقط نتیجه رو برگردون
  if (payment.status !== PAYMENT_STATUS.INITIATED) {
    const { order } = await findOrder(payment.orderId);
    return { ok: true, alreadyProcessed: true, order, payment };
  }

  const { orders, order } = await findOrder(payment.orderId);
  if (!order) return { ok: false, error: "سفارش مربوط به این پرداخت پیدا نشد." };

  const result = await paymentService.verifyPayment({ authority, amount: payment.amount });

  if (result.pending) {
    // هنوز نتیجه‌ای از درگاه نیومده - چیزی نهایی نمیشه، همینطوری pending می‌مونه
    return { ok: true, pending: true, order, payment };
  }

  payment.status = result.verified ? PAYMENT_STATUS.VERIFIED : PAYMENT_STATUS.FAILED;
  payment.verifiedAt = new Date().toISOString();
  if (result.refId) payment.refId = result.refId;
  if (!result.verified) payment.failReason = result.reason;
  await store.write("payments", payments);

  order.status = result.verified ? ORDER_STATUS.PAID : ORDER_STATUS.PAYMENT_FAILED;
  order.updatedAt = new Date().toISOString();
  await store.write("orders", orders);

  sendOrderStatusSms(order.customer.phone, order).catch((err) =>
    console.error("ROMA order-status SMS failed:", err.message)
  );

  return { ok: true, order, payment };
}

// Gateway Callback - درگاه (یا در حالت Sandbox، صفحه‌ی شبیه‌سازی) اینجا کاربر رو برمی‌گردونه
async function callback(req, res, next) {
  try {
    const authority =
      req.query.Authority || req.query.authority || req.body?.Authority || req.body?.authority;
    if (!authority) return res.redirect(`${frontendUrl}/payment-result.html`);

    const result = await settlePayment(authority);
    const orderCode = result.order?.code;
    res.redirect(`${frontendUrl}/payment-result.html?code=${encodeURIComponent(orderCode || "")}`);
  } catch (err) {
    next(err);
  }
}

// Verify دستی - برای وقتی کاربر مستقیم به callback برنمی‌گرده (مثلاً تب رو بست)
// و فرانت می‌خواد وضعیت رو دوباره چک کنه. این هم مثل callback از Provider واقعی
// می‌پرسه، به هیچ چیزی که کاربر ادعا کنه اعتماد نمی‌کنه.
async function verify(req, res, next) {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: "شناسه سفارش الزامیه." });

    const { order } = await findOrder(orderId);
    if (!order) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
    if (order.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "دسترسی به این سفارش مجاز نیست." });
    }

    const payments = await store.read("payments", []);
    const latest = payments
      .filter((p) => p.orderId === order.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!latest) return res.status(404).json({ ok: false, error: "پرداختی برای این سفارش ثبت نشده." });

    const result = await settlePayment(latest.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true, order: result.order });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// اندپوینت‌های Sandbox - فقط برای تست بدون درگاه واقعی. وقتی یک درگاه واقعی
// (مثل زرین‌پال) وصل شد، این دو تابع و روت‌هاشون باید حذف بشن؛ بانک واقعی
// دیگه از خودِ ما نمی‌پرسه که نتیجه چی بوده.
// ---------------------------------------------------------------------
async function sandboxState(req, res, next) {
  try {
    const sandbox = await store.read(paymentService.SANDBOX_FILE, {});
    const record = sandbox[req.params.authority];
    if (!record) return res.status(404).json({ ok: false, error: "یافت نشد." });
    res.json({ ok: true, amount: record.amount, orderCode: record.orderCode, outcome: record.outcome });
  } catch (err) {
    next(err);
  }
}

async function sandboxDecide(req, res, next) {
  try {
    const { outcome } = req.body || {};
    if (!["success", "fail"].includes(outcome)) {
      return res.status(400).json({ ok: false, error: "outcome نامعتبر." });
    }
    const sandbox = await store.read(paymentService.SANDBOX_FILE, {});
    const record = sandbox[req.params.authority];
    if (!record) return res.status(404).json({ ok: false, error: "یافت نشد." });
    if (record.outcome !== null) {
      return res.status(400).json({ ok: false, error: "قبلاً برای این پرداخت تصمیم‌گیری شده." });
    }
    record.outcome = outcome;
    await store.write(paymentService.SANDBOX_FILE, sandbox);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPayment, callback, verify, sandboxState, sandboxDecide };
