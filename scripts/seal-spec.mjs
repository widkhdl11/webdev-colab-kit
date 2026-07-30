#!/usr/bin/env node
// 스펙 봉인: approved 스펙의 "## 불변식" 섹션을 해시해 프론트매터 inv_hash 에 기록한다.
// 봉인 후 불변식 섹션이 승인 없이 바뀌면 spec-coverage 게이트가 해시 불일치로 감지한다.
// 사용: node scripts/seal-spec.mjs <스펙파일경로>
//
// invariantHash 는 spec-coverage 게이트가 재계산에 그대로 쓰도록 export 한다(단일 진실).
// import.meta.url 가드로, import 시엔 봉인 로직이 실행되지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// "## 불변식" 섹션(다음 ## 전까지)을 추출 → 각 줄 trim + 빈 줄 제거 → sha256.
// trim 이 \r 도 지우므로 CRLF/LF·주변 공백 변화에는 둔감하고, 불변식 문장 변화에만 민감하다.
export function invariantHash(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+불변식/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; } // 다음 레벨2 헤딩(### 은 매치 안 됨)
  }
  const section = lines.slice(start, end).map((l) => l.trim()).filter(Boolean).join("\n");
  return createHash("sha256").update(section).digest("hex");
}

function seal(path) {
  const src = readFileSync(path, "utf-8");
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fm) { console.error(`봉인 실패: 프론트매터(---)가 없다: ${path}`); process.exit(1); }
  if (!/^\s*status:\s*approved\b/m.test(fm[1])) {
    console.error(`봉인 거부: status가 approved가 아니다(승인 후 봉인한다): ${path}`);
    process.exit(1);
  }
  const hash = invariantHash(src);
  if (hash === null) { console.error(`봉인 실패: "## 불변식" 섹션을 찾을 수 없다: ${path}`); process.exit(1); }

  let front = fm[1];
  front = /^\s*inv_hash:.*$/m.test(front)
    ? front.replace(/^(\s*inv_hash:).*$/m, `$1 ${hash}`)          // 기존 필드 교체
    : front.replace(/\s*$/, "") + `\ninv_hash: ${hash}`;          // 없으면 프론트매터 끝에 추가
  const out = src.slice(0, fm.index) + `---\n${front}\n---\n` + src.slice(fm.index + fm[0].length);
  writeFileSync(path, out);
  console.log(`봉인 완료: ${path}\n  inv_hash: ${hash}`);
}

// 직접 실행 시에만 봉인 (import 시엔 invariantHash 만 제공)
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = process.argv[2];
  if (!path) { console.error("사용: node scripts/seal-spec.mjs <스펙파일경로>"); process.exit(1); }
  seal(path);
}
