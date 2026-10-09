// Color picker for the orb and the dropped-in items.
// Everything applies instantly — tap a swatch and you see it, no "apply" step.
//   solid:    a row of plain colors (ROYGBP + black + white) and a custom one
//   gradient: a few ready-made blends, or pick your own two colors

export const SOLIDS = [
  { name: "red", hex: "#e53935" },
  { name: "orange", hex: "#fb8c00" },
  { name: "yellow", hex: "#fdd835" },
  { name: "green", hex: "#43a047" },
  { name: "blue", hex: "#1e63e9" },
  { name: "purple", hex: "#8e24aa" },
  { name: "black", hex: "#16161c" },
  { name: "white", hex: "#f7f7f7" },
];

const GRADIENTS = [
  { name: "sunset", colors: ["ff5f6d", "ffc371"] },
  { name: "ocean", colors: ["2193b0", "6dd5ed"] },
  { name: "aurora", colors: ["1b2a4a", "7f77dd", "1bc17a"] },
  { name: "candy", colors: ["f7797d", "c471ed", "12c2e9"] },
  { name: "ember", colors: ["f12711", "f5af19"] },
  { name: "galaxy", colors: ["0f0c29", "302b63", "b06ab3"] },
];

const toStops = (colors) =>
  colors.map((color, i) => ({ stop: colors.length === 1 ? 0 : i / (colors.length - 1), color }));

const css = (colors) =>
  `linear-gradient(135deg, ${colors.map((c) => `#${c}`).join(", ")})`;

/**
 * onChange(value): value is "#rrggbb" for a solid color, or an array of
 * { stop, color } for a gradient.
 */
export function setupColorPicker(onChange) {
  const modal = document.createElement("div");
  modal.className = "orb-modal orb-modal_hidden orb-color";
  modal.innerHTML = `
    <div class="orb-modal__box orb-color__box" role="dialog" aria-modal="true" aria-label="Color">
      <button class="orb-modal__close" aria-label="Close">&times;</button>
      <h2 class="orb-color__title" data-title>color</h2>

      <div class="orb-color__tabs" role="tablist">
        <button class="orb-color__tab is-active" data-tab="solid" role="tab">solid</button>
        <button class="orb-color__tab" data-tab="gradient" role="tab">gradient</button>
      </div>

      <div class="orb-color__panel" data-panel="solid">
        <div class="orb-color__swatches">
          ${SOLIDS.map(
            (s) => `<button class="orb-color__swatch" style="--c:${s.hex}" data-solid="${s.hex}"
                      title="${s.name}" aria-label="${s.name}"></button>`,
          ).join("")}
          <label class="orb-color__swatch orb-color__swatch_custom" title="custom" aria-label="custom color">
            <input type="color" data-custom value="#4158d0" />
          </label>
        </div>
      </div>

      <div class="orb-color__panel" data-panel="gradient" hidden>
        <div class="orb-color__gradients">
          ${GRADIENTS.map(
            (g, i) => `<button class="orb-color__gradient" style="background:${css(g.colors)}"
                         data-gradient="${i}" title="${g.name}">
                         <span>${g.name}</span></button>`,
          ).join("")}
        </div>
        <div class="orb-color__mix">
          <span>your own</span>
          <input type="color" data-from value="#4158d0" aria-label="gradient start" />
          <div class="orb-color__mix-preview" data-mix-preview></div>
          <input type="color" data-to value="#c850c0" aria-label="gradient end" />
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const title = modal.querySelector("[data-title]");
  const swatches = [...modal.querySelectorAll("[data-solid]")];
  const gradients = [...modal.querySelectorAll("[data-gradient]")];
  const custom = modal.querySelector("[data-custom]");
  const from = modal.querySelector("[data-from]");
  const to = modal.querySelector("[data-to]");
  const mixPreview = modal.querySelector("[data-mix-preview]");

  function markActive(el) {
    [...swatches, ...gradients, custom.parentElement].forEach((s) =>
      s.classList.toggle("is-active", s === el),
    );
  }

  function showTab(name) {
    modal.querySelectorAll("[data-tab]").forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    modal.querySelectorAll("[data-panel]").forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });
  }

  modal.querySelectorAll("[data-tab]").forEach((t) =>
    t.addEventListener("click", () => showTab(t.dataset.tab)),
  );

  swatches.forEach((s) =>
    s.addEventListener("click", () => {
      markActive(s);
      onChange(s.dataset.solid);
    }),
  );

  custom.addEventListener("input", () => {
    custom.parentElement.style.setProperty("--c", custom.value);
    markActive(custom.parentElement);
    onChange(custom.value);
  });

  gradients.forEach((g) =>
    g.addEventListener("click", () => {
      markActive(g);
      onChange(toStops(GRADIENTS[Number(g.dataset.gradient)].colors));
    }),
  );

  function applyMix() {
    const colors = [from.value.slice(1), to.value.slice(1)];
    mixPreview.style.background = css(colors);
    markActive(null);
    onChange(toStops(colors));
  }
  from.addEventListener("input", applyMix);
  to.addEventListener("input", applyMix);
  mixPreview.style.background = css([from.value.slice(1), to.value.slice(1)]);

  const close = () => modal.classList.add("orb-modal_hidden");
  modal.querySelector(".orb-modal__close").addEventListener("click", close);
  modal.addEventListener("pointerdown", (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return {
    /** label: what's being colored, e.g. "orb" or "kitty" */
    open(label = "orb") {
      title.textContent = `${label} color`;
      markActive(null);
      showTab("solid");
      modal.classList.remove("orb-modal_hidden");
    },
    close,
  };
}
