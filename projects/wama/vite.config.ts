import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// @/* → src/* (tsconfig paths와 동기화). Vite/Vitest 공용.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
