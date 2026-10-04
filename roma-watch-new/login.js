document.addEventListener("DOMContentLoaded", () => {
  const phoneStep = document.getElementById("phoneStep");
  const codeStep = document.getElementById("codeStep");
  const nameStep = document.getElementById("nameStep");
  const phoneInput = document.getElementById("phone-number");
  const codeInput = document.getElementById("otp-code");
  const nameInput = document.getElementById("user-name");
  const phoneDisplay = document.getElementById("phoneDisplay");
  const errorBox = document.getElementById("loginError");
  const sendBtn = document.getElementById("sendCodeBtn");
  const verifyBtn = document.getElementById("verifyBtn");
  const backBtn = document.getElementById("backBtn");

  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") && params.get("returnTo").startsWith("./") ? params.get("returnTo") : "./index.html";

  // اگه از قبل لاگین کرده، مستقیم بره مقصد قبلی (یا صفحه اصلی)
  if (RomaAPI.isLoggedIn()) {
    location.href = returnTo;
    return;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function hideError() {
    errorBox.hidden = true;
  }
  function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.textContent = loading ? "در حال ارسال..." : label;
  }

  let currentPhone = "";

  phoneStep.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    const phone = phoneInput.value.trim();
    if (!/^09\d{9}$/.test(phone)) {
      showError("شماره تلفن معتبر نیست. مثال: 09123456789");
      return;
    }
    setLoading(sendBtn, true, "دریافت کد");
    try {
      const res = await RomaAPI.auth.sendOtp(phone);
      currentPhone = phone;
      phoneDisplay.textContent = phone;
      phoneStep.hidden = true;
      codeStep.hidden = false;
      codeInput.value = "";
      codeInput.focus();
      // فقط در حالت توسعه بک‌اند، کد رو برای تست برمی‌گردونه
      if (res?.devCode) {
        console.log("کد تست (فقط حالت توسعه):", res.devCode);
      }
    } catch (err) {
      showError(err.message || "ارسال کد با خطا مواجه شد.");
    } finally {
      setLoading(sendBtn, false, "دریافت کد");
    }
  });

  codeStep.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    const code = codeInput.value.trim();
    if (!code) {
      showError("کد تایید را وارد کنید.");
      return;
    }
    setLoading(verifyBtn, true, "ورود");
    try {
      const res = await RomaAPI.auth.verifyOtp(currentPhone, code);
      RomaAPI.setToken(res.token);

      let savedName = "";
      try { savedName = localStorage.getItem("roma_user_name") || ""; } catch (e) {}

      if (!savedName) {
        // اولین ورود روی این دستگاه: قبل از رفتن به صفحه اصلی، اسم رو بگیر
        codeStep.hidden = true;
        nameStep.hidden = false;
        nameInput.focus();
        return;
      }
      location.href = returnTo;
    } catch (err) {
      showError(err.message || "کد وارد شده نامعتبر است.");
    } finally {
      setLoading(verifyBtn, false, "ورود");
    }
  });

  nameStep.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    const name = nameInput.value.trim();
    if (!name) {
      showError("لطفاً نام خود را وارد کنید.");
      return;
    }
    try { localStorage.setItem("roma_user_name", name); } catch (e) {}
    try { await RomaAPI.users.updateProfile({ name }); } catch (e) { console.error("ROMA profile save:", e); }
    location.href = returnTo;
  });

  backBtn.addEventListener("click", () => {
    hideError();
    codeStep.hidden = true;
    phoneStep.hidden = false;
  });
});
