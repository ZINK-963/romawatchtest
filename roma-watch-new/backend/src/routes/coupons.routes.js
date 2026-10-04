const router = require("express").Router();
const ctrl = require("../controllers/coupons.controller");
const { requireAuth } = require("../middleware/auth");
const { otpLimiter } = require("../middleware/rate-limit");

// نیاز به لاگین داره (چون بخشی از فرآیند چک‌اوته) و rate-limit سخت‌گیرانه
// داره چون کد تخفیف قابل حدس‌زدنه (brute-force روی کدهای کوتاه).
router.post("/validate", requireAuth, otpLimiter, ctrl.validate);

module.exports = router;
