document.addEventListener("DOMContentLoaded", async () => {
  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const params = new URLSearchParams(location.search);
  const authority = params.get("authority");
  const infoBox = document.getElementById("sandboxInfo");
  const actions = document.getElementById("sandboxActions");

  if (!authority) {
    infoBox.innerHTML = `<p class="muted">پرداختی مشخص نشده.</p>`;
    return;
  }

  try {
    const res = await RomaAPI.payment._sandboxState(authority);
    infoBox.innerHTML = `
      <div><span>کد سفارش</span><b>${res.orderCode}</b></div>
      <div><span>مبلغ قابل پرداخت</span><b>${money(res.amount)} تومان</b></div>`;

    if (res.outcome !== null) {
      infoBox.innerHTML += `<div><span>وضعیت</span><b>قبلاً نتیجه ثبت شده</b></div>`;
      return;
    }
    actions.hidden = false;

    async function decide(outcome) {
      actions.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await RomaAPI.payment._sandboxDecide(authority, outcome);
        location.href = RomaAPI.payment._callbackUrl(authority);
      } catch (err) {
        alert(err.message || "خطایی پیش اومد.");
        actions.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    }
    document.getElementById("btnSuccess").addEventListener("click", () => decide("success"));
    document.getElementById("btnFail").addEventListener("click", () => decide("fail"));
  } catch (err) {
    infoBox.innerHTML = `<p class="muted">${err.message || "اطلاعات پرداخت پیدا نشد."}</p>`;
  }
});
