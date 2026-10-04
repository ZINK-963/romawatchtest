document.addEventListener("DOMContentLoaded", async () => {
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATUS_LABELS = {
    pending_payment: "در انتظار پرداخت",
    paid: "پرداخت‌شده",
    processing: "در حال پردازش",
    shipped: "ارسال شده",
    delivered: "تحویل داده شده",
    cancelled: "لغو شده",
    payment_failed: "پرداخت ناموفق",
  };

  const guard = document.getElementById("adminGuard");
  const guardText = document.getElementById("adminGuardText");
  const guardBtn = document.getElementById("adminGuardBtn");

  if (typeof RomaAPI === "undefined" || !RomaAPI.isLoggedIn()) {
    guard.hidden = false;
    return;
  }

  // چک نقش - چون توکن سمت کلاینت قابل دستکاری نیست ولی محتواش رو میشه خوند،
  // بازم هر درخواست واقعی سمت سرور با requireAdmin چک میشه؛ این فقط برای UX سریع‌تره.
  let me;
  try {
    me = await RomaAPI.auth.me();
  } catch (e) {
    guard.hidden = false;
    return;
  }
  if (me.user.role !== "admin") {
    guardText.textContent = "این بخش فقط برای مدیر فروشگاهه.";
    guardBtn.hidden = true;
    guard.hidden = false;
    return;
  }

  document.getElementById("adminContent").hidden = false;

  // ---- آمار ----
  try {
    const res = await RomaAPI.admin.stats();
    const s = res.stats;
    document.getElementById("adminStats").innerHTML = `
      <div class="admin-stat-card"><div class="num">${s.totalOrders.toLocaleString("fa-IR")}</div><div class="label">کل سفارش‌ها</div></div>
      <div class="admin-stat-card"><div class="num">${s.pendingPayment.toLocaleString("fa-IR")}</div><div class="label">در انتظار پرداخت</div></div>
      <div class="admin-stat-card"><div class="num">${s.paidOrProcessing.toLocaleString("fa-IR")}</div><div class="label">پرداخت‌شده/در حال پردازش</div></div>
      <div class="admin-stat-card"><div class="num">${money(s.revenue)}</div><div class="label">مجموع فروش (تومان)</div></div>`;
  } catch (e) {
    console.error("ROMA admin stats:", e);
  }

  // ---- لیست سفارش‌ها ----
  const listEl = document.getElementById("adminOrdersList");
  async function loadOrders(status) {
    listEl.innerHTML = `<p class="muted">در حال بارگذاری...</p>`;
    try {
      const res = await RomaAPI.admin.orders(status);
      const orders = res.orders || [];
      if (!orders.length) {
        listEl.innerHTML = `<p class="muted">سفارشی پیدا نشد.</p>`;
        return;
      }
      listEl.innerHTML = "";
      orders.forEach((o) => {
        const row = document.createElement("div");
        row.className = "order-row";
        row.innerHTML = `
          <div>
            <div class="order-row-code">${esc(o.code)} — ${esc(o.customer.fullName)}</div>
            <div class="order-row-date">${new Date(o.createdAt).toLocaleDateString("fa-IR")} — ${esc(o.customer.phone)}</div>
          </div>
          <div class="order-row-total">${money(o.total)} تومان</div>
          <span class="order-status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>`;
        row.addEventListener("click", () => openOrderDetail(o.id));
        listEl.appendChild(row);
      });
    } catch (e) {
      listEl.innerHTML = `<p class="muted">دریافت سفارش‌ها با خطا مواجه شد.</p>`;
    }
  }
  loadOrders("");

  document.querySelectorAll("#statusTabs .account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#statusTabs .account-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadOrders(tab.dataset.status);
    });
  });

  // ---- جزئیات + تغییر وضعیت ----
  const overlay = document.getElementById("orderDetailOverlay");
  document.getElementById("closeOrderDetail").addEventListener("click", () => (overlay.hidden = true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  async function openOrderDetail(id) {
    overlay.hidden = false;
    const body = document.getElementById("orderDetailBody");
    body.innerHTML = `<p class="muted">در حال بارگذاری...</p>`;
    try {
      const res = await RomaAPI.admin.order(id);
      const o = res.order;
      body.innerHTML = `
        <div class="summary-line"><span>کد سفارش</span><b>${esc(o.code)}</b></div>
        <div class="summary-line"><span>گیرنده</span><span>${esc(o.customer.fullName)} — ${esc(o.customer.phone)}</span></div>
        <div class="summary-line"><span>آدرس</span><span>${esc(o.customer.province)}، ${esc(o.customer.city)} - ${esc(o.customer.address)}</span></div>
        <div class="summary-line"><span>کد پستی</span><span>${esc(o.customer.postalCode)}</span></div>
        ${o.customer.notes ? `<div class="summary-line"><span>توضیحات</span><span>${esc(o.customer.notes)}</span></div>` : ""}
        <div class="summary-line"><span>روش ارسال</span><span>${o.shippingMethodLabel}</span></div>
        <div class="checkout-items" style="margin-top:14px;">
          ${o.items
            .map(
              (it) => `<div class="checkout-item-row">
              <div class="checkout-item-info"><div class="checkout-item-name">${it.brand} ${it.name}</div><div class="checkout-item-qty">تعداد: ${it.qty.toLocaleString("fa-IR")}</div></div>
              <div class="checkout-item-price">${money(it.unitPrice * it.qty)} تومان</div></div>`
            )
            .join("")}
        </div>
        <div class="summary-line"><span>جمع کالاها</span><span>${money(o.itemsTotal)} تومان</span></div>
        <div class="summary-line"><span>هزینه ارسال</span><span>${o.shippingCost ? money(o.shippingCost) + " تومان" : "رایگان"}</span></div>
        <div class="summary-line total"><span>مبلغ نهایی</span><span>${money(o.total)} تومان</span></div>
        <div class="status-update-row">
          <select id="statusSelect">
            ${Object.entries(STATUS_LABELS)
              .map(([key, label]) => `<option value="${key}" ${key === o.status ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
          <button class="btn-brass" id="updateStatusBtn">بروزرسانی</button>
        </div>
        <div id="statusMsg" class="form-msg" hidden></div>`;

      document.getElementById("updateStatusBtn").addEventListener("click", async () => {
        const btn = document.getElementById("updateStatusBtn");
        const msgEl = document.getElementById("statusMsg");
        const newStatus = document.getElementById("statusSelect").value;
        btn.disabled = true;
        try {
          await RomaAPI.admin.updateStatus(o.id, newStatus);
          msgEl.textContent = "وضعیت بروزرسانی شد و پیامک به مشتری ارسال شد.";
          msgEl.className = "form-msg ok";
          msgEl.hidden = false;
          const activeTab = document.querySelector("#statusTabs .account-tab.active");
          loadOrders(activeTab ? activeTab.dataset.status : "");
        } catch (err) {
          msgEl.textContent = err.message || "بروزرسانی با خطا مواجه شد.";
          msgEl.className = "form-msg err";
          msgEl.hidden = false;
        } finally {
          btn.disabled = false;
        }
      });
    } catch (err) {
      body.innerHTML = `<p class="muted">${err.message || "دریافت جزئیات سفارش با خطا مواجه شد."}</p>`;
    }
  }

  // ---- سوییچ بخش سفارش‌ها / محصولات ----
  document.querySelectorAll("#sectionTabs .account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#sectionTabs .account-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-section").forEach((s) => s.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`section-${tab.dataset.section}`).classList.add("active");
      if (tab.dataset.section === "products" && !productsLoaded) loadProducts();
      if (tab.dataset.section === "coupons" && !couponsLoaded) loadCoupons();
    });
  });

  // ============== مدیریت محصولات ==============
  const GENDERS = { "مردانه": "مردانه", "زنانه": "زنانه", "ست": "ست" };
  const OPTION_CHOICES = ["", "ضد آب", "تقویم", "کرنوگراف", "شب نما", "تایمر"];
  let allProducts = [];
  let productsLoaded = false;
  const productsListEl = document.getElementById("adminProductsList");
  const productFormOverlay = document.getElementById("productFormOverlay");
  const productFormBody = document.getElementById("productFormBody");

  function stockBadge(stock) {
    const n = Number(stock) || 0;
    if (n <= 0) return `<span class="apr-stock out">ناموجود</span>`;
    if (n <= 3) return `<span class="apr-stock low">${n.toLocaleString("fa-IR")} باقی‌مانده</span>`;
    return `<span class="apr-stock ok">${n.toLocaleString("fa-IR")} موجود</span>`;
  }

  function renderProductsList(query) {
    const q = (query || "").trim();
    const filtered = q
      ? allProducts.filter((p) => `${p.brand} ${p.name}`.includes(q))
      : allProducts;
    if (!filtered.length) {
      productsListEl.innerHTML = `<p class="muted">محصولی پیدا نشد.</p>`;
      return;
    }
    productsListEl.innerHTML = filtered
      .map(
        (p) => `
      <div class="admin-product-row" data-id="${p.id}">
        <img src="${(p.images && p.images[0]) || p.image || "./images/placeholder-watch.svg"}" alt="">
        <div class="apr-info">
          <div class="apr-brand">${p.brand}</div>
          <div class="apr-name">${p.name}</div>
        </div>
        <div class="apr-price">${Number(p.price - (p.discount || 0)).toLocaleString("fa-IR")} تومان</div>
        ${stockBadge(p.stock)}
        <div class="apr-actions">
          <button class="edit-product" title="ویرایش"><i class="bi bi-pencil"></i></button>
          <button class="danger delete-product" title="حذف"><i class="bi bi-trash3"></i></button>
        </div>
      </div>`,
      )
      .join("");

    productsListEl.querySelectorAll(".edit-product").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.closest(".admin-product-row").dataset.id);
        openProductForm(allProducts.find((p) => p.id === id));
      });
    });
    productsListEl.querySelectorAll(".delete-product").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.closest(".admin-product-row").dataset.id);
        const p = allProducts.find((x) => x.id === id);
        if (!confirm(`محصول «${p.brand} ${p.name}» حذف بشه؟ این کار قابل بازگشت نیست.`)) return;
        try {
          await RomaAPI.admin.products.remove(id);
          allProducts = allProducts.filter((x) => x.id !== id);
          renderProductsList(document.getElementById("productSearchInput").value);
        } catch (err) {
          alert(err.message || "حذف محصول با خطا مواجه شد.");
        }
      });
    });
  }

  async function loadProducts() {
    productsListEl.innerHTML = `<p class="muted">در حال بارگذاری...</p>`;
    try {
      const res = await RomaAPI.admin.products.list();
      allProducts = res.products || [];
      productsLoaded = true;
      renderProductsList("");
    } catch (err) {
      productsListEl.innerHTML = `<p class="muted">دریافت محصولات با خطا مواجه شد.</p>`;
    }
  }

  document.getElementById("productSearchInput").addEventListener("input", (e) => {
    renderProductsList(e.target.value);
  });

  document.getElementById("addProductBtn").addEventListener("click", () => openProductForm(null));
  document.getElementById("closeProductForm").addEventListener("click", () => (productFormOverlay.hidden = true));
  productFormOverlay.addEventListener("click", (e) => {
    if (e.target === productFormOverlay) productFormOverlay.hidden = true;
  });

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderImageSlots(product) {
    const images = (product && product.images) || [];
    let html = "";
    for (let i = 0; i < 3; i++) {
      if (images[i]) {
        html += `
          <div class="product-image-slot" data-index="${i}">
            <img src="${images[i]}" alt="">
            <button type="button" class="slot-remove" data-index="${i}"><i class="bi bi-x"></i></button>
          </div>`;
      } else if (product && product.id) {
        html += `
          <label class="product-image-slot">
            <span class="slot-add"><i class="bi bi-plus"></i></span>
            <input type="file" accept="image/jpeg,image/png,image/webp" class="image-upload-input">
          </label>`;
      } else {
        html += `<div class="product-image-slot" style="opacity:.4"><span class="slot-add"><i class="bi bi-image"></i></span></div>`;
      }
    }
    return html;
  }

  function wireImageSlots(product) {
    const container = document.getElementById("productImageManager");
    if (!container) return;
    container.querySelectorAll(".slot-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const index = Number(btn.dataset.index);
        try {
          const res = await RomaAPI.admin.products.deleteImage(product.id, index);
          Object.assign(product, res.product);
          const idx = allProducts.findIndex((p) => p.id === product.id);
          if (idx > -1) allProducts[idx] = product;
          container.innerHTML = renderImageSlots(product);
          wireImageSlots(product);
          renderProductsList(document.getElementById("productSearchInput").value);
        } catch (err) {
          alert(err.message || "حذف عکس با خطا مواجه شد.");
        }
      });
    });
    container.querySelectorAll(".image-upload-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await fileToDataUrl(file);
          const res = await RomaAPI.admin.products.uploadImage(product.id, dataUrl);
          Object.assign(product, res.product);
          const idx = allProducts.findIndex((p) => p.id === product.id);
          if (idx > -1) allProducts[idx] = product;
          container.innerHTML = renderImageSlots(product);
          wireImageSlots(product);
          renderProductsList(document.getElementById("productSearchInput").value);
        } catch (err) {
          alert(err.message || "آپلود عکس با خطا مواجه شد.");
        }
      });
    });
  }

  function openProductForm(product) {
    const isEdit = Boolean(product);
    document.getElementById("productFormTitle").textContent = isEdit ? "ویرایش محصول" : "افزودن محصول جدید";
    const p = product || {
      brand: "", name: "", price: "", discount: 0, gender: "مردانه",
      displayColor: "", bodyColor: "", material: "", motorType: "quartz",
      style: "کلاسیک", option1: "", option2: "", option3: "", country: "", stock: 0,
    };

    productFormBody.innerHTML = `
      <form id="productForm">
        <div class="product-form-grid">
          <div class="field"><label>برند</label><input name="brand" value="${p.brand}" required></div>
          <div class="field"><label>نام/مدل</label><input name="name" value="${p.name}" required></div>
          <div class="field"><label>قیمت (تومان)</label><input name="price" type="number" min="0" value="${p.price}" required></div>
          <div class="field"><label>تخفیف (تومان)</label><input name="discount" type="number" min="0" value="${p.discount || 0}"></div>
          <div class="field"><label>موجودی انبار</label><input name="stock" type="number" min="0" value="${p.stock ?? 0}" required></div>
          <div class="field">
            <label>مناسب برای</label>
            <select name="gender">
              ${Object.keys(GENDERS).map((g) => `<option value="${g}" ${p.gender === g ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>رنگ صفحه</label><input name="displayColor" value="${p.displayColor || ""}" placeholder="مثلاً black"></div>
          <div class="field"><label>رنگ بدنه</label><input name="bodyColor" value="${p.bodyColor || ""}" placeholder="مثلاً silver"></div>
          <div class="field"><label>جنس بند</label><input name="material" value="${p.material || ""}" placeholder="مثلاً استیل"></div>
          <div class="field"><label>نوع موتور</label><input name="motorType" value="${p.motorType || ""}" placeholder="quartz / digital / automatic"></div>
          <div class="field"><label>سبک ساعت</label><input name="style" value="${p.style || ""}" placeholder="مثلاً کلاسیک"></div>
          <div class="field"><label>کشور سازنده</label><input name="country" value="${p.country || ""}"></div>
          <div class="field full">
            <label>امکانات (حداکثر ۳ مورد)</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              ${[1, 2, 3]
                .map(
                  (n) => `
                <select name="option${n}" style="flex:1;min-width:120px;">
                  ${OPTION_CHOICES.map((o) => `<option value="${o}" ${p[`option${n}`] === o ? "selected" : ""}>${o || "—"}</option>`).join("")}
                </select>`,
                )
                .join("")}
            </div>
          </div>
        </div>

        <label style="display:block;margin-top:16px;">عکس‌های محصول (حداکثر ۳ عدد)</label>
        <div class="product-image-manager" id="productImageManager">${renderImageSlots(product)}</div>
        ${!isEdit ? `<p class="muted" style="font-size:.78rem;">بعد از ذخیره‌ی اولیه‌ی محصول، می‌تونی عکس اضافه کنی.</p>` : ""}

        <div style="display:flex;gap:10px;margin-top:18px;">
          <button type="submit" class="btn-brass">${isEdit ? "ذخیره تغییرات" : "افزودن محصول"}</button>
          <button type="button" class="btn-outline" id="cancelProductForm">انصراف</button>
        </div>
        <div id="productFormMsg" class="form-msg" hidden></div>
      </form>`;

    if (isEdit) wireImageSlots(product);

    document.getElementById("cancelProductForm").addEventListener("click", () => (productFormOverlay.hidden = true));

    document.getElementById("productForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      ["price", "discount", "stock"].forEach((k) => (data[k] = Number(data[k]) || 0));
      const msgEl = document.getElementById("productFormMsg");
      try {
        if (isEdit) {
          const res = await RomaAPI.admin.products.update(product.id, data);
          const idx = allProducts.findIndex((x) => x.id === product.id);
          if (idx > -1) allProducts[idx] = res.product;
          renderProductsList(document.getElementById("productSearchInput").value);
          productFormOverlay.hidden = true;
        } else {
          const res = await RomaAPI.admin.products.create(data);
          allProducts.unshift(res.product);
          renderProductsList("");
          // بعد از ساخت، فرم رو دوباره باز کن روی حالت ویرایش تا بشه عکس اضافه کرد
          openProductForm(res.product);
        }
      } catch (err) {
        msgEl.textContent = err.message || "ذخیره محصول با خطا مواجه شد.";
        msgEl.className = "form-msg err";
        msgEl.hidden = false;
      }
    });

    productFormOverlay.hidden = false;
  }

  // ============== مدیریت کدهای تخفیف ==============
  let allCoupons = [];
  let couponsLoaded = false;
  const couponsListEl = document.getElementById("adminCouponsList");
  const couponFormOverlay = document.getElementById("couponFormOverlay");
  const couponFormBody = document.getElementById("couponFormBody");

  function couponValueText(c) {
    return c.type === "percent" ? `${c.value.toLocaleString("fa-IR")}٪` : `${money(c.value)} تومان`;
  }

  function renderCouponsList() {
    if (!allCoupons.length) {
      couponsListEl.innerHTML = `<p class="muted">هنوز کد تخفیفی نساختی.</p>`;
      return;
    }
    couponsListEl.innerHTML = allCoupons
      .map((c) => {
        const usageText = c.usageLimit
          ? `${c.usedCount.toLocaleString("fa-IR")} از ${c.usageLimit.toLocaleString("fa-IR")} استفاده شده`
          : `${c.usedCount.toLocaleString("fa-IR")} بار استفاده شده`;
        const expiredText = c.expiresAt && Date.now() > c.expiresAt ? " — منقضی شده" : "";
        return `
      <div class="admin-coupon-row" data-id="${c.id}">
        <div class="acr-info">
          <span class="acr-code">${c.code}</span>
          <span class="acr-value">${couponValueText(c)}${c.description ? " — " + c.description : ""}</span>
          <span class="acr-usage">${usageText}${expiredText}</span>
        </div>
        <span class="apr-stock ${c.active ? "ok" : "out"}">${c.active ? "فعال" : "غیرفعال"}</span>
        <div class="apr-actions">
          <button class="toggle-coupon" title="${c.active ? "غیرفعال کردن" : "فعال کردن"}"><i class="bi bi-power"></i></button>
          <button class="edit-coupon" title="ویرایش"><i class="bi bi-pencil"></i></button>
          <button class="danger delete-coupon" title="حذف"><i class="bi bi-trash3"></i></button>
        </div>
      </div>`;
      })
      .join("");

    couponsListEl.querySelectorAll(".toggle-coupon").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".admin-coupon-row").dataset.id;
        const c = allCoupons.find((x) => x.id === id);
        try {
          const res = await RomaAPI.admin.coupons.update(id, { active: !c.active });
          Object.assign(c, res.coupon);
          renderCouponsList();
        } catch (err) {
          alert(err.message || "بروزرسانی با خطا مواجه شد.");
        }
      });
    });
    couponsListEl.querySelectorAll(".edit-coupon").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".admin-coupon-row").dataset.id;
        openCouponForm(allCoupons.find((x) => x.id === id));
      });
    });
    couponsListEl.querySelectorAll(".delete-coupon").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".admin-coupon-row").dataset.id;
        const c = allCoupons.find((x) => x.id === id);
        if (!confirm(`کد «${c.code}» حذف بشه؟`)) return;
        try {
          await RomaAPI.admin.coupons.remove(id);
          allCoupons = allCoupons.filter((x) => x.id !== id);
          renderCouponsList();
        } catch (err) {
          alert(err.message || "حذف با خطا مواجه شد.");
        }
      });
    });
  }

  async function loadCoupons() {
    couponsListEl.innerHTML = `<p class="muted">در حال بارگذاری...</p>`;
    try {
      const res = await RomaAPI.admin.coupons.list();
      allCoupons = res.coupons || [];
      couponsLoaded = true;
      renderCouponsList();
    } catch (err) {
      couponsListEl.innerHTML = `<p class="muted">دریافت کدهای تخفیف با خطا مواجه شد.</p>`;
    }
  }

  document.getElementById("addCouponBtn").addEventListener("click", () => openCouponForm(null));
  document.getElementById("closeCouponForm").addEventListener("click", () => (couponFormOverlay.hidden = true));
  couponFormOverlay.addEventListener("click", (e) => {
    if (e.target === couponFormOverlay) couponFormOverlay.hidden = true;
  });

  function openCouponForm(coupon) {
    const isEdit = Boolean(coupon);
    document.getElementById("couponFormTitle").textContent = isEdit ? "ویرایش کد تخفیف" : "افزودن کد تخفیف جدید";
    const c = coupon || { code: "", type: "percent", value: "", description: "", minOrderAmount: 0, usageLimit: "", expiresAt: "" };
    const expiresValue = c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : "";

    couponFormBody.innerHTML = `
      <form id="couponForm">
        <div class="product-form-grid">
          <div class="field"><label>کد تخفیف</label><input name="code" value="${c.code}" ${isEdit ? "disabled" : ""} placeholder="مثلاً WELCOME10" required></div>
          <div class="field">
            <label>نوع تخفیف</label>
            <select name="type">
              <option value="percent" ${c.type === "percent" ? "selected" : ""}>درصدی</option>
              <option value="fixed" ${c.type === "fixed" ? "selected" : ""}>مبلغ ثابت (تومان)</option>
            </select>
          </div>
          <div class="field"><label>مقدار</label><input name="value" type="number" min="0" value="${c.value}" required></div>
          <div class="field"><label>حداقل مبلغ سفارش (تومان، اختیاری)</label><input name="minOrderAmount" type="number" min="0" value="${c.minOrderAmount || 0}"></div>
          <div class="field"><label>سقف تعداد استفاده (اختیاری)</label><input name="usageLimit" type="number" min="0" value="${c.usageLimit || ""}"></div>
          <div class="field"><label>تاریخ انقضا (اختیاری)</label><input name="expiresAt" type="date" value="${expiresValue}"></div>
          <div class="field full"><label>توضیح (اختیاری، به مشتری نشون داده میشه)</label><input name="description" value="${c.description || ""}"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;">
          <button type="submit" class="btn-brass">${isEdit ? "ذخیره تغییرات" : "افزودن کد"}</button>
          <button type="button" class="btn-outline" id="cancelCouponForm">انصراف</button>
        </div>
        <div id="couponFormMsg" class="form-msg" hidden></div>
      </form>`;

    document.getElementById("cancelCouponForm").addEventListener("click", () => (couponFormOverlay.hidden = true));

    document.getElementById("couponForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.value = Number(data.value) || 0;
      data.minOrderAmount = Number(data.minOrderAmount) || 0;
      data.usageLimit = data.usageLimit ? Number(data.usageLimit) : null;
      data.expiresAt = data.expiresAt || null;
      const msgEl = document.getElementById("couponFormMsg");
      try {
        if (isEdit) {
          const res = await RomaAPI.admin.coupons.update(coupon.id, data);
          const idx = allCoupons.findIndex((x) => x.id === coupon.id);
          if (idx > -1) allCoupons[idx] = res.coupon;
        } else {
          const res = await RomaAPI.admin.coupons.create(data);
          allCoupons.unshift(res.coupon);
        }
        renderCouponsList();
        couponFormOverlay.hidden = true;
      } catch (err) {
        msgEl.textContent = err.message || "ذخیره کد تخفیف با خطا مواجه شد.";
        msgEl.className = "form-msg err";
        msgEl.hidden = false;
      }
    });

    couponFormOverlay.hidden = false;
  }
});
