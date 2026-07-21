import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// @/* → src/*  (tsconfig paths와 일치시켜 FSD import 경로를 통일)
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
