/* ROMA WATCH — Theme engine, header search, page loader, scroll bar.
   Additive only — mirrors the "safe module" pattern already used in
   ui.js so a failure in one piece never blocks the others.
   NOTE: the initial dark/light class is applied by a tiny inline
   script in <head> (before first paint) to avoid a flash of the
   wrong theme; this file only wires up the interactive behavior. */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, p = document) => p.querySelector(s);

  function safe(name, fn) {
    try { fn(); } catch (e) { console.error(`ROMA theme [${name}]:`, e); }
  }

  /* ============== REAL VIEWPORT HEIGHT (mobile hero fix) ==============
     100vh on mobile browsers is measured against the tallest possible
     viewport (address bar hidden). On first load — before the bar
     collapses — that makes the hero taller than what's actually visible,
     so its centered content appears pushed up toward the top of the
     screen. We measure the real, currently-visible height and expose it
     as --vh; style.css's `calc(var(--vh, 1vh) * 100)` uses it (100dvh in
     modern browsers already handles this, this is the fallback + the
     fix for browsers that report dvh but update it late). */
  safe("realViewportHeight", function realViewportHeight() {
    function setVh() {
      document.documentElement.style.setProperty("--vh", window.innerHeight * 0.01 + "px");
    }
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
  });

  const THEME_KEY = "roma-theme";
  const META_COLOR = { dark: "#06070b", light: "#faf7f0" };

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function setMetaColor(theme) {
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", META_COLOR[theme]);
  }

  /* ============== RESYNC THEME ON BACK/FORWARD (bfcache) NAVIGATION ==============
     When the user toggles the theme on page B then hits the browser Back
     button to page A, the browser often restores page A from bfcache: a
     frozen DOM snapshot taken from BEFORE the toggle. The <head> inline
     script that sets data-theme only runs on a fresh load, not on a
     bfcache restore, so page A silently shows the old theme even though
     localStorage now has the new one. Re-reading localStorage on every
     "pageshow" (which also fires for bfcache restores) fixes this. */
  safe("themeResync", function themeResync() {
    function resync() {
      let saved = "light";
      try { saved = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch (e) {}
      if (currentTheme() !== saved) {
        document.documentElement.setAttribute("data-theme", saved);
        setMetaColor(saved);
      }
    }
    window.addEventListener("pageshow", resync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resync();
    });
  });

  /* ============== THEME TOGGLE (with circular wipe ripple) ============== */
  safe("themeToggle", function themeToggle() {
    const btn = $("#themeToggle");
    if (!btn) return;

    setMetaColor(currentTheme());

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    btn.addEventListener("click", () => {
      const root = document.documentElement;
      const next = currentTheme() === "light" ? "dark" : "light";

      if (prefersReducedMotion) {
        root.setAttribute("data-theme", next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        setMetaColor(next);
        return;
      }

      // snapshot the outgoing background so the ripple can "peel away" from it
      const prevBg = getComputedStyle(document.body).backgroundColor;

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // swap the theme instantly underneath the ripple overlay
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      setMetaColor(next);

      const overlay = document.createElement("div");
      overlay.className = "theme-ripple";
      overlay.style.background = prevBg;
      overlay.style.setProperty("--x", x + "px");
      overlay.style.setProperty("--y", y + "px");
      overlay.style.setProperty("--r", maxRadius + "px");
      document.body.appendChild(overlay);

      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("run")));

      const cleanup = () => overlay.remove();
      overlay.addEventListener("transitionend", cleanup, { once: true });
      setTimeout(cleanup, 950); // safety net if transitionend never fires
    });
  });

  /* ============== EXPANDABLE HEADER SEARCH ============== */
  safe("headerSearch", function headerSearch() {
    const toggle = $("#searchToggle");
    const panel = $("#searchPanel");
    const input = $("#searchInput");
    const closeBtn = $("#searchClose");
    if (!toggle || !panel) return;

    function open() {
      panel.classList.add("open");
      toggle.classList.add("active");
      toggle.setAttribute("aria-expanded", "true");
      setTimeout(() => input?.focus(), 200);
    }
    function close() {
      panel.classList.remove("open");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
    }
    function isOpen() { return panel.classList.contains("open"); }

    toggle.addEventListener("click", () => (isOpen() ? close() : open()));
    closeBtn?.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) close();
    });
    document.addEventListener("click", (e) => {
      if (!isOpen()) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      close();
    });
  });

  /* ============== PAGE NAVIGATION LOADER (rotating hourglass) ============== */
  safe("pageLoader", function pageLoader() {
    const loader = $("#pageLoader");
    if (!loader) return;

    function hide() { loader.classList.remove("active"); }
    function show() { loader.classList.add("active"); }

    // hide defensively on every arrival, including bfcache back/forward restores
    window.addEventListener("pageshow", hide);
    document.addEventListener("DOMContentLoaded", hide);

    // beforeunload fires for real page-to-page navigation (link clicks,
    // redirects, typed URLs, refresh) but NOT for same-page AJAX calls,
    // so it never gets stuck showing during the OTP login flow etc.
    window.addEventListener("beforeunload", () => {
      show();
      setTimeout(hide, 8000); // safety net if navigation is somehow cancelled
    });
  });

  /* ============== NAV DIGITAL CLOCK (mobile/tablet menu header) ============== */
  safe("navClock", function navClock() {
    const el = $("#navClock");
    if (!el) return;
    const faDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    const toFa = (s) => s.replace(/[0-9]/g, (d) => faDigits[d]);
    function tick() {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      el.textContent = toFa(`${hh}:${mm}:${ss}`);
    }
    tick();
    setInterval(tick, 1000);
  });

  /* ============== SCROLL PROGRESS BAR (top edge, left → right) ============== */
  safe("scrollProgress", function scrollProgress() {
    const bar = $("#scrollProgress");
    if (!bar) return;

    function update() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollable = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
      const pct = scrollable > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollable) * 100)) : 0;
      bar.style.width = pct + "%";
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  });
});
