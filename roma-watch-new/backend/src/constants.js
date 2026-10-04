// وضعیت‌های ممکن سفارش - تک منبع حقیقت، همه‌ی کنترلرها از همینجا استفاده می‌کنن
const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  PAYMENT_FAILED: "payment_failed",
};

// وضعیت رکورد پرداخت (جدا از وضعیت سفارش) - یه پرداخت می‌تونه initiated باشه
// و بعداً verified یا failed بشه؛ چند بار تلاش پرداخت می‌تونن به یک سفارش وصل باشن.
const PAYMENT_STATUS = {
  INITIATED: "initiated",
  VERIFIED: "verified",
  FAILED: "failed",
};

const ORDER_STATUS_LABELS_FA = {
  [ORDER_STATUS.PENDING_PAYMENT]: "در انتظار پرداخت",
  [ORDER_STATUS.PAID]: "پرداخت‌شده",
  [ORDER_STATUS.PROCESSING]: "در حال پردازش",
  [ORDER_STATUS.SHIPPED]: "ارسال شده",
  [ORDER_STATUS.DELIVERED]: "تحویل داده شده",
  [ORDER_STATUS.CANCELLED]: "لغو شده",
  [ORDER_STATUS.PAYMENT_FAILED]: "پرداخت ناموفق",
};

// هزینه‌ی ارسال - فقط یک روش: تحویل درب منزل. مبلغش از env قابل تنظیمه.
const SHIPPING_METHODS = {
  home_delivery: {
    label: "ارسال درب منزل",
    cost: Number(process.env.SHIPPING_STANDARD_COST) || 250000,
  },
};

// روش پرداخت: آنلاین (درگاه) یا نقدی درب منزل. هزینه‌ی اضافه‌ی COD (اگه صفر
// نباشه) موقع ثبت سفارش به مبلغ نهایی اضافه میشه - رایج در فروشگاه‌های
// ایرانی به‌خاطر هزینه‌ی کارمزد وصول نقدی توسط پیک.
const PAYMENT_METHODS = {
  online: { label: "پرداخت آنلاین (درگاه بانکی)", extraCost: 0 },
  cod: {
    label: "پرداخت در محل (نقدی هنگام تحویل)",
    extraCost: Number(process.env.COD_EXTRA_COST) || 0,
  },
};

module.exports = { ORDER_STATUS, PAYMENT_STATUS, ORDER_STATUS_LABELS_FA, SHIPPING_METHODS, PAYMENT_METHODS };
