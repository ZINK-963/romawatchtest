const store = require("../db/store");
const { loadProducts, finalPrice } = require("./products.controller");

const MAX_QTY = 20;

async function withDetails(items) {
  const products = await loadProducts();
  return items
    .map((item) => {
      const p = products.find((x) => Number(x.id) === Number(item.id));
      if (!p) return null;
      return {
        id: p.id,
        qty: Math.max(1, Number(item.qty) || 1),
        product: p,
        unitPrice: finalPrice(p),
      };
    })
    .filter(Boolean);
}

async function getCart(req, res, next) {
  try {
    const carts = await store.read("carts", {});
    const items = carts[req.user.id] || [];
    const detailed = await withDetails(items);
    const total = detailed.reduce((sum, x) => sum + x.unitPrice * x.qty, 0);
    res.json({ ok: true, items: detailed, total });
  } catch (err) {
    next(err);
  }
}

async function addToCart(req, res, next) {
  try {
    const productId = Number(req.body?.productId);
    const qty = Math.min(MAX_QTY, Math.max(1, Number(req.body?.qty) || 1));
    if (!productId) return res.status(400).json({ ok: false, error: "productId لازمه." });

    const products = await loadProducts();
    if (!products.some((p) => Number(p.id) === productId)) {
      return res.status(404).json({ ok: false, error: "محصول پیدا نشد." });
    }

    const carts = await store.read("carts", {});
    const items = carts[req.user.id] || [];
    const existing = items.find((x) => Number(x.id) === productId);
    if (existing) existing.qty = Math.min(MAX_QTY, (Number(existing.qty) || 1) + qty);
    else items.push({ id: productId, qty });
    carts[req.user.id] = items;
    await store.write("carts", carts);

    res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

async function updateCartItem(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const qty = Number(req.body?.qty);
    if (!qty || qty < 1) return res.status(400).json({ ok: false, error: "qty باید حداقل ۱ باشه." });
    if (qty > MAX_QTY) return res.status(400).json({ ok: false, error: `qty نمی‌تونه بیشتر از ${MAX_QTY} باشه.` });

    const carts = await store.read("carts", {});
    const items = carts[req.user.id] || [];
    const existing = items.find((x) => Number(x.id) === productId);
    if (!existing) return res.status(404).json({ ok: false, error: "این محصول توی سبد نیست." });
    existing.qty = qty;
    carts[req.user.id] = items;
    await store.write("carts", carts);

    res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

async function removeFromCart(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const carts = await store.read("carts", {});
    const items = (carts[req.user.id] || []).filter((x) => Number(x.id) !== productId);
    carts[req.user.id] = items;
    await store.write("carts", carts);
    res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

async function clearCart(req, res, next) {
  try {
    const carts = await store.read("carts", {});
    carts[req.user.id] = [];
    await store.write("carts", carts);
    res.json({ ok: true, items: [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
