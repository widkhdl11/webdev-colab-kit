#!/usr/bin/env node
// 결정론 게이트. 위반 시 exit 2 (stderr가 모델에 주입됨)
// 사용: node gates/run-gates.mjs [--quick]  (--quick: tsc/테스트/스펙커버리지 생략)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const QUICK = process.argv.includes("--quick");
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const rank = new Map(LAYERS.map((l, i) => [l, i]));

// 전제 검사: src/ 가 아직 없으면 '검사 대상 없음' → 실패가 아니라 skip(통과).
// 스캐폴드 이전 빈 레포에서 매 Stop 훅마다 실패가 재주입되는 루프를 방지한다.
// (검사 대상이 생기면 아래 로직이 원래대로 엄격히 돈다)
if (!existsSync(SRC)) {
  console.log("게이트 skip: src/ 아직 없음 (스캐폴드 전). 구조 생성 시: node scripts/scaffold.mjs");
  process.exit(0);
}

const SECURITY_RULES = [
  { rule: "NO_EVAL", re: /\beval\s*\(|new\s+Function\s*\(/, msg: "eval / new Function 금지 — 임의 코드 실행 벡터" },
  { rule: "NO_INNERHTML", re: /\.innerHTML\s*=|dangerouslySetInnerHTML/, msg: "innerHTML 할당 금지 — XSS 벡터" },
  { rule: "NO_HARDCODED_SECRET", re: /(sk-[A-Za-z0-9]{16,}|service_role|SUPABASE_SERVICE_ROLE|(?:api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{8,}['"])/i, msg: "하드코딩된 시크릿 — 환경변수로 분리" },
  { rule: "NO_DOCUMENT_WRITE", re: /document\.write\s*\(/, msg: "document.write 금지" },
];

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
const layerOf = (rel) => { const f = rel.split(sep)[0]; return LAYERS.includes(f) ? f : null; };
const sliceOf = (rel) => { const p = rel.split(sep); return p.length >= 2 ? `${p[0]}/${p[1]}` : null; };
const resolveTarget = (spec, fromFile) => {
  if (spec.startsWith("@/")) return join(SRC, spec.slice(2));
  if (spec.startsWith(".")) return resolve(dirname(fromFile), spec);
  return null;
};

const errors = [];
const files = walk(SRC).filter((f) => /\.(ts|tsx|js|jsx|html)$/.test(f));

for (const file of files) {
  const src = readFileSync(file, "utf-8");
  const rel = relative(ROOT, file);
  const relSrc = relative(SRC, file);
  src.split("\n").forEach((t, i) => {
    for (const { rule, re, msg } of SECURITY_RULES) {
      if (re.test(t)) errors.push(`[security/${rule}] ${rel}:${i + 1} — ${msg}`);
    }
  });

  const fromLayer = layerOf(relSrc);
  if (fromLayer === null) continue;
  const importRe = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const target = resolveTarget(m[1], file);
    if (!target) continue;
    const toLayer = layerOf(relative(SRC, target));
    if (toLayer === null) continue;
    const line = src.slice(0, m.index).split("\n").length;
    if (rank.get(toLayer) < rank.get(fromLayer))
      errors.push(`[fsd/UPWARD_IMPORT] ${rel}:${line} — '${fromLayer}'가 상위 '${toLayer}'를 import ('${m[1]}'). 의존은 아래로만`);
    else if (rank.get(toLayer) === rank.get(fromLayer) && sliceOf(relSrc) !== sliceOf(relative(SRC, target)))
      errors.push(`[fsd/CROSS_SLICE] ${rel}:${line} — 같은 레이어의 다른 슬라이스 import ('${m[1]}'). 공유는 아래 레이어로`);
  }
}

if (!QUICK) {
  if (existsSync(join(ROOT, "tsconfig.json"))) {
    const r = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], { cwd: ROOT, encoding: "utf-8", timeout: 120000, shell: true });
    if (r.error) {
      errors.push(`[tsc/SPAWN] tsc 실행 실패: ${r.error.code} — Node에서 npx 실행 불가(shell 옵션 확인)`);
    } else if (r.status !== 0) {
      const out = (r.stdout ?? "") + (r.stderr ?? "");
      const re = /^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/gm;
      let m, found = false;
      while ((m = re.exec(out)) !== null) { errors.push(`[tsc/${m[3]}] ${m[1]}:${m[2]} — ${m[4]}`); found = true; }
      if (!found) errors.push(`[tsc/FAIL] ${out.slice(0, 300)}`);
    }
  }
  // 스펙 커버리지: approved 스펙의 모든 INV는 테스트가 참조해야 한다
  const sc = spawnSync("node", [join(ROOT, "gates", "spec-coverage.mjs")], { cwd: ROOT, encoding: "utf-8" });
  if (sc.status !== 0) errors.push(...(sc.stderr ?? "").trim().split("\n").filter(Boolean));
  // 테스트: 통과는 모델의 보고가 아니라 게이트의 판정
  const pkgPath = join(ROOT, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.scripts?.test) {
      const t = spawnSync("npm", ["test", "--silent"], { cwd: ROOT, encoding: "utf-8", timeout: 300000, shell: true });
      if (t.status !== 0) errors.push(`[test/FAIL] npm test 실패:\n${((t.stdout ?? "") + (t.stderr ?? "")).slice(-800)}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`게이트 실패 ${errors.length}건. 새 기능 추가 금지, 아래 위반만 수정:\n` + errors.slice(0, 30).join("\n"));
  process.exit(2);
}
console.log(`게이트 통과 (${files.length}개 파일${QUICK ? ", quick" : ""})`);
