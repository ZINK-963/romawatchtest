/* ROMA WATCH - shared product/filter/favorites/cart interactions */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[c],
    );
  const getJSON = (key, fallback = []) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };
  const setJSON = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));
  const getFavs = () => getJSON("roma_favorites", []);
  const setFavs = (v) => setJSON("roma_favorites", v);
  const getCart = () => getJSON("roma_cart", []);
  const setCart = (v) => setJSON("roma_cart", v);

  /* هماهنگی با بک‌اند فقط برای کاربر لاگین‌شده؛ برای مهمان همه‌چیز فقط
     localStorage باقی می‌مونه، دقیقاً مثل قبل. */
  const hasApi = typeof RomaAPI !== "undefined";
  const isLoggedIn = () => hasApi && RomaAPI.isLoggedIn();

  async function syncFromServer() {
    if (!isLoggedIn()) return;
    try {
      const [cartRes, favRes] = await Promise.all([
        RomaAPI.cart.get(),
        RomaAPI.favorites.get(),
      ]);
      setCart(cartRes.items.map((x) => ({ id: x.id, qty: x.qty })));
      setFavs(favRes.ids);
    } catch (e) {
      console.error("ROMA sync from server failed:", e);
    }
  }

  /* Header
     Mobile/tablet/desktop header size is controlled only by CSS.
     No scroll listener changes the header anymore. */

  function updateBadges() {
    const favCount = getFavs().length;
    const cartCount =
      getCart().reduce((n, p) => n + (p.qty || 1), 0) ||
      (location.pathname.endsWith("cart.html") ? 1 : 0);
    $$(".favorites-badge").forEach((x) => (x.textContent = favCount));
    $$(".cart-wrapper .badge").forEach((x) => (x.textContent = cartCount));
  }
  await syncFromServer();
  updateBadges();

  /* نمایش وضعیت ورود — هم آیکن هدر (دسکتاپ) و هم دکمه داخل منو
     (موبایل/تبلت، جایی که آیکن هدر پنهانه) دقیقاً یک رفتار دارند. */
  function renderLoginState() {
    const links = $$(".login-wrapper .login-link, #navLoginLink");
    const nameEl = $("#accountName");
    const navNameEl = $("#navAccountName");
    if (!links.length) return;
    if (isLoggedIn()) {
      let savedName = "";
      try { savedName = localStorage.getItem("roma_user_name") || ""; } catch (e) {}
      const displayName = savedName || "کاربر روما";
      links.forEach((link) => {
        link.href = "./account.html";
        link.title = "حساب کاربری";
        link.innerHTML = link.id === "navLoginLink"
          ? '<i class="bi bi-person-check-fill"></i><span>حساب کاربری</span>'
          : '<i class="bi bi-person-check-fill"></i>';
      });
      if (nameEl) {
        nameEl.textContent = displayName;
        nameEl.hidden = false;
      }
      if (navNameEl) {
        navNameEl.innerHTML = `خوش آمدید، <span class="name">${esc(displayName)}</span>`;
      }
    } else {
      if (nameEl) {
        nameEl.hidden = true;
        nameEl.textContent = "";
      }
      if (navNameEl) navNameEl.innerHTML = "";
      links.forEach((link) => {
        link.href = "./login.html";
        link.title = "ورود / عضویت";
        if (link.id === "navLoginLink") {
          link.innerHTML = '<i class="bi bi-person-fill"></i><span>ورود / عضویت</span>';
        }
      });
    }
  }
  if (hasApi) renderLoginState();

  /* Products */
  let products = [];
  const productsContainer = $("#productsContainer");

  function finalPrice(p) {
    const price = Number(p.price) || 0,
      d = Number(p.discount) || 0;
    return Math.max(0, Math.round(price - d));
  }
  function isFav(id) {
    return getFavs().includes(Number(id));
  }

  function cardHTML(p, homepage = false) {
    const fav = isFav(p.id);
    const old = Number(p.price) || 0,
      current = finalPrice(p);
    return `
      <article class="product-card" data-product-id="${p.id}" tabindex="0">
        ${Number(p.discount) > 0 ? `<div class="offer">تخفیف</div>` : ""}
        <button class="like ${fav ? "liked" : ""}" type="button" data-like-id="${p.id}" aria-label="افزودن به علاقه مندی">
          <i class="bi ${fav ? "bi-heart-fill" : "bi-heart"}"></i>
        </button>
        <div class="image">${(p.images && p.images[0]) || p.image ? `<img src="${esc((p.images && p.images[0]) || p.image)}" alt="${esc(p.brand + " " + p.name)}">` : `<div class="image-placeholder"><i class="bi bi-image"></i><span>تصویر محصول</span></div>`}</div>
        <div class="name-and-details"><p class="name">${esc(p.brand)}</p><p class="model">${esc(p.name)}</p></div>
        <div class="inventory"><i class="bi bi-patch-check-fill"></i> موجود در انبار</div>
        <div class="price">
          ${Number(p.discount) > 0 ? `<p class="old-price">${money(old)} تومان</p>` : ""}
          <p class="current-price">${money(current)} تومان</p>
        </div>
        <button class="add-to-cart-btn" type="button" data-product-id="${p.id}"><i class="bi bi-bag-plus"></i> افزودن به سبد خرید</button>
      </article>`;
  }

  function renderList(list, container, homepage = false) {
    if (!container) return;
    container.innerHTML = list.length
      ? list.map((p) => cardHTML(p, homepage)).join("")
      : `<div class="no-products"><p>محصولی با این فیلترها پیدا نشد.</p></div>`;
  }

  function renderSkeleton(container, count = 6) {
    if (!container) return;
    container.innerHTML = Array.from({ length: count })
      .map(
        () => `
      <div class="product-card skeleton-card">
        <div class="skeleton-block skeleton-image"></div>
        <div class="skeleton-block skeleton-line" style="width:60%"></div>
        <div class="skeleton-block skeleton-line" style="width:40%"></div>
        <div class="skeleton-block skeleton-line" style="width:70%;height:20px;"></div>
        <div class="skeleton-block skeleton-btn"></div>
      </div>`,
      )
      .join("");
  }

  async function loadProducts() {
    // قبل از شروع fetch هم اسکلتون رو نشون بده تا کاربر هیچ‌وقت یه کادر خالی نبینه
    renderSkeleton(productsContainer, 9);
    renderSkeleton($(".featured-products .products-container"), 6);
    $$(".men-omega-products-container[data-brand]").forEach((c) => renderSkeleton(c, 5));
    $$(".men-rolex-products-container[data-brand]").forEach((c) => renderSkeleton(c, 5));
    try {
      let loaded = null;

      // GitHub Pages / normal web hosting.
      const urls = [
        "./products.json",
        "./data/products.json",
      ];

      for (const url of urls) {
        try {
          const r = await fetch(`${url}?v=${Date.now()}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (Array.isArray(data)) {
            loaded = data;
            break;
          }
        } catch (err) {
          console.warn("ROMA WATCH JSON fetch failed:", url, err);
        }
      }

      // Reliable fallback for local preview / unusual hosting.
      if (!loaded && Array.isArray(window.ROMA_PRODUCTS)) {
        loaded = window.ROMA_PRODUCTS;
      }

      if (!Array.isArray(loaded)) {
        throw new Error("ROMA products data could not be loaded");
      }

      products = loaded;
      console.log(`ROMA WATCH: ${products.length} products loaded`);

      // Render products first. Filter initialization is isolated below.
      if (productsContainer) {
        renderList(products, productsContainer);
        $("#productCount") &&
          ($("#productCount").textContent = `${money(products.length)} محصول`);
      }

      if ($(".featured-products .products-container")) {
        const c = $(".featured-products .products-container");
        const limit = Number(c.dataset.limit || 6);
        renderList(products.slice(0, limit), c, true);
      }

      $$(".men-omega-products-container[data-brand]").forEach((c) =>
        renderList(
          products
            .filter((p) => p.brand === c.dataset.brand)
            .slice(0, Number(c.dataset.limit || 5)),
          c,
          true,
        ),
      );

      $$(".men-rolex-products-container[data-brand]").forEach((c) =>
        renderList(
          products
            .filter((p) => p.brand === c.dataset.brand)
            .slice(0, Number(c.dataset.limit || 5)),
          c,
          true,
        ),
      );

      // Filters must never be able to replace valid products with an error.
      if (productsContainer) {
        try {
          initShop();
        } catch (filterError) {
          console.error("ROMA WATCH filter initialization:", filterError);
        }
      }

      if ($("#favoritesContainer")) renderFavorites();
      if ($("#productDetail")) renderDetail();
      updateBadges();
    } catch (e) {
      console.error("ROMA WATCH product load:", e);
      [
        productsContainer,
        $(".featured-products .products-container"),
        $(".men-omega-products-container"),
        $(".men-rolex-products-container"),
      ].forEach((c) => {
        if (c) {
          c.innerHTML =
            '<div class="no-products"><p>محصولات قابل نمایش نیستند.</p><small>فایل products.json پیدا نشد.</small></div>';
        }
      });
    }
  }

  /* Shop filters */
  function initShop() {
    const filterInputs = $$(".filter-box[data-filter] input[type=checkbox]");
    const sortSelect = $("#sortSelect");
    const params = new URLSearchParams(location.search);
    const PAGE_SIZE = 24;
    let currentPage = 1;

    function selected() {
      const out = {};
      $$(".filter-box[data-filter]").forEach((box) => {
        const vals = $$("input[type=checkbox]:checked", box).map(
          (i) => i.value,
        );
        if (vals.length) out[box.dataset.filter] = vals;
      });
      return out;
    }
    function syncURLFilters() {
      // URL is read-only here; user interactions do not need to rewrite it.
    }
    function matches(p, filters, ignore = null) {
      if (params.get("discount") === "true" && Number(p.discount) <= 0)
        return false;
      return Object.entries(filters).every(([name, vals]) => {
        if (name === ignore) return true;
        if (name === "options")
          return vals.some((v) =>
            [p.option1, p.option2, p.option3].includes(v),
          );
        if (name === "country" && vals.includes("ALL")) return true;
        return vals.includes(String(p[name]));
      });
    }
    function sortList(list) {
      const mode = sortSelect?.value;
      if (mode === "asc")
        return [...list].sort((a, b) => finalPrice(a) - finalPrice(b));
      if (mode === "desc")
        return [...list].sort((a, b) => finalPrice(b) - finalPrice(a));
      return list;
    }
    function renderPagination(totalItems) {
      const el = $("#paginationControls");
      if (!el) return;
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      if (totalPages <= 1) {
        el.innerHTML = "";
        return;
      }
      const pages = [];
      const add = (n) => pages.push(n);
      add(1);
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        if (i > 1 && i < totalPages) add(i);
      }
      add(totalPages);
      const unique = [...new Set(pages)].sort((a, b) => a - b);

      let html = `<button class="page-btn page-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="صفحه قبل"><i class="bi bi-chevron-right"></i></button>`;
      let prev = 0;
      unique.forEach((n) => {
        if (n - prev > 1) html += `<span class="page-ellipsis">…</span>`;
        html += `<button class="page-btn${n === currentPage ? " active" : ""}" data-page="${n}">${n.toLocaleString("fa-IR")}</button>`;
        prev = n;
      });
      html += `<button class="page-btn page-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="صفحه بعد"><i class="bi bi-chevron-left"></i></button>`;
      el.innerHTML = html;

      $$(".page-btn", el).forEach((btn) => {
        btn.addEventListener("click", () => {
          const n = Number(btn.dataset.page);
          if (!n || n === currentPage || n < 1 || n > totalPages) return;
          currentPage = n;
          apply(false);
          productsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
    function apply(resetPage = true) {
      if (resetPage) currentPage = 1;
      const filters = selected();
      const list = sortList(products.filter((p) => matches(p, filters)));
      const start = (currentPage - 1) * PAGE_SIZE;
      renderList(list.slice(start, start + PAGE_SIZE), productsContainer);
      $("#productCount") &&
        ($("#productCount").textContent = `${money(list.length)} محصول`);
      updateCounts(filters);
      renderPagination(list.length);
    }
    function updateCounts(filters) {
      $$(".filter-box[data-filter]").forEach((box) => {
        const name = box.dataset.filter;
        const without = { ...filters };
        delete without[name];
        $$("label", box).forEach((label) => {
          const input = $("input", label),
            span = $("span", label);
          if (!input || !span) return;
          const count = products.filter((p) => {
            if (!matches(p, without)) return false;
            if (name === "options")
              return [p.option1, p.option2, p.option3].includes(input.value);
            if (name === "country" && input.value === "ALL") return true;
            return String(p[name]) === input.value;
          }).length;
          span.textContent = `(${money(count)})`;
        });
      });
    }

    // URL -> checkboxes. Only exact matching filter groups are touched.
    $$(".filter-box[data-filter]").forEach((box) => {
      const vals = params.getAll(box.dataset.filter);
      if (vals.length)
        $$("input[type=checkbox]", box).forEach(
          (i) => (i.checked = vals.includes(i.value)),
        );
    });
    const qsort = params.get("sort");
    if (sortSelect && qsort && ["asc", "desc"].includes(qsort))
      sortSelect.value = qsort;

    filterInputs.forEach((i) => i.addEventListener("change", apply));
    sortSelect?.addEventListener("change", apply);
    $("#resetFilters")?.addEventListener("click", () => {
      filterInputs.forEach((i) => (i.checked = false));
      if (sortSelect) sortSelect.value = "asc";
      const clean = location.pathname;
      history.replaceState({}, document.title, clean);
      apply();
    });
    $("#search-brand")?.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      const box = e.target.closest(".filter-box");
      $$("label", box).forEach(
        (l) =>
          (l.style.display =
            !q ||
            l.textContent
              .replace(/\(.*?\)/g, "")
              .toLowerCase()
              .includes(q)
              ? "flex"
              : "none"),
      );
    });
    $$(".show-more").forEach((btn) =>
      btn.addEventListener("click", () => {
        const box = btn.closest(".filter-box");
        box?.classList.toggle("active");
        btn
          .querySelector("i")
          ?.classList.toggle(
            "bi-chevron-up",
            box?.classList.contains("active"),
          );
        btn
          .querySelector("i")
          ?.classList.toggle(
            "bi-chevron-down",
            !box?.classList.contains("active"),
          );
      }),
    );

    apply();
  }

  /* Card actions: like, cart, detail */
  document.addEventListener("click", (e) => {
    const like = e.target.closest("[data-like-id]");
    if (like) {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(like.dataset.likeId),
        favs = getFavs(),
        at = favs.indexOf(id);
      if (at >= 0) favs.splice(at, 1);
      else favs.push(id);
      setFavs(favs);
      updateBadges();
      if (isLoggedIn()) {
        RomaAPI.favorites.toggle(id).catch((err) =>
          console.error("ROMA favorite sync failed:", err),
        );
      }
      $(`[data-like-id="${id}"]`) &&
        $$(`[data-like-id="${id}"]`).forEach((b) => {
          const yes = favs.includes(id);
          b.classList.toggle("liked", yes);
          b.innerHTML = `<i class="bi ${yes ? "bi-heart-fill" : "bi-heart"}"></i>`;
        });
      if ($("#favoritesContainer")) renderFavorites();
      return;
    }
    const add = e.target.closest(".add-to-cart-btn");
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      const p = products.find(
        (x) => Number(x.id) === Number(add.dataset.productId),
      );
      if (!p) return;
      const cart = getCart(),
        found = cart.find((x) => Number(x.id) === Number(p.id));
      if (found) found.qty = (found.qty || 1) + 1;
      else cart.push({ id: p.id, qty: 1 });
      setCart(cart);
      updateBadges();
      if (isLoggedIn()) {
        RomaAPI.cart.add(p.id, 1).catch((err) =>
          console.error("ROMA cart sync failed:", err),
        );
      }
      add.classList.add("added");
      add.innerHTML = '<i class="bi bi-check2"></i> به سبد اضافه شد';
      setTimeout(() => {
        add.classList.remove("added");
        add.innerHTML = '<i class="bi bi-bag-plus"></i> افزودن به سبد خرید';
      }, 900);
      return;
    }
    const card = e.target.closest(".product-card[data-product-id]");
    if (card && !e.target.closest("button,a,input")) {
      location.href = `./product.html?id=${encodeURIComponent(card.dataset.productId)}`;
    }
  });

  function renderFavorites() {
    const c = $("#favoritesContainer");
    if (!c) return;
    const ids = getFavs(),
      list = ids
        .map((id) => products.find((p) => Number(p.id) === Number(id)))
        .filter(Boolean);
    renderList(list, c);
    if (!list.length)
      c.innerHTML =
        '<div class="empty-state"><i class="bi bi-heart"></i><h2>هنوز محصولی را پسندیده‌اید؟</h2><a href="./products.htm">رفتن به فروشگاه</a></div>';
  }

  function renderDetail() {
    const c = $("#productDetail"),
      id = Number(new URLSearchParams(location.search).get("id")),
      p = products.find((x) => Number(x.id) === id);
    if (!c || !p) {
      if (c) c.innerHTML = "<div class='no-products'>محصول پیدا نشد.</div>";
      return;
    }
    const PLACEHOLDER = "./images/placeholder-watch.svg";
    const imgs =
      p.images && p.images.length
        ? p.images
        : p.image
          ? [p.image]
          : [PLACEHOLDER];
    const fav = isFav(p.id);
    c.innerHTML = `
      <div class="detail-gallery">
        ${imgs.length > 1 ? `<div class="detail-thumbs">${imgs.map((im, i) => `<button data-gallery="${i}"><img src="${esc(im)}" alt=""></button>`).join("")}</div>` : ""}
        <div class="detail-main-image"><img id="detailMainImage" src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>
      </div>
      <div class="detail-info">
        <p class="detail-brand">${esc(p.brand)}</p><h1>${esc(p.name)}</h1>
        <div class="detail-rating">★★★★★ <span>تضمین اصالت کالا</span></div>
        <div class="detail-price">${money(finalPrice(p))} تومان ${Number(p.discount) > 0 ? `<del>${money(p.price)}</del>` : ""}</div>
        <p class="detail-description">ساعت ${esc(p.name)} از برند ${esc(p.brand)} با طراحی دقیق و کیفیت ساخت بالا؛ انتخابی مطمئن برای استفاده روزمره و موقعیت‌های رسمی. این محصول با تضمین اصالت، بسته‌بندی مناسب و پشتیبانی روما واچ عرضه می‌شود.</p>
        <div class="detail-specs">
          <div><b>مناسب برای</b><span>${esc(p.gender)}</span></div><div><b>موتور</b><span>${esc(p.motorType)}</span></div>
          <div><b>جنس بدنه</b><span>${esc(p.material)}</span></div><div><b>کشور برند</b><span>${esc(p.country)}</span></div>
          <div><b>سبک</b><span>${esc(p.style)}</span></div><div><b>امکانات</b><span>${esc([p.option1, p.option2, p.option3].filter(Boolean).join("، "))}</span></div>
        </div>
        <div class="detail-guarantees"><span><i class="bi bi-patch-check"></i> ضمانت اصالت</span><span><i class="bi bi-arrow-repeat"></i> ۷ روز بازگشت</span><span><i class="bi bi-truck"></i> ارسال سریع</span></div>
        <div class="detail-actions"><button class="add-to-cart-btn" data-product-id="${p.id}"><i class="bi bi-bag-plus"></i> افزودن به سبد خرید</button><button class="detail-like ${fav ? "liked" : ""}" data-like-id="${p.id}"><i class="bi ${fav ? "bi-heart-fill" : "bi-heart"}"></i></button></div>
      </div>`;
    const bc = $("#detailBreadcrumb");
    if (bc) bc.textContent = `${p.brand} ${p.name}`;
    $$(".detail-thumbs button", c).forEach((b) =>
      b.addEventListener(
        "click",
        () => ($("#detailMainImage").src = imgs[Number(b.dataset.gallery)]),
      ),
    );
  }

  /* Favorites page remove-by-heart */
  /* Load */
  loadProducts();
});
