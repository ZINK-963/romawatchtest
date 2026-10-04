/* ROMA WATCH — products page: mobile filter drawer.
   Additive only; does not touch the existing filter/sort logic in script.js. */
document.addEventListener("DOMContentLoaded", () => {
  try {
    const toggle = document.getElementById("filterToggle");
    const closeBtn = document.getElementById("filterClose");
    const sidebar = document.getElementById("filterSidebar");
    const scrim = document.getElementById("filterScrim");
    if (!toggle || !sidebar) return;

    function open() {
      sidebar.classList.add("open");
      scrim?.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      sidebar.classList.remove("open");
      scrim?.classList.remove("open");
      document.body.style.overflow = "";
    }
    toggle.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    scrim?.addEventListener("click", close);
    window.addEventListener("resize", () => { if (window.innerWidth > 860) close(); });
  } catch (e) {
    console.error("ROMA products-ui:", e);
  }
});
