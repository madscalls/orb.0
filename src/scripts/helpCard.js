import { KEY_LIST } from "./props/registry.js";
import { isMuted, setMuted } from "./sound.js";

// "?" button: the list of keys (and a sound switch).
export function setupHelpCard() {
  const modal = document.createElement("div");
  modal.className = "orb-modal orb-modal_hidden orb-help";
  modal.innerHTML = `
    <div class="orb-modal__box orb-help__box" role="dialog" aria-modal="true" aria-label="Keys">
      <button class="orb-modal__close" aria-label="Close">&times;</button>
      <h2 class="orb-help__title">keys</h2>
      <p class="orb-help__line"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> drive · <kbd>space</kbd> jump · right-click for menu</p>
      <h3 class="orb-help__subtitle">drop stuff in</h3>
      <ul class="orb-help__grid">
        ${KEY_LIST.map((i) => `<li><kbd>${i.key}</kbd><span>${i.label}</span></li>`).join("")}
      </ul>
      <p class="orb-help__line">drag anything · right-click an item to recolor it · trash can clears</p>
      <label class="orb-help__sound"><input type="checkbox" data-sound /> sound effects</label>
    </div>`;
  document.body.appendChild(modal);

  const sound = modal.querySelector("[data-sound]");
  sound.checked = !isMuted();
  sound.addEventListener("change", () => setMuted(!sound.checked));

  const close = () => modal.classList.add("orb-modal_hidden");
  const open = () => modal.classList.remove("orb-modal_hidden");
  modal.querySelector(".orb-modal__close").addEventListener("click", close);
  modal.addEventListener("pointerdown", (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "?" && !e.target?.closest?.("input, textarea")) {
      modal.classList.contains("orb-modal_hidden") ? open() : close();
    }
  });
  document.querySelector("[data-help]")?.addEventListener("click", (e) => {
    open();
    e.currentTarget.blur();
  });
}
