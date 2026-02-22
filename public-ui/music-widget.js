(() => {
  const els = () => ({
    widget: document.getElementById("maintMusicWidget"),
    panel: document.getElementById("maintMusicPanel"),
    toggle: document.getElementById("maintMusicToggle"),
  });

  const setOpen = (open) => {
    const { widget, toggle } = els();
    if (!widget) return;
    widget.classList.toggle("open", Boolean(open));
    const panel = document.getElementById("maintMusicPanel");
    if (panel) panel.hidden = !Boolean(open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Tutup music" : "Buka music");
      toggle.innerHTML = open ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-music-note-beamed"></i>';
    }
  };

  window.toggleMaintMusic = () => {
    const { widget } = els();
    if (!widget) return;
    setOpen(!widget.classList.contains("open"));
  };

  window.closeMaintMusic = () => setOpen(false);

  document.addEventListener("DOMContentLoaded", () => {
    const { widget, toggle } = els();
    if (!widget || !toggle) return;
    if (!toggle.getAttribute("onclick")) toggle.addEventListener("click", () => window.toggleMaintMusic());
    window.closeMaintMusic();
    document.addEventListener("click", (e) => {
      const w = els().widget;
      if (!w) return;
      if (!w.classList.contains("open")) return;
      const target = e.target;
      if (target && w.contains(target)) return;
      window.closeMaintMusic();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.closeMaintMusic();
    });
    try {
      if (window.__pendingMaintMusic === true) {
        window.__pendingMaintMusic = null;
        window.toggleMaintMusic();
      } else if (window.__pendingMaintMusic === false) {
        window.__pendingMaintMusic = null;
        window.closeMaintMusic();
      }
    } catch {}
  });
})();
