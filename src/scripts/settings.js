// Physics settings (the gears button). Every slider is clamped to a range
// that still feels good, and the choice is remembered on this device.

const STORAGE_KEY = "orb.physics.v1";

export const SLIDERS = [
  {
    key: "gravity",
    label: "gravity",
    min: 0.25,
    max: 2,
    step: 0.05,
    value: 1,
    describe: (v) => (v < 0.55 ? "moon" : v < 0.85 ? "floaty" : v <= 1.2 ? "earth" : v < 1.6 ? "heavy" : "jupiter"),
  },
  {
    key: "weight",
    label: "weight",
    min: 0.5,
    max: 3,
    step: 0.05,
    value: 1,
    describe: (v) => (v < 0.8 ? "feather" : v <= 1.3 ? "normal" : v < 2.2 ? "hefty" : "boulder"),
  },
  {
    key: "speed",
    label: "speed",
    min: 0.5,
    max: 2,
    step: 0.05,
    value: 1,
    describe: (v) => (v < 0.8 ? "chill" : v <= 1.25 ? "normal" : v < 1.7 ? "zippy" : "zoom"),
  },
  {
    key: "bounce",
    label: "bounce",
    min: 0,
    max: 0.9,
    step: 0.05,
    value: 0.7,
    describe: (v) => (v < 0.2 ? "thud" : v < 0.5 ? "soft" : v < 0.8 ? "bouncy" : "super"),
  },
];

const defaults = Object.fromEntries(SLIDERS.map((s) => [s.key, s.value]));

// Live values read by the physics every frame.
export const physics = { ...defaults };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    for (const s of SLIDERS) {
      const v = Number(saved[s.key]);
      if (Number.isFinite(v)) physics[s.key] = Math.min(s.max, Math.max(s.min, v));
    }
  } catch {
    // Private mode / storage blocked: just use defaults.
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(physics));
  } catch {
    /* ignore */
  }
}

load();

/**
 * Build the settings modal.
 * finishes: [{ key, label }], getFinish(): current key, onFinish(key)
 */
export function setupSettingsModal({ finishes, getFinish, onFinish }) {
  const modal = document.createElement("div");
  modal.className = "orb-modal orb-modal_hidden orb-settings";
  modal.innerHTML = `
    <div class="orb-modal__box orb-settings__box" role="dialog" aria-modal="true" aria-label="Physics settings">
      <button class="orb-modal__close" aria-label="Close">&times;</button>
      <h2 class="orb-settings__title">physics</h2>
      <div class="orb-settings__sliders">
        ${SLIDERS.map(
          (s) => `
          <label class="orb-settings__row">
            <span class="orb-settings__label">${s.label}</span>
            <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" data-key="${s.key}" />
            <span class="orb-settings__value" data-out="${s.key}"></span>
          </label>`,
        ).join("")}
      </div>
      <h3 class="orb-settings__subtitle">finish</h3>
      <div class="orb-settings__chips">
        ${finishes
          .map((f) => `<button class="orb-settings__chip" data-finish="${f.key}">${f.label}</button>`)
          .join("")}
      </div>
      <button class="orb-settings__reset">reset to normal</button>
    </div>`;
  document.body.appendChild(modal);

  const box = modal.querySelector(".orb-settings__box");
  const inputs = modal.querySelectorAll("input[type=range]");

  function render() {
    inputs.forEach((input) => {
      const s = SLIDERS.find((x) => x.key === input.dataset.key);
      input.value = physics[s.key];
      // Fill the track up to the thumb.
      const pct = ((physics[s.key] - s.min) / (s.max - s.min)) * 100;
      input.style.setProperty("--fill", `${pct}%`);
      modal.querySelector(`[data-out="${s.key}"]`).textContent = s.describe(physics[s.key]);
    });
    const current = getFinish();
    modal.querySelectorAll("[data-finish]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.finish === current);
    });
  }

  inputs.forEach((input) =>
    input.addEventListener("input", () => {
      physics[input.dataset.key] = Number(input.value);
      save();
      render();
    }),
  );

  modal.querySelectorAll("[data-finish]").forEach((chip) =>
    chip.addEventListener("click", () => {
      onFinish(chip.dataset.finish);
      render();
    }),
  );

  modal.querySelector(".orb-settings__reset").addEventListener("click", () => {
    Object.assign(physics, defaults);
    save();
    render();
  });

  const close = () => modal.classList.add("orb-modal_hidden");
  modal.querySelector(".orb-modal__close").addEventListener("click", close);
  // Click the dimmed backdrop to close.
  modal.addEventListener("pointerdown", (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return {
    open() {
      render();
      modal.classList.remove("orb-modal_hidden");
      box.querySelector("input")?.focus({ preventScroll: true });
    },
    close,
  };
}
