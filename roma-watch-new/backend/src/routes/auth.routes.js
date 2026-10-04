const router = require("express").Router();
const ctrl = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const { otpLimiter } = require("../middleware/rate-limit");

router.post("/send-otp", otpLimiter, ctrl.sendOtp);
router.post("/verify-otp", otpLimiter, ctrl.verifyOtp);
router.get("/me", requireAuth, ctrl.me);
router.post("/logout", requireAuth, ctrl.logout);

module.exports = router;
