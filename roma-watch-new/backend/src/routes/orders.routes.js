const router = require("express").Router();
const ctrl = require("../controllers/orders.controller");
const { requireAuth } = require("../middleware/auth");
const { SHIPPING_METHODS, PAYMENT_METHODS } = require("../constants");
const { orderLimiter, otpLimiter } = require("../middleware/rate-limit");

router.get("/shipping-methods", (req, res) => {
  const list = Object.entries(SHIPPING_METHODS).map(([key, v]) => ({
    key,
    label: v.label,
    cost: v.cost,
  }));
  res.json({ ok: true, methods: list });
});

router.get("/payment-methods", (req, res) => {
  const list = Object.entries(PAYMENT_METHODS).map(([key, v]) => ({
    key,
    label: v.label,
    extraCost: v.extraCost,
  }));
  res.json({ ok: true, methods: list });
});

// عمومی، بدون نیاز به لاگین - ولی چون کد سفارش قابل حدس‌زدنه، محدودیت سخت‌گیرانه لازمه
router.get("/track/:code", otpLimiter, ctrl.trackOrder);
router.post("/", requireAuth, orderLimiter, ctrl.createOrder);
router.get("/", requireAuth, ctrl.myOrders);
router.get("/:id", requireAuth, ctrl.getOrderById); // مالکیت داخل کنترلر چک میشه
router.post("/:id/cancel", requireAuth, orderLimiter, ctrl.cancelOrder);

module.exports = router;
