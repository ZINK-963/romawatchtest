/* ROMA WATCH — UI layer: hero slider, mobile nav, scroll reveals.
   Pure additive — does not touch cart/favorites/login/product logic
   which already lives in script.js / api.js / cart.js / login.js. */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  /* Each module runs in isolation: a failure or missing element in one
     (e.g. no hero on this page) must never block the others — that
     previously left mobile nav / reveal broken sitewide. */
  function safe(name, fn) {
    try { fn(); } catch (e) { console.error(`ROMA UI [${name}]:`, e); }
  }

  /* ============== HERO SLIDER ============== */
  safe("hero", function hero() {
    const slides = $$(".hero-slide");
    if (!slides.length) return;
    const dotsBox = $("#heroDots");
    const progress = $("#heroProgress");
    const prevBtn = $("#heroPrev");
    const nextBtn = $("#heroNext");
    let current = 0;
    let timer = null;
    const DURATION = 6000;

    slides.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "hero-dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", `اسلاید ${i + 1}`);
      dot.addEventListener("click", () => go(i));
      dotsBox.appendChild(dot);
    });
    const dots = $$(".hero-dot", dotsBox);

    function go(index) {
      slides[current].classList.remove("active");
      dots[current]?.classList.remove("active");
      current = (index + slides.length) % slides.length;
      slides[current].classList.add("active");
      dots[current]?.classList.add("active");
      restartProgress();
    }
    function next() { go(current + 1); }
    function prev() { go(current - 1); }

    function restartProgress() {
      if (!progress) return;
      progress.classList.remove("run");
      // force reflow so the width transition restarts cleanly
      void progress.offsetWidth;
      progress.style.width = "0%";
      requestAnimationFrame(() => progress.classList.add("run"));
      clearTimeout(timer);
      timer = setTimeout(next, DURATION);
    }

    prevBtn?.addEventListener("click", () => { prev(); });
    nextBtn?.addEventListener("click", () => { next(); });

    // pause autoplay on hover/focus, resume on leave
    const heroEl = $("#hero");
    heroEl?.addEventListener("mouseenter", () => { clearTimeout(timer); progress?.classList.remove("run"); });
    heroEl?.addEventListener("mouseleave", () => restartProgress());

    // basic swipe support
    let touchX = null;
    heroEl?.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    heroEl?.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) (dx > 0 ? prev() : next());
      touchX = null;
    }, { passive: true });

    restartProgress();
  });

  /* ============== MOBILE NAV DRAWER ============== */
  safe("mobileNav", function mobileNav() {
    const toggle = $("#navToggle");
    const nav = $("#siteNav");
    const scrim = $("#navScrim");
    if (!toggle || !nav) return;

    function close() {
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("open");
      scrim?.classList.remove("open");
      document.body.style.overflow = "";
    }
    function open() {
      toggle.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      nav.classList.add("open");
      scrim?.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    toggle.addEventListener("click", () => {
      nav.classList.contains("open") ? close() : open();
    });
    scrim?.addEventListener("click", close);

    // on mobile, dropdown/mega links inside the nav act as accordions
    // instead of hover flyouts — tapping the parent link toggles it.
    $$(".dropdown-parent > .nav-item", nav).forEach((link) => {
      link.addEventListener("click", (e) => {
        if (window.innerWidth > 960) return;
        e.preventDefault();
        const parent = link.parentElement;
        const wasOpen = parent.classList.contains("mobile-open");
        $$(".dropdown-parent", nav).forEach((p) => p.classList.remove("mobile-open"));
        if (!wasOpen) parent.classList.add("mobile-open");
      });
    });

    // close the drawer after a normal nav link is tapped
    $$(".nav-item", nav).forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 960 && !link.parentElement.classList.contains("dropdown-parent")) close();
      });
    });
    $$(".dropdown a, .mega-dropdown a", nav).forEach((link) => link.addEventListener("click", close));

    window.addEventListener("resize", () => { if (window.innerWidth > 960) close(); });
  });

  /* ============== ACTIVE NAV ITEM ============== */
  safe("activeNav", function activeNav() {
    const nav = $("#siteNav");
    if (!nav) return;
    const currentPath = location.pathname.split("/").pop() || "index.html";
    const currentSearch = location.search || "";
    $$(".nav-item", nav).forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url;
      try {
        url = new URL(href, location.href);
      } catch (e) {
        return;
      }
      const linkFile = url.pathname.split("/").pop() || "index.html";
      const linkSearch = url.search || "";
      // مسیر فایل باید یکی باشه و کوئری‌استرینگ (مثلاً gender=مردانه) هم دقیقاً برابر باشه
      // تا فقط همون آیتم نویگیشنی که واقعاً بهش رفتیم فعال بشه، نه همه‌ی لینک‌های هم‌فایل
      if (linkFile === currentPath && linkSearch === currentSearch) {
        link.classList.add("active");
      }
    });
  });

  /* ============== SCROLL REVEAL ============== */
  safe("reveal", function reveal() {
    const targets = $$("[data-reveal]");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) return; // never hide content we can't guarantee we'll reveal
    targets.forEach((t) => { t.style.opacity = "0"; t.style.transform = "translateY(28px)"; t.style.transition = "opacity .8s cubic-bezier(.22,.9,.3,1), transform .8s cubic-bezier(.22,.9,.3,1)"; });
    const show = (t) => { t.style.opacity = "1"; t.style.transform = "translateY(0)"; };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    targets.forEach((t) => io.observe(t));
    // safety net: if anything is somehow never triggered, force it visible
    setTimeout(() => targets.forEach(show), 3000);
  });

  /* ============== PRODUCT CARD TILT (subtle, desktop only) ============== */
  safe("tilt", function tilt() {
    if (window.matchMedia("(hover: none)").matches) return;
    document.addEventListener("mousemove", (e) => {
      const card = e.target.closest(".product-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
      card.style.transform = `translateY(-10px) perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    document.addEventListener("mouseout", (e) => {
      const card = e.target.closest(".product-card");
      if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
    });
  });
});
