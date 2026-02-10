(() => {
  const els = () => ({
    widget: document.getElementById("maintMusicWidget"),
    panel: document.getElementById("maintMusicPanel"),
    toggle: document.getElementById("maintMusicToggle"),
  });

  const setPinned = (pinned) => {
    const { widget, toggle } = els();
    if (!widget) return;
    widget.classList.toggle("pinned", Boolean(pinned));
    if (toggle) {
      toggle.setAttribute("aria-expanded", pinned ? "true" : "false");
      toggle.innerHTML = pinned ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-music-note-beamed"></i>';
    }
  };

  window.toggleMaintMusic = () => {
    const { widget } = els();
    if (!widget) return;
    setPinned(!widget.classList.contains("pinned"));
  };

  window.closeMaintMusic = () => setPinned(false);

  document.addEventListener("DOMContentLoaded", () => {
    const { widget, toggle } = els();
    if (!widget || !toggle) return;
    toggle.addEventListener("click", () => window.toggleMaintMusic());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.closeMaintMusic();
    });
  });
})();
