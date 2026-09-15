import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  publicDir: mode === "demo" ? "demo/public" : false,
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "@chenglou/pretext",
    ],
  },
  build: { outDir: "demo-dist" },
}));
