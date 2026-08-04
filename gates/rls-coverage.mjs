#!/usr/bin/env node
// RLS 정책 커버리지 게이트 — 마이그레이션 정적 검사.
//
// 왜 필요한가 (2026-08-04 실제 사고):
//   0001 은 academy 를 읽기 전용으로 설계해 정책이 academy_select 하나뿐이었다.
//   0009 가 결제 설정 컬럼을 얹으면서 "설정 화면에서 저장"이라는 쓰기 경로가 생겼는데 정책은 그대로였다.
//   **RLS 는 막힌 UPDATE 를 에러가 아니라 0행으로 돌려준다.** 그래서 앱은 조용히 실패했고
//   (저장은 눌리는데 값이 안 바뀜) 원인을 찾는 데 여러 턴을 썼다. 타입·테스트·기존 게이트 전부 통과한 채로.
//
// 무엇을 잡나 (정적으로 확실한 것만 — 오탐이 나면 게이트를 신뢰하지 않게 된다):
//   1) enable row level security 를 켰는데 그 테이블에 정책이 하나도 없다 → 전면 차단(확실한 사고)
//   2) 앱 repo 가 그 테이블에 쓰기(insert/update/delete)를 하는데
//      정책이 for select 뿐이다 → 조용한 0행(이번 사고)
//
// 못 잡는 것(의도적): 컬럼 권한(GRANT UPDATE (cols))·정책 조건식의 옳고 그름.
//   그건 행동 검증(tests/inv 통합 테스트)의 몫이다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PROJECTS = join(ROOT, "projects");
if (!existsSync(PROJECTS)) process.exit(0);

const errors = [];

for (const name of readdirSync(PROJECTS)) {
  const projDir = join(PROJECTS, name);
  try { if (!statSync(projDir).isDirectory()) continue; } catch { continue; }

  const migDir = join(projDir, "supabase", "migrations");
  if (!existsSync(migDir)) continue;

  // 마이그레이션은 순서대로 누적 적용되므로 전부 이어붙여 최종 상태로 본다.
  const sql = readdirSync(migDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => readFileSync(join(migDir, f), "utf8"))
    .join("\n");

  // RLS 를 켠 테이블
  const rlsTables = new Set(
    [...sql.matchAll(/alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/gi)].map((m) => m[1]),
  );
  if (rlsTables.size === 0) continue;

  // 테이블별 정책 동작 수집: for all | select | insert | update | delete
  const policyOps = new Map();
  for (const m of sql.matchAll(/create\s+policy\s+\w+\s+on\s+(?:public\.)?(\w+)\s+for\s+(all|select|insert|update|delete)/gi)) {
    const [, table, op] = m;
    const ops = policyOps.get(table) ?? new Set();
    ops.add(op.toLowerCase());
    policyOps.set(table, ops);
  }

  // 앱이 그 테이블에 쓰기를 하는가 — repo 계층의 supabase.from("t").insert/update/delete 를 본다.
  const srcDir = join(projDir, "src");
  const writeTables = new Set();
  if (existsSync(srcDir)) {
    const walk = (dir) => {
      let out = [];
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out = out.concat(walk(p));
        else if (/\.tsx?$/.test(p)) out.push(p);
      }
      return out;
    };
    for (const file of walk(srcDir)) {
      const code = readFileSync(file, "utf8");
      // .from("table") 이후 같은 체인에서 insert/update/delete/upsert 가 나오는지 (줄바꿈 허용)
      for (const m of code.matchAll(/\.from\(\s*["'](\w+)["']\s*\)[\s\S]{0,400}?\.(insert|update|delete|upsert)\(/g)) {
        writeTables.add(m[1]);
      }
    }
  }

  for (const table of rlsTables) {
    const ops = policyOps.get(table);
    const rel = relative(ROOT, migDir);

    if (!ops || ops.size === 0) {
      errors.push(
        `[rls/NO_POLICY] ${rel} — 테이블 '${table}' 은 RLS 가 켜졌는데 정책이 하나도 없다. ` +
        `모든 접근이 차단된다(조회 0행). 정책을 추가하거나 RLS 를 끄라.`,
      );
      continue;
    }
    if (!writeTables.has(table)) continue;

    const canWrite = ops.has("all") || ops.has("insert") || ops.has("update") || ops.has("delete");
    if (!canWrite) {
      errors.push(
        `[rls/WRITE_WITHOUT_POLICY] ${rel} — 앱이 '${table}' 에 쓰기(insert/update/delete)를 하는데 ` +
        `정책이 [${[...ops].join(", ")}] 뿐이다. RLS 는 막힌 쓰기를 에러가 아니라 **0행**으로 돌려주므로 ` +
        `조용히 실패한다(2026-08-04 academy 사고). 해당 동작의 정책을 추가하라.`,
      );
    }
  }
}

if (errors.length > 0) {
  errors.forEach((e) => console.error(e));
  process.exit(2);
}
process.exit(0);
