import { createKitty } from "./kitty.js";
import { createLamp } from "./lamp.js";
import { createYoyo } from "./yoyo.js";
import { createOctopus } from "./octopus.js";
import { createBanana } from "./items/banana.js";
import { createCactus } from "./items/cactus.js";
import { createEgg, createShells } from "./items/egg.js";
import { createChick } from "./items/chick.js";
import { createFrog } from "./items/frog.js";
import { createGhost } from "./items/ghost.js";
import { createHat } from "./items/hat.js";
import { createIce } from "./items/ice.js";
import { createJellyfish } from "./items/jellyfish.js";
import { createMushroom } from "./items/mushroom.js";
import { createNoodle } from "./items/noodle.js";
import { createPizza } from "./items/pizza.js";
import { createDuck } from "./items/duck.js";
import { createRocket } from "./items/rocket.js";
import { createToaster, createToast } from "./items/toaster.js";
import { createUfo } from "./items/ufo.js";
import { createVase } from "./items/vase.js";
import { createPumpkin } from "./items/pumpkin.js";
import { createCloud } from "./items/cloud.js";

/*
 * Every droppable item. `key` is the keyboard key that drops it (items
 * without one only appear from other items). `palette` = random starting
 * colors; right-click any item to pick your own.
 * To add one: write a create function (see items/), then add a line here.
 */
export const ITEMS = {
  banana: { key: "B", label: "banana peel", create: createBanana, palette: ["#ffe135", "#f6d32d", "#f9e27d"] },
  cactus: { key: "C", label: "cactus", create: createCactus, palette: ["#3f9a5a", "#4caf50", "#2e7d5b"] },
  egg: { key: "E", label: "egg", create: createEgg, palette: ["#f6eedd", "#e8d3b0", "#ffffff", "#bfe3d0"] },
  frog: { key: "F", label: "frog", create: createFrog, palette: ["#4caf50", "#7cc242", "#2e9e6b"] },
  ghost: { key: "G", label: "ghost", create: createGhost, palette: ["#ffffff", "#e8ecff", "#f3e8ff"] },
  hat: { key: "H", label: "top hat", create: createHat, palette: ["#16161c", "#3b2a6b", "#6b1d2a", "#1d2b4a"] },
  ice: { key: "I", label: "ice cube", create: createIce, palette: ["#cdefff", "#b9e6ff", "#e3f6ff"] },
  jellyfish: { key: "J", label: "jellyfish", create: createJellyfish, palette: ["#ff8ad8", "#9b8cff", "#6fe3ff", "#ffb38a"] },
  kitty: { key: "K", label: "kitty", create: createKitty, palette: ["#f4a259", "#f2f2f2", "#3a3a44", "#c8a27a", "#9aa5b1"] },
  lamp: {
    key: "L",
    label: "lamp",
    create: (m, { light }) => createLamp(m, light),
    needsLight: true,
    palette: ["#f6e7c1", "#9ec5d9", "#e8a0bf", "#b8d8a8", "#f2c14e"],
  },
  mushroom: { key: "M", label: "mushroom", create: createMushroom, palette: ["#e53935", "#d84343", "#8e24aa", "#fb8c00"] },
  noodle: { key: "N", label: "pool noodle", create: createNoodle, palette: ["#ff4fa3", "#3ddc97", "#ffd23f", "#4fc3f7", "#ff8a3d"] },
  octopus: { key: "O", label: "octopus", create: createOctopus, palette: ["#e85d75", "#8e24aa", "#fb8c00", "#26a69a", "#ec407a"] },
  pizza: { key: "P", label: "pizza", create: createPizza, palette: ["#ffcf56", "#ffd36b", "#f6c344"] },
  duck: { key: "Q", label: "rubber duck", create: createDuck, palette: ["#ffd60a", "#ffe14d", "#ff9fd0", "#7fd4ff"] },
  rocket: { key: "R", label: "rocket", create: createRocket, palette: ["#e53935", "#1e63e9", "#8e24aa", "#43a047"] },
  toaster: { key: "T", label: "toaster", create: createToaster, palette: ["#e8e8ee", "#ff8fab", "#8ecae6", "#b5e48c"] },
  ufo: { key: "U", label: "UFO", create: createUfo, palette: ["#b8bcc8", "#9aa0ff", "#c9a7ff"] },
  vase: { key: "V", label: "vase", create: createVase, palette: ["#2f6fdb", "#f7f7f7", "#26a69a", "#c2185b"] },
  pumpkin: { key: "X", label: "jack-o'-lantern", create: createPumpkin, palette: ["#ff7518", "#f57c00", "#ff8f1f"] },
  yoyo: { key: "Y", label: "yoyo", create: createYoyo, palette: ["#e4405f", "#4158d0", "#1bc17a", "#f7b32b", "#7f77dd"] },
  cloud: { key: "Z", label: "sleepy cloud", create: createCloud, palette: ["#ffffff", "#e9e6ff", "#dfefff"] },

  // only made by other items
  shells: { label: "egg shells", create: createShells, palette: ["#f6eedd"] },
  chick: { label: "chick", create: createChick, palette: ["#ffd60a", "#ffe14d"] },
  toast: { label: "toast", create: createToast, palette: ["#e8b06a", "#d99a4e"] },
};

export const KEY_TO_ITEM = Object.fromEntries(
  Object.entries(ITEMS)
    .filter(([, item]) => item.key)
    .map(([type, item]) => [`Key${item.key}`, type]),
);

/** [{ key, label }] sorted A–Z, for the help card. */
export const KEY_LIST = Object.values(ITEMS)
  .filter((item) => item.key)
  .map((item) => ({ key: item.key, label: item.label }))
  .sort((a, b) => a.key.localeCompare(b.key));
