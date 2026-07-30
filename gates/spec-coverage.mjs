#!/usr/bin/env node
// 추적성 + 봉인 게이트:
//  (1) approved 스펙의 모든 불변식(INV-*)은 최소 1개 테스트가 참조해야 한다.
//  (2) approved 스펙은 봉인돼야 한다 — 프론트매터 inv_hash 가 "## 불변식" 섹션 해시와 일치.
//      inv_hash 없음 → 봉인 누락, 불일치 → 승인 없는 불변식 변경.
// 스펙은 모든 projects/*/docs/specs 에서 읽고, 테스트는 projects/*/src 와 projects/*/tests 에서 찾는다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { invariantHash } from "../scripts/seal-spec.mjs";

const ROOT = process.cwd();
const PROJECTS = join(ROOT, "projects");
// 모든 프로젝트의 docs/specs 를 스캔한다 (활성만이 아니라 전부 — 게이트는 저장소 전체의 약속을 지킨다).
const specDirs = existsSync(PROJECTS)
  ? readdirSync(PROJECTS)
      .map((n) => join(PROJECTS, n, "docs", "specs"))
      .filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } })
  : [];
if (specDirs.length === 0) process.exit(0);

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

const sealErrors = [];
const invToSpec = new Map();
for (const f of specDirs.flatMap(walk).filter((f) => f.endsWith(".md"))) {
  const src = readFileSync(f, "utf-8");
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm || !/^\s*status:\s*approved\b/m.test(fm[1])) continue; // approved 만 검사
  const rel = relative(ROOT, f);

  // 봉인 검사: approved 스펙은 inv_hash 가 있고 "## 불변식" 섹션 해시와 일치해야 한다.
  const stored = (fm[1].match(/^\s*inv_hash:\s*(\S+)\s*$/m) || [])[1];
  const actual = invariantHash(src);
  if (!stored) {
    sealErrors.push(`[spec-coverage/UNSEALED] ${rel} — 봉인 누락(inv_hash 없음). approved 스펙은 봉인 필요: node scripts/seal-spec.mjs ${rel}`);
  } else if (actual && stored !== actual) {
    sealErrors.push(`[spec-coverage/INV_TAMPERED] ${rel} — 불변식이 승인 없이 변경됨. status를 draft로 되돌려 재승인·재봉인(seal-spec) 하라.`);
  }

  for (const m of src.matchAll(/\bINV-[A-Z0-9]+\b/g)) invToSpec.set(m[0], rel);
}
if (invToSpec.size === 0 && sealErrors.length === 0) process.exit(0);

// 테스트 탐색 루트: projects/<이름>/src 와 projects/<이름>/tests
const testRoots = [];
const projectsDir = join(ROOT, "projects");
if (existsSync(projectsDir)) {
  for (const n of readdirSync(projectsDir)) {
    const p = join(projectsDir, n);
    try {
      if (statSync(p).isDirectory()) testRoots.push(join(p, "src"), join(p, "tests"));
    } catch { /* skip */ }
  }
}
const testFiles = testRoots
  .flatMap((d) => walk(d))
  .filter((f) => /\.(test|spec)\.(ts|tsx|js)$/.test(f));
const testText = testFiles.map((f) => readFileSync(f, "utf-8")).join("\n");

const missing = [...invToSpec.entries()].filter(([inv]) => !testText.includes(inv));
const errors = [
  ...sealErrors,
  ...missing.map(([inv, spec]) => `[spec-coverage/MISSING_TEST] ${spec} — ${inv}를 검증하는 테스트가 없다. 구현 전에 테스트부터 (rules/tdd.md)`),
];
if (errors.length > 0) { errors.forEach((e) => console.error(e)); process.exit(2); }
process.exit(0);
