document.addEventListener("DOMContentLoaded", async () => {
  const getCart = () => { try { return JSON.parse(localStorage.getItem("roma_cart")) || []; } catch { return []; } };
  const setCart = v => localStorage.setItem("roma_cart", JSON.stringify(v));
  const money = n => Number(n || 0).toLocaleString("fa-IR");
  const final = p => Math.max(0, Math.round(Number(p.price || 0) - Number(p.discount || 0)));
  let products = [];
  try {
    const urls = ["./products.json?v=3", "./data/products.json?v=3"];
    let res = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) { res = r; break; }
      } catch (_) {}
    }
    if (!res) throw new Error("products.json not found");
    products = await res.json();
  } catch (e) {
    console.error("ROMA cart products:", e);
  }

  const wrap = document.querySelector(".cart-managment");
  if (!wrap) return;
  const title = wrap.querySelector(".products-information-title");
  const dynamic = document.createElement("div");
  dynamic.className = "roma-dynamic-cart";
  title?.insertAdjacentElement("afterend", dynamic);

  const hasApi = typeof RomaAPI !== "undefined";
  const isLoggedIn = () => hasApi && RomaAPI.isLoggedIn();

  // برای کاربر لاگین‌شده، سبد خرید سرور منبع اصلی حقیقته
  if (isLoggedIn()) {
    try {
      const res = await RomaAPI.cart.get();
      setCart(res.items.map(x => ({ id: x.id, qty: x.qty })));
    } catch (e) {
      console.error("ROMA cart sync from server failed:", e);
    }
  }

  function updateSummary(cart) {
    const valid = cart.map(item => ({ item, p: products.find(x => Number(x.id) === Number(item.id)) })).filter(x => x.p);
    const count = valid.reduce((n, x) => n + Math.max(1, Number(x.item.qty) || 1), 0);
    const total = valid.reduce((n, x) => n + final(x.p) * Math.max(1, Number(x.item.qty) || 1), 0);
    const shipping = 0;
    const finalTotal = total + shipping;

    document.querySelector("#number-of-products")?.replaceChildren(document.createTextNode(`(${money(count)} کالا)`));
    document.querySelector("#total-price-value")?.replaceChildren(document.createTextNode(`${money(total)} تومان`));
    document.querySelector("#sending-price-value")?.replaceChildren(document.createTextNode(shipping ? `${money(shipping)} تومان` : "رایگان"));
    const finalEl = document.querySelector("#final-price-value");
    if (finalEl) finalEl.innerHTML = `${money(finalTotal)} <span>تومان</span>`;
    const status = document.querySelector("#cartStatus");
    if (status) status.innerHTML = `<i class="bi bi-info-circle"></i> ${money(count)} محصول در سبد خرید دارید`;

    const empty = document.querySelector("#romaCartEmptyState");
    if (empty) {
      empty.hidden = count !== 0;
      empty.innerHTML = count ? "" : `<i class="bi bi-bag-x"></i><h3>سبد خرید شما خالی است</h3><a href="./products.htm">مشاهده فروشگاه</a>`;
    }
  }

  function render() {
    const cart = getCart();
    dynamic.innerHTML = "";
    cart.forEach(item => {
      const p = products.find(x => Number(x.id) === Number(item.id));
      if (!p) return;
      const qty = Math.max(1, Number(item.qty) || 1);
      const options = [p.option1, p.option2, p.option3].filter(Boolean);
      const card = document.createElement("div");
      card.className = "cart-product-card roma-added-product";
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="cart-product-name"><div class="cart-product-brand">${p.brand || ""}</div><div class="cart-product-title">${p.name || ""}</div><div class="cart-product-model">${p.gender || ""}</div><div class="inventory"><i class="bi bi-patch-check-fill"></i> گارانتی دارد</div></div>
        <div class="cart-product-image"><img src="${(p.images && p.images[0]) || p.image || "./images/placeholder-watch.svg"}" alt="${p.name || ""}"></div>
        <div class="cart-product-price"><p>${money(final(p))}</p></div>
        <div class="number-of-product"><i class="bi bi-plus roma-plus"></i><input type="text" value="${qty}" readonly><i class="bi bi-dash roma-minus"></i></div>
        <div class="options-of-product">${options.map(o => `<h5>${o}</h5>`).join("")}<h5>ضمانت اصالت</h5></div>
        <div class="cart-product-total-price"><p>${money(final(p) * qty)}</p></div>
        <div class="remove-product-in-cart roma-remove"><i class="bi bi-trash3"></i></div>`;
      dynamic.appendChild(card);
    });
    updateSummary(cart);
    window.dispatchEvent(new CustomEvent("roma-cart-updated"));
  }

  dynamic.addEventListener("click", e => {
    const card = e.target.closest(".roma-added-product");
    if (!card) return;
    const id = Number(card.dataset.id);
    const cart = getCart();
    const index = cart.findIndex(x => Number(x.id) === id);
    if (index < 0) return;
    let removed = false;
    if (e.target.closest(".roma-plus")) cart[index].qty = Math.max(1, Number(cart[index].qty) || 1) + 1;
    if (e.target.closest(".roma-minus")) cart[index].qty = Math.max(1, (Number(cart[index].qty) || 1) - 1);
    if (e.target.closest(".roma-remove")) {
      cart.splice(index, 1);
      removed = true;
    }
    setCart(cart);
    render();

    if (isLoggedIn()) {
      const sync = removed
        ? RomaAPI.cart.remove(id)
        : RomaAPI.cart.update(id, cart[index]?.qty ?? 1);
      sync.catch(err => console.error("ROMA cart sync failed:", err));
    }
  });

  // Remove any stale cart entries whose products no longer exist in products.json.
  // Only do this once product data has actually loaded — otherwise every item
  // looks "invalid" and a temporary fetch failure would wipe the whole cart.
  if (products.length) {
    const clean = getCart().filter(item => products.some(p => Number(p.id) === Number(item.id)));
    if (JSON.stringify(clean) !== JSON.stringify(getCart())) setCart(clean);
    render();
  } else {
    const cart = getCart();
    if (cart.length) {
      const status = document.querySelector("#cartStatus");
      if (status) status.innerHTML = `<i class="bi bi-exclamation-triangle"></i> اطلاعات محصولات لود نشد — سبد شما دست‌نخورده مونده، صفحه رو رفرش کن.`;
    } else {
      render();
    }
  }
});
