const router = require("express").Router();
const ctrl = require("../controllers/payment.controller");
const { requireAuth } = require("../middleware/auth");
const { orderLimiter } = require("../middleware/rate-limit");

router.post("/create", requireAuth, orderLimiter, ctrl.createPayment);
router.post("/verify", requireAuth, orderLimiter, ctrl.verify);

// درگاه (Provider واقعی) کاربر رو بدون JWT برمی‌گردونه، پس این عمومیه
router.get("/callback", ctrl.callback);
router.post("/callback", ctrl.callback);

// فقط Sandbox - قبل از وصل کردن درگاه واقعی حذف بشه
if (process.env.NODE_ENV !== "production") {
  router.get("/sandbox/:authority", ctrl.sandboxState);
  router.post("/sandbox/:authority/decide", ctrl.sandboxDecide);
}

module.exports = router;
