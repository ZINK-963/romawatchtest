const { sms: smsConfig, ownerPhone } = require("../config");

/**
 * لایه‌ی Adapter سرویس پیامک.
 *
 * بقیه‌ی پروژه فقط با توابع سطح بالا (sendOtpSms / sendOrderConfirmationSms /
 * sendOrderStatusSms) کار می‌کنه، نه با جزئیات Provider - پس عوض کردن
 * Provider نباید هیچ کنترلر/روتی رو تغییر بده.
 *
 * دو Provider رایج ایرانی از قبل پیاده‌سازی شدن و به‌محض پر شدن .env خودکار
 * فعال میشن (نیازی به تغییر کد نیست):
 *   - کاوه‌نگار: با پر کردن SMS_API_KEY (و اختیاری SMS_OTP_TEMPLATE برای
 *     ارسال OTP از طریق پترن تاییدشده، سریع‌تر و مطمئن‌تر از پیامک ساده)
 *   - ملی‌پیامک (یا مشابه، مبتنی بر نام‌کاربری/رمز): با پر کردن SMS_USERNAME
 *     و SMS_PASSWORD (وقتی SMS_API_KEY خالی باشه)
 * تا وقتی هیچ‌کدوم پر نشده، در حالت شبیه‌سازی (فقط لاگ کنسول) کار می‌کنه.
 *
 * نکته: مستندات دقیق پاسخ ملی‌پیامک بسته به نوع پنل (اقتصادی/رست جدید) کمی
 * فرق داره؛ قبل از رفتن به Production یه پیامک تستی بفرست و اگه فرمت پاسخ
 * زیر با پنل واقعی‌ت یکی نبود، فقط تابع sendViaMelipayamak رو تنظیم کن.
 */

async function sendViaKavenegar(phone, message) {
  const url = `https://api.kavenegar.com/v1/${smsConfig.apiKey}/sms/send.json?receptor=${encodeURIComponent(phone)}${smsConfig.sender ? `&sender=${encodeURIComponent(smsConfig.sender)}` : ""}&message=${encodeURIComponent(message)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data?.return?.status !== 200) {
    throw new Error(`خطای کاوه‌نگار: ${data?.return?.message || res.status}`);
  }
  return { ok: true, provider: "kavenegar" };
}

// ارسال کد تایید از طریق پترن تاییدشده کاوه‌نگار (verify/lookup) - توصیه‌شده برای OTP
async function sendOtpViaKavenegarLookup(phone, code) {
  const url = `https://api.kavenegar.com/v1/${smsConfig.apiKey}/verify/lookup.json?receptor=${encodeURIComponent(phone)}&token=${encodeURIComponent(code)}&template=${encodeURIComponent(smsConfig.otpTemplate)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data?.return?.status !== 200) {
    throw new Error(`خطای کاوه‌نگار (Lookup): ${data?.return?.message || res.status}`);
  }
  return { ok: true, provider: "kavenegar-lookup" };
}

async function sendViaMelipayamak(phone, message) {
  const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: smsConfig.username,
      password: smsConfig.password,
      to: phone,
      from: smsConfig.sender,
      text: message,
      isFlash: false,
    }),
  });
  const data = await res.json().catch(() => null);
  // ملی‌پیامک بسته به نوع پنل معمولاً RetStatus=1 یا Value مثبت برای موفقیت برمی‌گردونه
  if (!res.ok || (data && data.RetStatus !== undefined && data.RetStatus !== 1)) {
    throw new Error(`خطای ملی‌پیامک: ${JSON.stringify(data) || res.status}`);
  }
  return { ok: true, provider: "melipayamak" };
}

/**
 * تابع پایه - فقط همینجا Provider انتخاب میشه. اگه هیچ Providerی تنظیم نشده
 * باشه (حالت توسعه)، فقط لاگ می‌کنه و خطا نمی‌ده.
 */
async function sendSms(phone, message) {
  try {
    if (smsConfig.apiKey) {
      return await sendViaKavenegar(phone, message);
    }
    if (smsConfig.username && smsConfig.password) {
      return await sendViaMelipayamak(phone, message);
    }
    console.log(`[SMS شبیه‌سازی‌شده - هیچ Provider ای در .env تنظیم نشده] به ${phone}:\n${message}`);
    return { ok: true, simulated: true };
  } catch (err) {
    // خطای Provider نباید کل درخواست کاربر (مثلاً ثبت سفارش) رو خراب کنه؛
    // فراخوان‌ها (auth/orders/payment) خودشون این خطا رو catch و لاگ می‌کنن.
    throw err;
  }
}

async function sendOtpSms(phone, code) {
  // اگه پترن OTP کاوه‌نگار تنظیم شده باشه، از همون مسیر مخصوص (سریع‌تر و
  // قابل‌اعتمادتر، حتی برای شماره‌های بلک‌لیست تبلیغاتی) استفاده می‌کنیم.
  if (smsConfig.apiKey && smsConfig.otpTemplate) {
    return sendOtpViaKavenegarLookup(phone, code);
  }
  return sendSms(phone, `کد ورود روما واچ: ${code}\nاین کد رو در اختیار کسی قرار ندید.`);
}

async function sendOrderConfirmationSms(phone, order) {
  const amount = Number(order.total || 0).toLocaleString("fa-IR");
  return sendSms(
    phone,
    `روما واچ: سفارش شما با کد ${order.code} به مبلغ ${amount} تومان ثبت شد. پیگیری: romawatch.ir/tracking`
  );
}

// اطلاع‌رسانی به صاحب فروشگاه به‌محض ثبت هر سفارش جدید
async function sendNewOrderOwnerAlert(order) {
  if (!ownerPhone) return { ok: false, skipped: true };
  const amount = Number(order.total || 0).toLocaleString("fa-IR");
  const itemsCount = order.items.reduce((n, i) => n + i.qty, 0);
  return sendSms(
    ownerPhone,
    `سفارش جدید! کد: ${order.code}\nمبلغ: ${amount} تومان (${itemsCount} کالا)\nمشتری: ${order.customer.fullName} - ${order.customer.phone}`
  );
}

async function sendOrderStatusSms(phone, order) {
  const STATUS_FA = {
    paid: "پرداخت شد",
    processing: "در حال پردازش",
    shipped: "ارسال شد",
    delivered: "تحویل داده شد",
    cancelled: "لغو شد",
    payment_failed: "پرداخت ناموفق بود",
  };
  const label = STATUS_FA[order.status] || order.status;
  return sendSms(phone, `روما واچ: وضعیت سفارش ${order.code} تغییر کرد: ${label}`);
}

// وقتی مشتری خودش سفارش رو لغو می‌کنه، صاحب فروشگاه باید فوراً خبردار بشه
// (مخصوصاً اگه داشته آماده‌ی ارسالش می‌کرده)
async function sendOrderCancelledOwnerAlert(order) {
  if (!ownerPhone) return { ok: false, skipped: true };
  const amount = Number(order.total || 0).toLocaleString("fa-IR");
  return sendSms(
    ownerPhone,
    `لغو سفارش توسط مشتری!\nکد: ${order.code}\nمبلغ: ${amount} تومان\nمشتری: ${order.customer.fullName} - ${order.customer.phone}`
  );
}

module.exports = {
  sendSms,
  sendOtpSms,
  sendOrderConfirmationSms,
  sendOrderStatusSms,
  sendNewOrderOwnerAlert,
  sendOrderCancelledOwnerAlert,
};
