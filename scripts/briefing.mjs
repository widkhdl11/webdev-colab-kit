#!/usr/bin/env node
// 세션 브리핑 — SessionStart 훅과 /status가 호출. 사람과 Claude가 같은 그림으로 시작한다.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf-8") : "");

// 0. 활성 프로젝트 — 루트 ACTIVE 파일이 가리킨다(한 줄, 프로젝트 이름).
//    ACTIVE 가 없거나 projects/<이름>/ 이 아직 없으면: 스캐폴드 전 상태로 보고 안내 후 정상 종료(exit 0).
//    (게이트의 '검사 대상 없음 → skip' 패턴과 동일 — 빈 레포에서 매 세션 에러로 죽지 않게.)
const active = read("ACTIVE").trim();
const projectDir = active ? join("projects", active) : "";
if (!active || !existsSync(join(ROOT, projectDir))) {
  console.log("── 세션 브리핑 ──");
  console.log("활성 프로젝트 없음 — kickoff로 시작하세요. (루트 ACTIVE 파일에 프로젝트 이름 한 줄을 적으면 브리핑이 붙습니다.)");
  process.exit(0);
}

// 활성 프로젝트 기준 경로
const PROGRESS = `${projectDir}/workspace/PROGRESS.md`;
const PRODUCT = `${projectDir}/docs/PRODUCT.md`;
const SPECS_REL = `${projectDir}/docs/specs`;

// 1. 대기 중인 결정
const pending = [];
const specsDir = join(ROOT, projectDir, "docs", "specs");
if (existsSync(specsDir)) {
  for (const f of readdirSync(specsDir).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
    if (/status:\s*draft/.test(read(join(SPECS_REL, f)))) pending.push(`스펙 승인 대기: ${f}`);
  }
}
const progress = read(PROGRESS);
const pendingBlock = progress.match(/대기 중인 결정:\s*(.+)/);
if (pendingBlock && !/없음/.test(pendingBlock[1])) pending.push(pendingBlock[1].trim());

// 2. 게이트 신호등
const g = spawnSync("node", [join(ROOT, "gates", "run-gates.mjs"), "--quick"], { cwd: ROOT, encoding: "utf-8" });
const gateLight = g.status === 0 ? "통과" : "실패 — 새 작업 전에 복구 필요";

// 2.5. 하네스 무결성 — 검사 장치가 자기 자신이 바뀐 것은 못 본다.
// 2026-08-05: gates/spec-coverage.mjs 가 커밋 없이 예전 버전으로 되돌아가 **봉인 검증이 통째로 빠진** 채
// 세션 내내 "게이트 통과"로 보고됐다. 발견은 순전히 우연이었다(커밋하려다 git status 에서 봄).
// 그래서 게이트·규칙·봉인 스크립트의 미커밋 변경을 세션 첫 줄에 띄운다. 정당한 작업 중이면 그냥 정보고,
// 되돌아간 것이면 여기서 잡힌다. 실패가 아니라 경고인 이유: 하네스를 고치는 중에는 항상 더러운 게 정상이다.
const HARNESS_PATHS = ["gates", ".claude/rules", ".claude/agents", "scripts/seal-spec.mjs"];
const dirty = spawnSync("git", ["status", "--porcelain", "--", ...HARNESS_PATHS], { cwd: ROOT, encoding: "utf-8" });
const dirtyFiles = dirty.status === 0
  ? dirty.stdout.split("\n").map((l) => l.slice(3).trim()).filter(Boolean)
  : [];

// 3~4. 멈춘 지점 / 다음 할 일
const stopped = progress.match(/멈춘 지점:\s*(.+)/)?.[1]?.trim() ?? "(기록 없음 — 첫 세션이거나 wrap-up 누락)";
const next = progress.match(/다음 할 일:\s*(.+)/)?.[1]?.trim() ?? "(기록 없음)";

// 4.5. 원칙 가드 — "화면(디자인) 먼저, 그다음 DB/구현" (CLAUDE.md·design-drafting.md).
// "다음 할 일"의 첫 옵션이 데이터 계층인데 화면 대안이 함께 적혀 있으면(= 재량적 순서),
// 순서가 원칙과 어긋날 수 있으니 경보한다. DB가 유일 단계면(화면 언급 없음) 발화하지 않는다.
// 이 가드는 순서만 본다 — 화면 국면의 완료 여부까지 판정하지 않으니, 경보 시 사람이 확인한다.
const firstOption = next.split(/또는|→|then/i)[0];
const dataRe = /\b(DB|Supabase|RLS|migration|스키마|schema|마이그레이션|데이터 ?계층)\b/i;
const uiRe = /(화면|페이지|page|UI|시안|디자인|mockup)/i;
const principleWarn =
  dataRe.test(firstOption) && uiRe.test(next)
    ? "⚠ 순서 점검: '다음 할 일' 1순위가 데이터 계층인데 화면 대안이 함께 있음 — 원칙은 화면(디자인) 먼저. 화면 국면이 남았다면 순서를 뒤집을 것."
    : "";

// 5. 좌표
const plan = read(PRODUCT);
const done = (plan.match(/- \[x\]/g) ?? []).length;
const total = done + (plan.match(/- \[ \]/g) ?? []).length;

// 5.5. 하네스 백로그 — 보류된 업그레이드가 있으면 리마인드(비면 침묵). 승격 트리거는 retro가 판정.
const backlog = read("docs/references/harness-backlog.md");
const pendingUpgrades = (backlog.match(/^- \[ \]/gm) ?? []).length;

// 5.6. wrap-up 누락 경보 — PROGRESS.md 를 마지막으로 바꾼 커밋 이후, 프로젝트 경로를 건드린 커밋이
//   N개(기본 5) 이상이면 한 줄 경보. git 은 읽기 전용(log)만 — commit·reset·checkout 금지.
//   감지=기계, 쓰기=wrap-up 원칙: 여기선 경보만, 문서는 쓰지 않는다. .git 없거나 git 실패 시 조용히 통과.
const WRAPUP_ALERT_N = 5;
let wrapupWarn = "";
try {
  if (existsSync(join(ROOT, ".git"))) {
    const git = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf-8" });
    const last = git(["log", "-1", "--format=%H", "--", PROGRESS]);
    const lastHash = last.status === 0 ? last.stdout.trim() : "";
    if (lastHash) {
      const since = git(["log", "--format=%H", `${lastHash}..HEAD`, "--", projectDir]);
      const n = since.status === 0 ? since.stdout.split("\n").filter(Boolean).length : 0;
      if (n >= WRAPUP_ALERT_N) wrapupWarn = `⚠ PROGRESS 갱신 이후 프로젝트 커밋 ${n}개 — wrap-up 누락?`;
    }
  }
} catch { /* .git 없음·git 실패 시 조용히 통과 */ }

console.log(`── 세션 브리핑 (${active}) ──`);
console.log(`▣ 대기 중인 결정: ${pending.length > 0 ? pending.join(" / ") : "없음"}`);
console.log(`● 게이트: ${gateLight}`);
if (dirtyFiles.length > 0) {
  console.log(`⚠ 하네스 미커밋 변경 ${dirtyFiles.length}건: ${dirtyFiles.join(", ")}`);
  console.log(`   → git diff 로 확인. 되돌아간 것이면 git checkout 으로 복구 (게이트가 조용히 약해졌을 수 있다).`);
}
console.log(`↩ 멈춘 지점: ${stopped}`);
console.log(`→ 다음 할 일: ${next}`);
if (principleWarn) console.log(principleWarn);
if (total > 0) console.log(`▤ 필수 기능 진행: ${done}/${total}`);
if (pendingUpgrades > 0) console.log(`⚙ 보류된 하네스 승격: ${pendingUpgrades}건 (docs/references/harness-backlog.md)`);
if (wrapupWarn) console.log(wrapupWarn);
