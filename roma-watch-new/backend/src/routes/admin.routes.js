const router = require("express").Router();
const ctrl = require("../controllers/admin.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.use(requireAuth, requireAdmin);

router.get("/stats", ctrl.stats);
router.get("/orders", ctrl.listOrders);
router.get("/orders/:id", ctrl.getOrder);
router.patch("/orders/:id/status", ctrl.updateOrderStatus);

module.exports = router;
