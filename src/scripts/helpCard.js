import { KEY_LIST, KEY_TO_ITEM } from "./props/registry.js";
import { spawn } from "./props/propsController.js";
import { isMuted, setMuted } from "./sound.js";

// "+" button: everything you can drop in. Tap an item to drop it (works on
// phones); on a keyboard each one also has its letter.
export function setupHelpCard() {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const modal = document.createElement("div");
  modal.className = "orb-modal orb-modal_hidden orb-help";
  modal.innerHTML = `
    <div class="orb-modal__box orb-help__box" role="dialog" aria-modal="true" aria-label="Add stuff">
      <button class="orb-modal__close" aria-label="Close">&times;</button>
      <h2 class="orb-help__title">add stuff</h2>
      <p class="orb-help__line">tap one to drop it in${touch ? "" : " — or press its letter any time"}</p>
      <div class="orb-help__grid">
        ${KEY_LIST.map(
          (i) => `<button class="orb-help__item" data-spawn="${KEY_TO_ITEM[`Key${i.key}`]}">
                    <kbd>${i.key}</kbd><span>${i.label}</span>
                  </button>`,
        ).join("")}
      </div>
      <p class="orb-help__line">
        ${
          touch
            ? "drag anything · hold a finger on the orb for its menu · hold an item to recolor it · trash can clears"
            : "<kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> drive · <kbd>space</kbd> jump · drag anything · right-click the orb for its menu, or an item to recolor it · trash can clears"
        }
      </p>
      <label class="orb-help__sound"><input type="checkbox" data-sound /> sound effects</label>
    </div>`;
  document.body.appendChild(modal);
  if (touch) modal.classList.add("orb-help_touch");

  const sound = modal.querySelector("[data-sound]");
  sound.checked = !isMuted();
  sound.addEventListener("change", () => setMuted(!sound.checked));

  const close = () => modal.classList.add("orb-modal_hidden");
  const open = () => modal.classList.remove("orb-modal_hidden");

  modal.querySelectorAll("[data-spawn]").forEach((button) =>
    button.addEventListener("click", () => {
      close(); // get out of the way so you can watch it land
      spawn(button.dataset.spawn);
    }),
  );

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
