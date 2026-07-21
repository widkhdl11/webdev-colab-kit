#!/usr/bin/env node
// 결정론 스캐폴딩 — 멱등: 있는 파일은 건드리지 않는다. 워킹 스켈레톤으로 시작.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const write = (path, content) => {
  const p = join(ROOT, path);
  if (existsSync(p)) return console.log(`  유지: ${path}`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log(`  생성: ${path}`);
};

for (const layer of LAYERS) mkdirSync(join(ROOT, "src", layer), { recursive: true });

write("tsconfig.json", JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "ES2022", moduleResolution: "bundler",
    strict: true, noEmit: false, outDir: "dist",
    baseUrl: ".", paths: { "@/*": ["src/*"] },
  },
  include: ["src"],
}, null, 2) + "\n");

write("src/app/main.ts", `console.log("walking skeleton");\n`);
write("index.html", `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>walking skeleton</title></head>\n<body><div id="app"></div><script type="module" src="./dist/app/main.js"></script></body></html>\n`);

console.log("\n스캐폴딩 완료. 검증: node gates/run-gates.mjs");
