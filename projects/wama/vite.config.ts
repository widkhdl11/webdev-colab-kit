import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// @/* → src/* (tsconfig paths와 동기화). Vite/Vitest 공용.
// 기본 test 는 src 의 유닛 테스트만 — 네트워크 의존 통합 테스트(tests/)는 제외해 게이트를 결정론적으로 유지.
// 통합 테스트는 `npm run test:integration` (vitest.integration.config.ts)로 온디맨드 실행.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
