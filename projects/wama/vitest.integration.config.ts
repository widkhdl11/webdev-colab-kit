import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// 통합 테스트 전용 — 실제 Supabase 프로젝트에 붙어 INV(격리)를 행동 검증한다.
// 네트워크 의존이라 기본 게이트(npm test)에서 분리. 실행: `npm run test:integration`.
// projects/wama/.env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.{test,spec}.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
