const router = require("express").Router();
const ctrl = require("../controllers/products.controller");

router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);

module.exports = router;
