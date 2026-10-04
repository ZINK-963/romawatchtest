/* ROMA WATCH - لایه ارتباط با بک‌اند
   این فایل باید قبل از script.js / cart.js / login.js لود بشه. */
const RomaAPI = (() => {
  // آدرس بک‌اند: برای دیپلوی روی سرور واقعی، قبل از این فایل یه اسکریپت کوچیک
  // بذار: <script>window.ROMA_API_BASE = "https://api.yourdomain.com/api";</script>
  // اگه تنظیم نشده باشه، رو هاست‌های واقعی از هم‌دامنه‌ی خودِ سایت (/api) استفاده می‌کنه
  // و فقط وقتی از localhost سرو میشه (توسعه‌ی لوکال) به پورت ۴۰۰۰ بک‌اند فال‌بک می‌کنه.
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const BASE_URL =
    window.ROMA_API_BASE || (isLocalHost ? "http://localhost:4000/api" : `${window.location.origin}/api`);

  const TOKEN_KEY = "roma_token";
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);
  const isLoggedIn = () => !!getToken();

  async function request(path, options = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* بدنه خالی یا غیر JSON */
    }
    if (!res.ok) {
      throw new Error(body?.error || `خطا در ارتباط با سرور (${res.status})`);
    }
    return body;
  }

  return {
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    auth: {
      sendOtp: (phone) => request("/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }),
      verifyOtp: (phone, code) =>
        request("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, code }) }),
      me: () => request("/auth/me"),
      logout: async () => {
        try {
          await request("/auth/logout", { method: "POST" });
        } catch (e) {
          // حتی اگه درخواست به سرور شکست بخوره، توکن محلی باید پاک بشه
        } finally {
          clearToken();
        }
      },
    },
    products: {
      list: (query = "") => request(`/products${query}`),
      get: (id) => request(`/products/${id}`),
    },
    cart: {
      get: () => request("/cart"),
      add: (productId, qty = 1) =>
        request("/cart", { method: "POST", body: JSON.stringify({ productId, qty }) }),
      update: (productId, qty) =>
        request(`/cart/${productId}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
      remove: (productId) => request(`/cart/${productId}`, { method: "DELETE" }),
      clear: () => request("/cart", { method: "DELETE" }),
    },
    favorites: {
      get: () => request("/favorites"),
      toggle: (productId) => request(`/favorites/${productId}`, { method: "POST" }),
    },
    orders: {
      create: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
      mine: () => request("/orders"),
      get: (id) => request(`/orders/${encodeURIComponent(id)}`),
      cancel: (id) => request(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
      track: (code) => request(`/orders/track/${encodeURIComponent(code)}`),
      shippingMethods: () => request("/orders/shipping-methods"),
      paymentMethods: () => request("/orders/payment-methods"),
    },
    users: {
      profile: () => request("/users/me"),
      updateProfile: (data) => request("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
      addresses: {
        list: () => request("/users/me/addresses"),
        add: (data) => request("/users/me/addresses", { method: "POST", body: JSON.stringify(data) }),
        update: (id, data) =>
          request(`/users/me/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
        remove: (id) => request(`/users/me/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }),
      },
    },
    payment: {
      create: (orderId) => request("/payment/create", { method: "POST", body: JSON.stringify({ orderId }) }),
      verify: (orderId) => request("/payment/verify", { method: "POST", body: JSON.stringify({ orderId }) }),
      // فقط برای تست بدون درگاه واقعی - وقتی درگاه واقعی وصل شد حذف بشه
      _sandboxState: (authority) => request(`/payment/sandbox/${encodeURIComponent(authority)}`),
      _sandboxDecide: (authority, outcome) =>
        request(`/payment/sandbox/${encodeURIComponent(authority)}/decide`, {
          method: "POST",
          body: JSON.stringify({ outcome }),
        }),
      _callbackUrl: (authority) => `${BASE_URL}/payment/callback?authority=${encodeURIComponent(authority)}`,
    },
    admin: {
      stats: () => request("/admin/stats"),
      orders: (status) => request(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`),
      order: (id) => request(`/admin/orders/${encodeURIComponent(id)}`),
      updateStatus: (id, status) =>
        request(`/admin/orders/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      products: {
        list: () => request("/admin/products"),
        create: (data) => request("/admin/products", { method: "POST", body: JSON.stringify(data) }),
        update: (id, data) =>
          request(`/admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
        remove: (id) => request(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
        uploadImage: (id, dataUrl) =>
          request(`/admin/products/${encodeURIComponent(id)}/images`, {
            method: "POST",
            body: JSON.stringify({ dataUrl }),
          }),
        deleteImage: (id, index) =>
          request(`/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(index)}`, {
            method: "DELETE",
          }),
      },
      coupons: {
        list: () => request("/admin/coupons"),
        create: (data) => request("/admin/coupons", { method: "POST", body: JSON.stringify(data) }),
        update: (id, data) =>
          request(`/admin/coupons/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
        remove: (id) => request(`/admin/coupons/${encodeURIComponent(id)}`, { method: "DELETE" }),
      },
    },
    coupons: {
      validate: (code, itemsTotal) =>
        request("/coupons/validate", { method: "POST", body: JSON.stringify({ code, itemsTotal }) }),
    },
  };
})();
