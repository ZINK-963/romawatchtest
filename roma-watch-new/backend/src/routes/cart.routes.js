const router = require("express").Router();
const ctrl = require("../controllers/cart.controller");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

router.get("/", ctrl.getCart);
router.post("/", ctrl.addToCart);
router.patch("/:productId", ctrl.updateCartItem);
router.delete("/:productId", ctrl.removeFromCart);
router.delete("/", ctrl.clearCart);

module.exports = router;
