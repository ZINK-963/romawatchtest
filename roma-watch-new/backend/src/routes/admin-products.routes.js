const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/admin-products.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// این روتر قبل از express.json({limit:"100kb"}) سراسری توی app.js مانت میشه
// و پارس بدنه‌ی خودش رو مستقل انجام میده - چون آپلود عکس (base64) خیلی
// بزرگ‌تر از ۱۰۰ کیلوبایته و با محدودیت سراسری رد می‌شد.
const smallBody = express.json({ limit: "150kb" });
const imageBody = express.json({ limit: "5mb" });

router.use(requireAuth, requireAdmin);

router.get("/", ctrl.listProducts);
router.post("/", smallBody, ctrl.createProduct);
router.patch("/:id", smallBody, ctrl.updateProduct);
router.delete("/:id", ctrl.deleteProduct);
router.post("/:id/images", imageBody, ctrl.uploadImage);
router.delete("/:id/images/:index", ctrl.deleteImage);

module.exports = router;
