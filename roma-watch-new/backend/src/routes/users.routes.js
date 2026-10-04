const router = require("express").Router();
const ctrl = require("../controllers/users.controller");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth); // همه‌ی این روت‌ها فقط برای کاربر لاگین‌شده و فقط روی خودش

router.get("/me", ctrl.getProfile);
router.patch("/me", ctrl.updateProfile);

router.get("/me/addresses", ctrl.listAddresses);
router.post("/me/addresses", ctrl.addAddress);
router.patch("/me/addresses/:addressId", ctrl.updateAddress);
router.delete("/me/addresses/:addressId", ctrl.deleteAddress);

module.exports = router;
