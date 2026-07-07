export function setupColorPicker(
  updateColor,
  initialStops = [
    { stop: 0, color: "1b2a4a" },
    { stop: 0.5, color: "7f77dd" },
    { stop: 1, color: "1bc17a" },
  ],
) {
  const modal = document.querySelector(".orb-modal");
  const closeModal = document.querySelector(".orb-modal__close");
  const gradientBar = document.querySelector("[data-gradient-bar]");
  const posSlider = document.querySelector("[data-pos-slider]");
  const posOut = document.querySelector("[data-pos-out]");
  const addBtn = document.querySelector("[data-add-stop]");
  const removeBtn = document.querySelector("[data-remove-stop]");
  const svBox = document.querySelector("[data-satval]");
  const svThumb = document.querySelector("[data-sv-thumb]");
  const hueBox = document.querySelector("[data-hue]");
  const hueThumb = document.querySelector("[data-hue-thumb]");
  const swatch = document.querySelector("[data-swatch]");
  const hexInput = document.querySelector("[data-hex-input]");
  const applyBtn = document.querySelector("[data-apply-gradient]");

  let stops = initialStops.map((s, i) => ({ id: i + 1, ...s }));
  let nextId = stops.length + 1;
  let selectedId = stops[0].id;

  // ---- color math ----
  function hexToRgb(hex) {
    return [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16),
    ];
  }
  function rgbToHex(r, g, b) {
    const h = (x) =>
      Math.round(Math.max(0, Math.min(255, x)))
        .toString(16)
        .padStart(2, "0");
    return (h(r) + h(g) + h(b)).toUpperCase();
  }
  function lerpHex(a, b, t) {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  }
  function hsvToHex(h, s, v) {
    s /= 100;
    v /= 100;
    const k = (n) => (n + h / 60) % 6;
    const f = (n) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
    const t = (x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0");
    return (t(f(5)) + t(f(3)) + t(f(1))).toUpperCase();
  }
  function hexToHsv(hex) {
    let [r, g, b] = hexToRgb(hex).map((x) => x / 255);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return [h, s * 100, max * 100];
  }

  // ---- state helpers ----
  const sortedStops = () => [...stops].sort((a, b) => a.stop - b.stop);
  const selected = () => stops.find((s) => s.id === selectedId);
  const gradientCSS = () =>
    "linear-gradient(to right, " +
    sortedStops()
      .map((s) => `#${s.color} ${s.stop * 100}%`)
      .join(", ") +
    ")";

  // ---- rendering ----
  function renderMarkers() {
    gradientBar
      .querySelectorAll(".orb-gradient__stop")
      .forEach((m) => m.remove());
    stops.forEach((s) => {
      const marker = document.createElement("button");
      marker.className =
        "orb-gradient__stop" +
        (s.id === selectedId ? " orb-gradient__stop_selected" : "");
      marker.style.left = `${s.stop * 100}%`;
      marker.style.background = `#${s.color}`;
      marker.setAttribute(
        "aria-label",
        `Color stop at ${Math.round(s.stop * 100)}%`,
      );
      marker.addEventListener("mousedown", (e) => startDragMarker(e, s.id));
      marker.addEventListener("touchstart", (e) => startDragMarker(e, s.id));
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedId = s.id;
        render();
      });
      gradientBar.appendChild(marker);
    });
  }
  //CORRECT?

  function render() {
    gradientBar.style.background = gradientCSS();
    renderMarkers();

    const sel = selected();
    const [h, s, v] = hexToHsv(sel.color);
    svBox.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h},90%,45%))`;
    svThumb.style.left = `${s}%`;
    svThumb.style.top = `${100 - v}%`;
    hueThumb.style.left = `${(h / 360) * 100}%`;
    hueThumb.style.background = `hsl(${h},90%,45%)`;
    swatch.style.background = `#${sel.color}`;
    hexInput.value = sel.color;
    posSlider.value = Math.round(sel.stop * 100);
    posOut.textContent = `${Math.round(sel.stop * 100)}%`;

    removeBtn.disabled = stops.length <= 2;
  }

  // ---- drag helpers ----
  function dragOnElement(el, onMove) {
    function move(e) {
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      onMove(x, y);
    }
    function down(e) {
      move(e);
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.removeEventListener("touchmove", move);
        document.removeEventListener("touchend", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.addEventListener("touchmove", move);
      document.addEventListener("touchend", up);
    }
    el.addEventListener("mousedown", down);
    el.addEventListener("touchstart", down);
  }

  function startDragMarker(e, id) {
    e.stopPropagation();
    e.preventDefault();
    selectedId = id;
    const rect = gradientBar.getBoundingClientRect();
    function move(ev) {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      stops.find((s) => s.id === id).stop = x;
      render();
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", move);
    document.addEventListener("touchend", up);
  }

  // ---- interactions ----

  applyBtn.addEventListener("click", () => {
    updateColor(sortedStops());
    modal.classList.add("orb-modal_hidden");
  });

  gradientBar.addEventListener("click", (e) => {
    const rect = gradientBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const s = sortedStops();
    let left = s[0],
      right = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (x >= s[i].stop && x <= s[i + 1].stop) {
        left = s[i];
        right = s[i + 1];
        break;
      }
    }
    const range = right.stop - left.stop;
    const t = range === 0 ? 0 : (x - left.stop) / range;
    const newStop = {
      id: nextId++,
      stop: x,
      color: lerpHex(left.color, right.color, t),
    };
    stops.push(newStop);
    selectedId = newStop.id;
    render();
  });

  addBtn.addEventListener("click", () => {
    const s = sortedStops();
    let bestGap = -1,
      bestPos = 0.5,
      bestColor = "ffffff";
    for (let i = 0; i < s.length - 1; i++) {
      const gap = s[i + 1].stop - s[i].stop;
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = (s[i].stop + s[i + 1].stop) / 2;
        bestColor = lerpHex(s[i].color, s[i + 1].color, 0.5);
      }
    }
    const newStop = { id: nextId++, stop: bestPos, color: bestColor };
    stops.push(newStop);
    selectedId = newStop.id;
    render();
  });

  removeBtn.addEventListener("click", () => {
    if (stops.length <= 2) return;
    stops = stops.filter((s) => s.id !== selectedId);
    selectedId = stops[0].id;
    render();
  });

  dragOnElement(svBox, (x, y) => {
    const [h] = hexToHsv(selected().color);
    selected().color = hsvToHex(h, x * 100, (1 - y) * 100);
    render();
  });

  dragOnElement(hueBox, (x) => {
    const [, s, v] = hexToHsv(selected().color);
    selected().color = hsvToHex(x * 360, s, v);
    render();
  });

  posSlider.addEventListener("input", () => {
    selected().stop = posSlider.value / 100;
    render();
  });

  hexInput.addEventListener("change", () => {
    const clean = hexInput.value
      .replace(/[^0-9a-fA-F]/g, "")
      .padEnd(6, "0")
      .slice(0, 6);
    selected().color = clean;
    render();
  });

  closeModal.addEventListener("click", () =>
    modal.classList.add("orb-modal_hidden"),
  );

  render();

  return {
    open: (x, y) => {
      modal.classList.remove("orb-modal_hidden");
      if (x !== undefined && y !== undefined) {
        const box = document.querySelector(".orb-modal__box");
        if (box) {
          box.style.left = `${Math.max(10, Math.min(x - 160, window.innerWidth - 340))}px`;
          box.style.top = `${Math.max(10, y - 150)}px`;
        }
      }
    },
    close: () => modal.classList.add("orb-modal_hidden"),
  };
}
