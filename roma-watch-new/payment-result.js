document.addEventListener("DOMContentLoaded", async () => {
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const card = document.getElementById("resultCard");
  const params = new URLSearchParams(location.search);
  const code = params.get("code");

  if (!code) {
    card.innerHTML = `
      <i class="bi bi-question-circle payment-result-icon fail"></i>
      <h2>سفارشی مشخص نشده</h2>
      <p>کد سفارشی برای نمایش پیدا نشد.</p>
      <div class="payment-result-actions">
        <a class="btn-brass" href="./tracking.html">رهگیری سفارش</a>
      </div>`;
    return;
  }

  try {
    const res = await RomaAPI.orders.track(code);
    const o = res.order;

    const isCod = o.paymentMethod === "cod";
    const STATUS_MAP = {
      paid: { icon: "bi-check-circle-fill", cls: "ok", title: "پرداخت موفق" },
      processing: isCod
        ? { icon: "bi-check-circle-fill", cls: "ok", title: "سفارش تایید شد" }
        : { icon: "bi-check-circle-fill", cls: "ok", title: "پرداخت موفق" },
      shipped: { icon: "bi-check-circle-fill", cls: "ok", title: "پرداخت موفق" },
      delivered: { icon: "bi-check-circle-fill", cls: "ok", title: "پرداخت موفق" },
      payment_failed: { icon: "bi-x-circle-fill", cls: "fail", title: "پرداخت ناموفق" },
      cancelled: { icon: "bi-x-circle-fill", cls: "fail", title: "سفارش لغو شد" },
      pending_payment: { icon: "bi-hourglass-split", cls: "pending", title: "سفارش ثبت شد" },
    };
    const s = STATUS_MAP[o.status] || STATUS_MAP.pending_payment;
    let pendingNote = "";
    if (o.status === "pending_payment") {
      pendingNote = `<p style="margin-top:10px">درگاه پرداخت به‌زودی وصل میشه؛ سفارش شما ثبت شده و به محض تکمیل پرداخت پیگیری خواهد شد.</p>`;
    } else if (o.status === "processing" && isCod) {
      pendingNote = `<p style="margin-top:10px">مبلغ سفارش هنگام تحویل توسط پیک دریافت میشه. لطفاً مبلغ رو آماده داشته باشید.</p>`;
    }

    card.innerHTML = `
      <i class="bi ${s.icon} payment-result-icon ${s.cls}"></i>
      <h2>${s.title}</h2>
      ${pendingNote}
      <div class="payment-result-meta">
        <div><span>کد سفارش</span><b>${o.code}</b></div>
        <div><span>تعداد کالا</span><b>${o.itemsCount.toLocaleString("fa-IR")}</b></div>
        <div><span>مبلغ</span><b>${money(o.total)} تومان</b></div>
      </div>
      <div class="payment-result-actions">
        <a class="btn-brass" href="./account.html">مشاهده سفارش‌های من</a>
        <a class="btn-outline" href="./products.htm">ادامه خرید</a>
      </div>`;
  } catch (err) {
    card.innerHTML = `
      <i class="bi bi-x-circle-fill payment-result-icon fail"></i>
      <h2>سفارش پیدا نشد</h2>
      <p>${err.message || "کد سفارش نامعتبره."}</p>
      <div class="payment-result-actions">
        <a class="btn-brass" href="./tracking.html">رهگیری با کد دیگر</a>
      </div>`;
  }
});
