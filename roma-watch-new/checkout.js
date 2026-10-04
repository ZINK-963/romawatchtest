document.addEventListener("DOMContentLoaded", async () => {
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const final = (p) => Math.max(0, Math.round(Number(p.price || 0) - Number(p.discount || 0)));

  const guard = document.getElementById("checkoutGuard");
  const emptyBox = document.getElementById("checkoutEmpty");
  const form = document.getElementById("checkoutForm");
  const errorBox = document.getElementById("checkoutError");

  if (typeof RomaAPI === "undefined" || !RomaAPI.isLoggedIn()) {
    guard.hidden = false;
    return;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function hideError() {
    errorBox.hidden = true;
  }

  // ---- 1) بارگذاری سبد خرید سرور (منبع حقیقت، نه لوکال‌استوریج) ----
  let cartItems = [];
  let products = [];
  try {
    const [cartRes, prodRes] = await Promise.all([
      RomaAPI.cart.get(),
      fetch("./products.json?v=3", { cache: "no-store" }).then((r) => r.json()),
    ]);
    cartItems = cartRes.items || [];
    products = prodRes || [];
  } catch (e) {
    console.error("ROMA checkout load:", e);
    showError("در دریافت اطلاعات سبد خرید مشکلی پیش اومد. صفحه رو رفرش کنید.");
  }

  if (!cartItems.length) {
    emptyBox.hidden = false;
    return;
  }

  const rows = cartItems
    .map((item) => ({ item, p: products.find((x) => Number(x.id) === Number(item.id)) }))
    .filter((x) => x.p);

  const itemsContainer = document.getElementById("checkoutItems");
  let itemsTotal = 0;
  rows.forEach(({ item, p }) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const lineTotal = final(p) * qty;
    itemsTotal += lineTotal;
    const row = document.createElement("div");
    row.className = "checkout-item-row";
    row.innerHTML = `
      <img src="${(p.images && p.images[0]) || p.image || "./images/placeholder-watch.svg"}" alt="${p.name || ""}">
      <div class="checkout-item-info">
        <div class="checkout-item-name">${p.brand || ""} ${p.name || ""}</div>
        <div class="checkout-item-qty">تعداد: ${qty.toLocaleString("fa-IR")}</div>
      </div>
      <div class="checkout-item-price">${money(lineTotal)} تومان</div>`;
    itemsContainer.appendChild(row);
  });
  document.getElementById("sumItems").textContent = `${money(itemsTotal)} تومان`;

  // ---- 2) روش‌های ارسال ----
  let shippingCost = 0;
  let codExtraCost = 0;
  let couponDiscount = 0;
  let appliedCouponCode = "";
  let selectedMethod = "";
  let selectedPaymentMethod = "online";
  const methodsBox = document.getElementById("shippingMethods");
  function updateTotal() {
    const total = Math.max(0, itemsTotal + shippingCost + codExtraCost - couponDiscount);
    document.getElementById("sumTotal").textContent = `${money(total)} تومان`;
  }
  try {
    const res = await RomaAPI.orders.shippingMethods();
    methodsBox.innerHTML = "";
    (res.methods || []).forEach((m, i) => {
      const id = `ship-${m.key}`;
      const label = document.createElement("label");
      label.className = "shipping-option";
      label.innerHTML = `
        <input type="radio" name="shippingMethod" value="${m.key}" id="${id}" ${i === 0 ? "checked" : ""}>
        <span class="shipping-option-label">${m.label}</span>
        <span class="shipping-option-cost">${m.cost ? money(m.cost) + " تومان" : "رایگان"}</span>`;
      methodsBox.appendChild(label);
      if (i === 0) {
        selectedMethod = m.key;
        shippingCost = m.cost;
      }
    });
    document.getElementById("sumShipping").textContent = shippingCost ? `${money(shippingCost)} تومان` : "رایگان";
    updateTotal();
    methodsBox.addEventListener("change", (e) => {
      const input = e.target.closest('input[name="shippingMethod"]');
      if (!input) return;
      const m = res.methods.find((x) => x.key === input.value);
      selectedMethod = m.key;
      shippingCost = m.cost;
      document.getElementById("sumShipping").textContent = shippingCost ? `${money(shippingCost)} تومان` : "رایگان";
      updateTotal();
    });
  } catch (e) {
    methodsBox.innerHTML = `<p class="muted">دریافت روش‌های ارسال با خطا مواجه شد.</p>`;
  }

  // ---- 2.5) روش‌های پرداخت ----
  const paymentMethodsBox = document.getElementById("paymentMethods");
  const codRow = document.getElementById("sumCodRow");
  const codCell = document.getElementById("sumCod");
  function applyCodRow() {
    if (codExtraCost > 0 && selectedPaymentMethod === "cod") {
      codRow.hidden = false;
      codCell.textContent = `${money(codExtraCost)} تومان`;
    } else {
      codRow.hidden = true;
    }
    updateTotal();
  }
  try {
    const res = await RomaAPI.orders.paymentMethods();
    paymentMethodsBox.innerHTML = "";
    (res.methods || []).forEach((m, i) => {
      const id = `pay-${m.key}`;
      const label = document.createElement("label");
      label.className = "shipping-option";
      label.innerHTML = `
        <input type="radio" name="paymentMethod" value="${m.key}" id="${id}" ${i === 0 ? "checked" : ""}>
        <span class="shipping-option-label">${m.label}</span>
        <span class="shipping-option-cost">${m.extraCost ? "+" + money(m.extraCost) + " تومان" : ""}</span>`;
      paymentMethodsBox.appendChild(label);
      if (i === 0) {
        selectedPaymentMethod = m.key;
        codExtraCost = m.extraCost || 0;
      }
    });
    applyCodRow();
    paymentMethodsBox.addEventListener("change", (e) => {
      const input = e.target.closest('input[name="paymentMethod"]');
      if (!input) return;
      const m = res.methods.find((x) => x.key === input.value);
      selectedPaymentMethod = m.key;
      codExtraCost = m.extraCost || 0;
      applyCodRow();
    });
  } catch (e) {
    paymentMethodsBox.innerHTML = `<p class="muted">دریافت روش‌های پرداخت با خطا مواجه شد.</p>`;
  }

  // ---- 2.6) کد تخفیف ----
  const couponMsgEl = document.getElementById("couponMsg");
  const couponInput = document.getElementById("couponInput");
  const sumCouponRow = document.getElementById("sumCouponRow");
  document.getElementById("applyCouponBtn").addEventListener("click", async () => {
    const code = couponInput.value.trim();
    couponMsgEl.hidden = true;
    if (!code) return;
    try {
      const res = await RomaAPI.coupons.validate(code, itemsTotal);
      couponDiscount = res.discount;
      appliedCouponCode = res.code;
      sumCouponRow.hidden = false;
      document.getElementById("sumCoupon").textContent = `−${money(couponDiscount)} تومان`;
      couponMsgEl.textContent = res.description
        ? `کد تخفیف اعمال شد: ${res.description}`
        : "کد تخفیف با موفقیت اعمال شد.";
      couponMsgEl.className = "form-msg ok";
      couponMsgEl.hidden = false;
      couponInput.disabled = true;
      document.getElementById("applyCouponBtn").disabled = true;
      updateTotal();
    } catch (err) {
      couponDiscount = 0;
      appliedCouponCode = "";
      sumCouponRow.hidden = true;
      couponMsgEl.textContent = err.message || "کد تخفیف نامعتبره.";
      couponMsgEl.className = "form-msg err";
      couponMsgEl.hidden = false;
      updateTotal();
    }
  });

  // ---- 3) آدرس‌های ذخیره‌شده ----
  try {
    const res = await RomaAPI.users.addresses.list();
    const addresses = res.addresses || [];
    if (addresses.length) {
      const wrap = document.getElementById("savedAddresses");
      const select = document.getElementById("addressSelect");
      addresses.forEach((a) => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = `${a.title} — ${a.city}، ${a.address.slice(0, 30)}${a.address.length > 30 ? "…" : ""}`;
        select.appendChild(opt);
      });
      wrap.hidden = false;
      select.addEventListener("change", () => {
        const a = addresses.find((x) => x.id === select.value);
        if (!a) return;
        document.getElementById("province").value = a.province;
        document.getElementById("city").value = a.city;
        document.getElementById("address").value = a.address;
        document.getElementById("postalCode").value = a.postalCode;
        document.getElementById("phone").value = a.receiverPhone;
      });
    }
  } catch (e) {
    // نبود آدرس ذخیره‌شده مشکلی نیست، فرم دستی هم کار می‌کنه
  }

  // پیش‌فرض: اسم کاربر رو اگه قبلاً ذخیره شده پر کن
  try {
    const prof = await RomaAPI.users.profile();
    if (prof?.user?.name) document.getElementById("fullName").value = prof.user.name;
  } catch (e) {}

  form.hidden = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    const submitBtn = document.getElementById("submitOrderBtn");
    const payload = {
      fullName: document.getElementById("fullName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      province: document.getElementById("province").value.trim(),
      city: document.getElementById("city").value.trim(),
      address: document.getElementById("address").value.trim(),
      postalCode: document.getElementById("postalCode").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      shippingMethod: selectedMethod,
      paymentMethod: selectedPaymentMethod,
      couponCode: appliedCouponCode || undefined,
    };
    submitBtn.disabled = true;
    submitBtn.textContent = "در حال ثبت سفارش...";
    try {
      const res = await RomaAPI.orders.create(payload);
      if (selectedPaymentMethod === "cod") {
        // پرداخت در محل نیازی به درگاه نداره - سفارش همین الان تایید شده
        location.href = `./payment-result.html?code=${encodeURIComponent(res.order.code)}`;
      } else {
        const payRes = await RomaAPI.payment.create(res.order.id);
        location.href = payRes.redirectUrl;
      }
    } catch (err) {
      showError(err.message || "ثبت سفارش با خطا مواجه شد.");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-credit-card-2-front"></i> ثبت سفارش و پرداخت';
    }
  });
});
