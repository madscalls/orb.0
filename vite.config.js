import { defineConfig } from "vite";

export default defineConfig({
  base: "/orb.0/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});
