#!/usr/bin/env node
// 추적성 게이트: approved 스펙의 모든 불변식(INV-*)은 최소 1개 테스트가 참조해야 한다
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SPECS = join(ROOT, "docs", "specs");
if (!existsSync(SPECS)) process.exit(0);

function walk(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

const invToSpec = new Map();
for (const f of walk(SPECS).filter((f) => f.endsWith(".md"))) {
  const src = readFileSync(f, "utf-8");
  if (!/^---[\s\S]*?status:\s*approved[\s\S]*?---/.test(src)) continue;
  for (const m of src.matchAll(/\bINV-[A-Z0-9]+\b/g)) invToSpec.set(m[0], relative(ROOT, f));
}
if (invToSpec.size === 0) process.exit(0);

const testFiles = walk(join(ROOT, "src")).concat(walk(join(ROOT, "tests")))
  .filter((f) => /\.(test|spec)\.(ts|tsx|js)$/.test(f));
const testText = testFiles.map((f) => readFileSync(f, "utf-8")).join("\n");

const missing = [...invToSpec.entries()].filter(([inv]) => !testText.includes(inv));
if (missing.length > 0) {
  for (const [inv, spec] of missing)
    console.error(`[spec-coverage/MISSING_TEST] ${spec} — ${inv}를 검증하는 테스트가 없다. 구현 전에 테스트부터 (rules/tdd.md)`);
  process.exit(2);
}
process.exit(0);
