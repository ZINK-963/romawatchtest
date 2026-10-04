const store = require("../db/store");
const { loadProducts } = require("./products.controller");

async function getFavorites(req, res, next) {
  try {
    const favs = await store.read("favorites", {});
    const ids = favs[req.user.id] || [];
    const products = await loadProducts();
    const detailed = ids
      .map((id) => products.find((p) => Number(p.id) === Number(id)))
      .filter(Boolean);
    res.json({ ok: true, ids, products: detailed });
  } catch (err) {
    next(err);
  }
}

async function toggleFavorite(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const products = await loadProducts();
    if (!products.some((p) => Number(p.id) === productId)) {
      return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });
    }

    const favs = await store.read("favorites", {});
    const ids = favs[req.user.id] || [];
    const at = ids.indexOf(productId);
    let liked;
    if (at >= 0) {
      ids.splice(at, 1);
      liked = false;
    } else {
      ids.push(productId);
      liked = true;
    }
    favs[req.user.id] = ids;
    await store.write("favorites", favs);

    res.json({ ok: true, liked, ids });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFavorites, toggleFavorite };
