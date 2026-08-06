#!/usr/bin/env node
// doc.mjs — 현재 프로젝트 .claude/skills/ 의 스킬들을 스캔해서
//           사람이 읽는 스킬 목록 문서(OUT_NAME)를 만든다.
//
// 사용법:
//   node doc.mjs
//
// 동작:
//   1. 현재 폴더(process.cwd())의 .claude/skills/ 를 스캔
//   2. 각 스킬의 SKILL.md frontmatter 에서 name, description, disable-model-invocation 추출
//   3. 사람이 읽을 문구는 easy-descriptions.json 에서 가져온다(있으면 원문보다 우선)
//   4. 스킬 폴더의 mtime 을 "추가된 날짜"로 기록
//   5. OUT_NAME 문서를 프로젝트 루트에 생성/갱신
//
// frontmatter 파싱은 표준 형식을 가정한다:
//   ---
//   name: <이름>
//   description: <설명>
//   ---
// 다른 형식이면 parseFrontmatter를 조정하면 된다.

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 만들어낼 문서 이름. 바꿀 일이 있으면 여기 한 줄만 고친다.
//
// **읽어오는 SKILL.md 와 헷갈리지 말 것.** SKILL.md 는 Claude Code 가 정한 고정 파일명이라
// 이름을 바꾸면 스킬이 통째로 인식되지 않는다. 실제로 2026-08-05 에 입력 쪽 경로를 바꿨다가
// 12개 스킬의 frontmatter 가 전부 파싱 실패해, 슬래시 전용 스킬이 "자동"으로 잘못 표시됐다.
const OUT_NAME = "SKILLS-SUMMARY.md";

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

// 사람이 읽을 설명은 스킬 파일이 아니라 이 파일에서 온다.
// SKILL.md 의 description 은 모델이 "지금 이 스킬을 꺼낼까"를 판단하는 문장이라 쉽게 풀어쓰면
// 스킬이 제때 안 불린다. 그래서 두 설명을 분리해 둔다.
const EASY_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "easy-descriptions.json");

function loadEasy() {
  if (!existsSync(EASY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(EASY_PATH, "utf8"));
  } catch (e) {
    // 문서 생성 자체는 계속한다 — 쉬운 설명만 비고, 왜 비었는지는 알려준다.
    console.warn(`easy-descriptions.json 을 읽지 못했습니다(${e.message}). 쉬운 설명 없이 만듭니다.`);
    return {};
  }
}

// SKILL.md 상단 --- ... --- 사이에서 name, description을 뽑는다.
function parseFrontmatter(rawText) {
  // CRLF 를 먼저 없앤다 — 아래 줄 파싱이 `(.*)$` 를 쓰는데 JS 정규식에서 `.` 은 `\r` 을 매칭하지 않아
  // 줄 끝 `\r` 이 남으면 `$` 에 못 닿고 **모든 키가 조용히 파싱 실패**한다(설명이 통째로 빈다).
  // Windows 에서 저장된 SKILL.md 가 실제로 이렇게 들어온다(spec·supabase 가 그랬다).
  const text = rawText.replace(/\r\n/g, "\n");
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const body = m[1];
  const out = {};
  // 여러 줄 description(다음 키가 나올 때까지)도 처리
  const lines = body.split("\n");
  let key = null;
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      out[key] = kv[2].trim();
    } else if (key && line.trim()) {
      // 이어지는 줄 (들여쓰기된 연속 값)
      out[key] += " " + line.trim();
    }
  }
  // 따옴표 제거
  for (const k of Object.keys(out)) {
    out[k] = out[k].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function main() {
  const skillsDir = join(process.cwd(), ".claude", "skills");
  if (!existsSync(skillsDir)) {
    console.error(".claude/skills/ 폴더가 없습니다. 먼저 꾸러미를 가져오세요.");
    process.exit(1);
  }

  const skillNames = readdirSync(skillsDir).filter((n) =>
    isDir(join(skillsDir, n))
  );

  const easy = loadEasy();
  const used = new Set(); // 실제로 스킬과 짝지어진 키 — 남는 키(오타·지운 스킬)를 찾는 데 쓴다
  const rows = [];
  for (const name of skillNames.sort()) {
    const dir = join(skillsDir, name);
    // 읽어오는 쪽은 각 스킬의 SKILL.md — 위 OUT_NAME 주석 참조(이 경로는 바꾸면 안 된다).
    const mdPath = join(dir, "SKILL.md");
    let meta = {};
    if (existsSync(mdPath)) {
      meta = parseFrontmatter(readFileSync(mdPath, "utf8"));
    }
    const added = fmtDate(statSync(dir).mtime);
    // disable-model-invocation: true 면 모델이 못 꺼내고 사용자가 /이름 으로 직접 불러야 한다.
    const manualOnly = String(meta["disable-model-invocation"] ?? "").toLowerCase() === "true";
    // 키는 폴더 이름이 기본이지만, 표에 보이는 건 frontmatter 의 name 이다.
    // 둘이 다른 스킬에서 사람이 보이는 이름으로 키를 적기 쉬우므로 양쪽 다 받는다.
    const displayName = meta.name || name;

    // easy-descriptions.json 항목은 두 형태를 받는다:
    //   "짧은 설명"                       → 표에만 쓰고, 자세한 설명은 SKILL.md 원문으로 대체
    //   { "short": "...", "full": "..." } → short 는 표, full 은 '자세한 설명' 섹션
    const entry = easy[name] ?? easy[displayName];
    if (entry !== undefined) used.add(easy[name] !== undefined ? name : displayName);
    const easyShort = typeof entry === "string" ? entry : entry?.short;
    const easyFull = (entry && typeof entry === "object") ? entry.full : undefined;

    rows.push({
      folder: name,
      name: displayName,
      short: easyShort || "(아직 없음)",
      // 자세한 설명: 한국어(full)가 있으면 그걸, 없으면 SKILL.md 원문으로 되돌아간다.
      detail: easyFull || meta.description || "(설명 없음)",
      // full 이 없어 원문으로 대체된 경우 문서에 표시해 준다 — 왜 영어가 섞였는지 알 수 있게.
      isRaw: !easyFull,
      callWay: manualOnly ? `\`/${displayName}\` 로 직접` : "자동",
      added,
    });
  }

  // 어떤 스킬과도 안 맞은 키를 알려준다 — 오타면 표에 `(아직 없음)`만 뜨고 이유를 알 수 없다.
  // `_` 로 시작하는 키는 메모용이라 건너뛴다.
  const orphans = Object.keys(easy).filter((k) => !k.startsWith("_") && !used.has(k));
  if (orphans.length > 0) {
    console.warn(`easy-descriptions.json 에 안 맞는 키 ${orphans.length}개: ${orphans.join(", ")}`);
    console.warn(`  (스킬 폴더 이름과 철자가 같은지 확인하세요. 지운 스킬이면 이 줄도 지우면 됩니다.)`);
  }

  // 문서 작성
  const now = fmtDate(new Date());
  let out = `# 설치된 스킬 목록\n\n`;
  out += `> 생성일: ${now} · 총 ${rows.length}개 · 대상: \`.claude/skills/\`\n\n`;

  const esc = (s) => s.replace(/\|/g, "\\|");

  if (rows.length === 0) {
    out += `설치된 스킬이 없습니다.\n`;
  } else {
    out += `## 한눈에 보기\n\n`;
    out += `| 스킬 | 무슨 일을 하나 | 부르는 법 | 추가일 |\n`;
    out += `|------|----------------|-----------|--------|\n`;
    for (const r of rows) {
      out += `| \`${r.name}\` | ${esc(r.short)} | ${r.callWay} | ${r.added} |\n`;
    }

    out += `\n## 자세한 설명\n\n`;
    out += `각 스킬이 하는 일을 조금 더 풀어 쓴 설명입니다. `;
    out += `한국어 설명이 아직 없는 스킬은 *(원문)* 으로 표시하고, `;
    out += `모델이 스킬을 꺼낼지 판단할 때 읽는 SKILL.md 의 description 을 그대로 보여줍니다.\n\n`;
    for (const r of rows) {
      out += `### \`${r.name}\`${r.isRaw ? " *(원문)*" : ""}\n\n${r.detail}\n\n`;
    }

    out += `---\n\n`;
    out += `이 문서는 \`node .claude/skills/skill-manager/scripts/doc.mjs\` 가 만듭니다. `;
    out += `직접 고쳐도 다음 실행 때 덮어써집니다.\n`;
    out += `설명을 바꾸려면 \`.claude/skills/skill-manager/easy-descriptions.json\` 을 고치세요 `;
    out += `(표에 들어갈 한 줄은 "short", 아래 자세한 설명은 "full").\n`;
  }

  const outPath = join(process.cwd(), OUT_NAME);
  writeFileSync(outPath, out, "utf8");
  console.log(`문서 생성 완료: ${outPath}`);
  console.log(`스킬 ${rows.length}개 정리됨.`);
}

main();
