document.addEventListener("DOMContentLoaded", async () => {
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const STATUS_LABELS = {
    pending_payment: "در انتظار پرداخت",
    paid: "پرداخت‌شده",
    processing: "در حال پردازش",
    shipped: "ارسال شده",
    delivered: "تحویل داده شده",
    cancelled: "لغو شده",
    payment_failed: "پرداخت ناموفق",
  };

  if (typeof RomaAPI === "undefined" || !RomaAPI.isLoggedIn()) {
    document.getElementById("accountGuard").hidden = false;
    return;
  }
  document.getElementById("accountContent").hidden = false;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (!confirm("از حساب کاربری خارج بشید؟")) return;
    await RomaAPI.auth.logout();
    try { localStorage.removeItem("roma_user_name"); } catch (e) {}
    location.href = "./index.html";
  });

  // ---- تب‌ها ----
  document.querySelectorAll(".account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".account-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".account-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
    });
  });

  // ---- پروفایل ----
  function showMsg(el, msg, ok) {
    el.textContent = msg;
    el.className = `form-msg ${ok ? "ok" : "err"}`;
    el.hidden = false;
  }

  try {
    const res = await RomaAPI.users.profile();
    document.getElementById("profilePhone").value = res.user.phone;
    document.getElementById("profileName").value = res.user.name || "";
    document.getElementById("profileEmail").value = res.user.email || "";
  } catch (e) {
    console.error("ROMA profile load:", e);
  }

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("profileMsg");
    try {
      await RomaAPI.users.updateProfile({
        name: document.getElementById("profileName").value.trim(),
        email: document.getElementById("profileEmail").value.trim(),
      });
      showMsg(msgEl, "تغییرات ذخیره شد.", true);
    } catch (err) {
      showMsg(msgEl, err.message || "ذخیره تغییرات با خطا مواجه شد.", false);
    }
  });

  // ---- آدرس‌ها ----
  const addressListEl = document.getElementById("addressList");
  const addressForm = document.getElementById("addressForm");

  async function loadAddresses() {
    addressListEl.innerHTML = `<p class="muted">در حال بارگذاری...</p>`;
    try {
      const res = await RomaAPI.users.addresses.list();
      const addresses = res.addresses || [];
      if (!addresses.length) {
        addressListEl.innerHTML = `<p class="muted">هنوز آدرسی ثبت نکردی.</p>`;
        return;
      }
      addressListEl.innerHTML = "";
      addresses.forEach((a) => {
        const card = document.createElement("div");
        card.className = "address-card";
        card.innerHTML = `
          <div class="address-card-info">
            <b>${a.title}</b>
            <p>${a.province}، ${a.city}<br>${a.address}<br>کد پستی: ${a.postalCode} — تماس: ${a.receiverPhone}</p>
          </div>
          <div class="address-card-actions">
            <button class="btn-outline edit-addr" data-id="${a.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn-danger-outline delete-addr" data-id="${a.id}"><i class="bi bi-trash3"></i></button>
          </div>`;
        addressListEl.appendChild(card);

        card.querySelector(".edit-addr").addEventListener("click", () => {
          document.getElementById("addressId").value = a.id;
          document.getElementById("addrTitle").value = a.title;
          document.getElementById("addrReceiverPhone").value = a.receiverPhone;
          document.getElementById("addrProvince").value = a.province;
          document.getElementById("addrCity").value = a.city;
          document.getElementById("addrAddress").value = a.address;
          document.getElementById("addrPostal").value = a.postalCode;
          addressForm.hidden = false;
        });
        card.querySelector(".delete-addr").addEventListener("click", async () => {
          if (!confirm("این آدرس حذف بشه؟")) return;
          try {
            await RomaAPI.users.addresses.remove(a.id);
            loadAddresses();
          } catch (err) {
            alert(err.message || "حذف آدرس با خطا مواجه شد.");
          }
        });
      });
    } catch (e) {
      addressListEl.innerHTML = `<p class="muted">دریافت آدرس‌ها با خطا مواجه شد.</p>`;
    }
  }
  loadAddresses();

  document.getElementById("addAddressBtn").addEventListener("click", () => {
    document.getElementById("addressId").value = "";
    addressForm.reset();
    addressForm.hidden = false;
  });
  document.getElementById("cancelAddressBtn").addEventListener("click", () => {
    addressForm.hidden = true;
  });

  addressForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("addressMsg");
    const id = document.getElementById("addressId").value;
    const payload = {
      title: document.getElementById("addrTitle").value.trim(),
      receiverPhone: document.getElementById("addrReceiverPhone").value.trim(),
      province: document.getElementById("addrProvince").value.trim(),
      city: document.getElementById("addrCity").value.trim(),
      address: document.getElementById("addrAddress").value.trim(),
      postalCode: document.getElementById("addrPostal").value.trim(),
    };
    try {
      if (id) await RomaAPI.users.addresses.update(id, payload);
      else await RomaAPI.users.addresses.add(payload);
      addressForm.hidden = true;
      showMsg(msgEl, "آدرس ذخیره شد.", true);
      loadAddresses();
    } catch (err) {
      showMsg(msgEl, err.message || "ذخیره آدرس با خطا مواجه شد.", false);
    }
  });

  // ---- سفارش‌ها ----
  const ordersListEl = document.getElementById("ordersList");
  let ordersCache = [];

  function renderOrdersList() {
    if (!ordersCache.length) {
      ordersListEl.innerHTML = `<p class="muted">هنوز سفارشی ثبت نکردی.</p>`;
      return;
    }
    ordersListEl.innerHTML = "";
    ordersCache.forEach((o) => {
      const row = document.createElement("div");
      row.className = "order-row";
      row.innerHTML = `
        <div>
          <div class="order-row-code">${o.code}</div>
          <div class="order-row-date">${new Date(o.createdAt).toLocaleDateString("fa-IR")}</div>
        </div>
        <div class="order-row-total">${money(o.total)} تومان</div>
        <span class="order-status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>`;
      row.addEventListener("click", () => openOrderDetail(o.id));
      ordersListEl.appendChild(row);
    });
  }

  try {
    const res = await RomaAPI.orders.mine();
    ordersCache = res.orders || [];
    renderOrdersList();
  } catch (e) {
    ordersListEl.innerHTML = `<p class="muted">دریافت سفارش‌ها با خطا مواجه شد.</p>`;
  }

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
      const res = await RomaAPI.orders.get(id);
      const o = res.order;
      body.innerHTML = `
        <div class="summary-line"><span>کد سفارش</span><b>${o.code}</b></div>
        <div class="summary-line"><span>وضعیت</span><span class="order-status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></div>
        <div class="summary-line"><span>گیرنده</span><span>${o.customer?.fullName || "-"}</span></div>
        <div class="summary-line"><span>آدرس</span><span>${o.customer?.province || ""}، ${o.customer?.city || ""} - ${o.customer?.address || ""}</span></div>
        <div class="summary-line"><span>روش ارسال</span><span>${o.shippingMethodLabel || "-"}</span></div>
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
        ${
          ["pending_payment", "paid", "processing"].includes(o.status)
            ? `<button class="btn-danger-outline" id="cancelOrderBtn" style="margin-top:16px;padding:10px 18px;width:100%;">
                 <i class="bi bi-x-circle"></i> لغو این سفارش
               </button>
               <div id="cancelOrderMsg" class="form-msg" hidden></div>`
            : ""
        }`;

      const cancelBtn = document.getElementById("cancelOrderBtn");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
          if (!confirm("این سفارش لغو بشه؟ این کار قابل بازگشت نیست.")) return;
          const msgEl = document.getElementById("cancelOrderMsg");
          cancelBtn.disabled = true;
          try {
            await RomaAPI.orders.cancel(o.id);
            msgEl.textContent = "سفارش با موفقیت لغو شد.";
            msgEl.className = "form-msg ok";
            msgEl.hidden = false;
            cancelBtn.remove();
            const res2 = await RomaAPI.orders.mine();
            ordersCache = res2.orders || [];
            renderOrdersList();
          } catch (err) {
            msgEl.textContent = err.message || "لغو سفارش با خطا مواجه شد.";
            msgEl.className = "form-msg err";
            msgEl.hidden = false;
            cancelBtn.disabled = false;
          }
        });
      }
    } catch (err) {
      body.innerHTML = `<p class="muted">${err.message || "دریافت جزئیات سفارش با خطا مواجه شد."}</p>`;
    }
  }
});
