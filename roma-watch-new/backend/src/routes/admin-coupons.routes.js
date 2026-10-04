const router = require("express").Router();
const ctrl = require("../controllers/coupons.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.use(requireAuth, requireAdmin);

router.get("/", ctrl.listCoupons);
router.post("/", ctrl.createCoupon);
router.patch("/:id", ctrl.updateCoupon);
router.delete("/:id", ctrl.deleteCoupon);

module.exports = router;
