// Supabase Management API 로 마이그레이션 SQL 을 호스팅 DB 에 적용한다.
//
// 보안: Management 토큰은 조직 전체를 건드릴 수 있는 강력 키다. 이 스크립트는 토큰을
//   **오직 process.env.SUPABASE_TOKEN 에서만** 읽고, 파일(.env)에서 읽지 않으며, 어떤 경로로도
//   값을 출력하지 않는다(로그·에러 메시지에 토큰을 넣지 않음). 토큰은 저장소 밖(OS 사용자 환경변수)에
//   두는 것을 전제로 한다 → 저장소에 토큰 담긴 파일이 없어 도구가 읽을 대상 자체가 없다.
//
// 사용(토큰은 셸이 아니라 OS 사용자 환경변수로 미리 설정된 상태여야 함):
//   node scripts/apply-migrations.mjs 0005_subject 0006_student_schedule ...
//   인자 없으면 DEFAULT 목록을 적용. 프로젝트 ref 는 SUPABASE_PROJECT_REF 환경변수 우선, 없으면 기본값.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, "..", "projects", "wama", "supabase", "migrations");
const DEFAULT = ["0005_subject", "0006_student_schedule", "0007_exam", "0008_exam_student_guard"];
const DEFAULT_REF = "zubdbqlrcuywvelvnfle"; // 프로젝트 ref 는 비밀이 아님(DECISIONS 2026-07-24)

// 토큰은 환경변수에서만. 파일(.env)은 절대 읽지 않는다.
const token = process.env.SUPABASE_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || DEFAULT_REF;
if (!token) {
  console.error(
    "SUPABASE_TOKEN 환경변수가 없습니다. 이 스크립트는 토큰을 파일에서 읽지 않습니다.\n" +
    "OS 사용자 환경변수로 설정한 뒤(새 셸에서) 다시 실행하세요. (.env 에 토큰을 두지 마세요.)",
  );
  process.exit(1);
}

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT;

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

let failed = false;
for (const name of files) {
  const file = name.endsWith(".sql") ? name : `${name}.sql`;
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`적용 ${file} … `);
  const { ok, status, body } = await runSql(sql);
  if (ok) {
    console.log("OK");
  } else {
    failed = true;
    console.log(`실패 (HTTP ${status})`);
    console.error(body.slice(0, 800)); // 응답 본문에는 토큰이 포함되지 않음
    break; // 순서 의존이므로 첫 실패에서 멈춘다
  }
}
process.exit(failed ? 1 : 0);
