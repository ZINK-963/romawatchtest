document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResultsList");
  if (!input || !resultsBox) return;

  const money = (n) => Number(n || 0).toLocaleString("fa-IR");
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

  let products = [];
  let loaded = false;

  async function ensureLoaded() {
    if (loaded) return;
    try {
      for (const url of ["./products.json", "./data/products.json"]) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length) {
              products = data;
              break;
            }
          }
        } catch (e) {}
      }
    } finally {
      if (!products.length && Array.isArray(window.ROMA_PRODUCTS)) {
        products = window.ROMA_PRODUCTS;
      }
      loaded = true;
    }
  }

  function finalPrice(p) {
    return Math.max(0, Math.round(Number(p.price || 0) - Number(p.discount || 0)));
  }

  function search(query) {
    const q = query.trim();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return products
      .filter((p) => {
        const haystack = `${p.brand || ""} ${p.name || ""}`;
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, 8);
  }

  function render(query) {
    const q = query.trim();
    if (!q) {
      resultsBox.innerHTML = "";
      resultsBox.classList.remove("has-content");
      return;
    }
    const matches = search(q);
    if (!matches.length) {
      resultsBox.innerHTML = `<div class="search-results-empty">چیزی با این عنوان پیدا نشد.</div>`;
      resultsBox.classList.add("has-content");
      return;
    }
    resultsBox.innerHTML = matches
      .map(
        (p, i) => `
      <a class="search-result-item${i === 0 ? " active" : ""}" href="./product.html?id=${encodeURIComponent(p.id)}" data-idx="${i}">
        <img src="${esc((p.images && p.images[0]) || p.image || "./images/placeholder-watch.svg")}" alt="">
        <span class="sr-name">
          <span class="sr-brand">${esc(p.brand || "")}</span>
          <span class="sr-title">${esc(p.name || "")}</span>
        </span>
        <span class="sr-price">${money(finalPrice(p))} تومان</span>
      </a>`
      )
      .join("");
    resultsBox.classList.add("has-content");
  }

  let debounceTimer;
  input.addEventListener("input", async () => {
    clearTimeout(debounceTimer);
    const q = input.value;
    debounceTimer = setTimeout(async () => {
      await ensureLoaded();
      render(q);
    }, 150);
  });

  // اینتر روی اولین نتیجه بره همون محصول
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = resultsBox.querySelector(".search-result-item");
    if (first) {
      e.preventDefault();
      window.location.href = first.getAttribute("href");
    }
  });

  // با بسته شدن پنل سرچ (توسط theme.js)، نتایج هم پاک بشن
  document.getElementById("searchClose")?.addEventListener("click", () => {
    input.value = "";
    render("");
  });
  document.getElementById("searchToggle")?.addEventListener("click", () => {
    input.value = "";
    render("");
  });
});
