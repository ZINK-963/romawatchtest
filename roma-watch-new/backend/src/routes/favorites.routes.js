const router = require("express").Router();
const ctrl = require("../controllers/favorites.controller");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

router.get("/", ctrl.getFavorites);
router.post("/:productId", ctrl.toggleFavorite);

module.exports = router;
