const crypto = require("crypto");
const store = require("../db/store");
const { payment: paymentConfig, frontendUrl } = require("../config");

const SANDBOX_FILE = "payment_sandbox";
const isConfigured = Boolean(paymentConfig.merchantId);
const isProd = process.env.NODE_ENV === "production";
// مبلغ سفارش‌ها در سیستم به تومانه ولی زرین‌پال به ریال می‌گیره
const toRial = (toman) => Number(toman) * 10;

/**
 * لایه‌ی Adapter درگاه پرداخت.
 *
 * وقتی PAYMENT_MERCHANT_ID در .env پر بشه، این فایل خودکار به زرین‌پال واقعی
 * وصل میشه - نیازی به تغییر payment.controller.js یا هیچ فایل دیگه‌ای نیست.
 * تا وقتی خالیه، در حالت Sandbox (شبیه‌سازی‌شده، بدون تراکنش واقعی) کار می‌کنه
 * تا کل جریان (Checkout → Payment → Callback → Verify) قابل تست باشه.
 *
 * نکته‌ی امنیتی مهم: verifyPayment هیچ‌وقت نباید بر اساس چیزی که از Query یا
 * Body درخواستِ کاربر/فرانت‌اند میاد "موفق" رو تایید کنه - همیشه با خودِ
 * Provider (سرور به سرور) چک میشه. توی Sandbox هم به‌جای Provider واقعی، از
 * یه فایل state سمت سرور (payment_sandbox.json) به‌عنوان "بانکِ شبیه‌سازی‌شده"
 * استفاده می‌کنیم که فقط endpointهای Sandbox (باید قبل از Production حذف
 * بشن) می‌نویسنش، نه خودِ callback/verify.
 *
 * اگه بعداً به‌جای زرین‌پال از یه درگاه دیگه استفاده کردی، فقط باید دو تابع
 * createPaymentReal و verifyPaymentReal رو با API همون درگاه جایگزین کنی.
 */

async function createPaymentReal({ amount, orderCode, callbackUrl }) {
  const res = await fetch("https://payment.zarinpal.com/pg/v4/payment/request.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: paymentConfig.merchantId,
      amount: toRial(amount),
      callback_url: callbackUrl,
      description: `سفارش ${orderCode} - روما واچ`,
    }),
  });
  const data = await res.json();
  if (data?.data?.code !== 100) {
    throw new Error(data?.errors?.message || "خطا در اتصال به درگاه پرداخت زرین‌پال.");
  }
  const authority = data.data.authority;
  return { authority, redirectUrl: `https://payment.zarinpal.com/pg/StartPay/${authority}` };
}

async function verifyPaymentReal({ authority, amount }) {
  const res = await fetch("https://payment.zarinpal.com/pg/v4/payment/verify.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant_id: paymentConfig.merchantId, amount: toRial(amount), authority }),
  });
  const data = await res.json();
  // 100 = تایید شد، 101 = قبلاً تایید شده بود (idempotent) - هر دو یعنی پرداخت معتبره
  const verified = data?.data?.code === 100 || data?.data?.code === 101;
  return { verified, pending: false, refId: data?.data?.ref_id };
}

async function createPaymentSandbox({ amount, orderCode }) {
  const authority = `SANDBOX-${crypto.randomUUID()}`;
  const sandbox = await store.read(SANDBOX_FILE, {});
  sandbox[authority] = { amount, orderCode, outcome: null, createdAt: Date.now() };
  await store.write(SANDBOX_FILE, sandbox);
  const redirectUrl = `${frontendUrl}/payment-sandbox.html?authority=${encodeURIComponent(authority)}`;
  return { authority, redirectUrl };
}

async function verifyPaymentSandbox({ authority, amount }) {
  const sandbox = await store.read(SANDBOX_FILE, {});
  const record = sandbox[authority];
  if (!record) return { verified: false, pending: false, reason: "پرداخت پیدا نشد." };
  if (record.outcome === null) {
    // کاربر هنوز توی درگاه تصمیمی نگرفته - این با "ناموفق" فرق داره، نباید سفارش نهایی بشه
    return { verified: false, pending: true, reason: "هنوز نتیجه‌ای از درگاه دریافت نشده." };
  }
  if (record.amount !== amount) return { verified: false, pending: false, reason: "مبلغ با سفارش مطابقت نداره." };
  if (record.outcome !== "success") return { verified: false, pending: false, reason: "پرداخت توسط کاربر لغو یا ناموفق بود." };
  return { verified: true, pending: false, refId: `SANDBOX-REF-${Date.now()}` };
}

async function createPayment({ amount, orderCode, callbackUrl }) {
  if (!isConfigured && isProd) {
    throw new Error("PAYMENT_MERCHANT_ID در .env تنظیم نشده.");
  }
  if (isConfigured) return createPaymentReal({ amount, orderCode, callbackUrl });
  return createPaymentSandbox({ amount, orderCode });
}

async function verifyPayment({ authority, amount }) {
  if (isConfigured) {
    return verifyPaymentReal({ authority, amount });
  }
  if (isProd) return { verified: false, pending: false, reason: "درگاه تنظیم نشده." };
  return verifyPaymentSandbox({ authority, amount });
}

module.exports = { createPayment, verifyPayment, SANDBOX_FILE, isConfigured };
