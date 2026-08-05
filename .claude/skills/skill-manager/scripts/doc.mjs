#!/usr/bin/env node
// doc.mjs — 현재 프로젝트 .claude/skills/ 의 스킬들을 스캔해서
//           이해하기 쉬운 설명 문서(SKILLS.md)를 만든다.
//
// 사용법:
//   node doc.mjs
//
// 동작:
//   1. 현재 폴더(process.cwd())의 .claude/skills/ 를 스캔
//   2. 각 스킬의 SKILL.md frontmatter에서 name, description 추출
//   3. 스킬 폴더의 mtime을 "추가된 날짜"로 기록
//   4. SKILLS.md 를 프로젝트 루트에 생성/갱신
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

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

// 사람이 읽을 "쉬운 설명"은 스킬 파일이 아니라 이 파일에서 온다.
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
    const easyText = easy[name] ?? easy[displayName];
    if (easyText !== undefined) used.add(easy[name] !== undefined ? name : displayName);

    rows.push({
      folder: name,
      name: displayName,
      description: meta.description || "(설명 없음)",
      easy: easyText || "(아직 없음)",
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

  // SKILLS.md 작성
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
      out += `| \`${r.name}\` | ${esc(r.easy)} | ${r.callWay} | ${r.added} |\n`;
    }

    // 원문은 버리지 않는다 — 모델이 실제로 보고 판단하는 문장이라 확인할 자리가 필요하다.
    out += `\n## 스킬 파일에 적힌 원래 설명\n\n`;
    out += `모델이 "지금 이 스킬을 꺼낼까"를 판단할 때 읽는 문장입니다. `;
    out += `위의 쉬운 설명과 달리 사람이 읽으라고 쓴 글이 아닙니다.\n\n`;
    for (const r of rows) {
      out += `### \`${r.name}\`\n\n${r.description}\n\n`;
    }

    out += `---\n\n`;
    out += `이 문서는 \`node .claude/skills/skill-manager/scripts/doc.mjs\` 가 만듭니다. `;
    out += `직접 고쳐도 다음 실행 때 덮어써집니다.\n`;
    out += `쉬운 설명을 바꾸려면 \`.claude/skills/skill-manager/easy-descriptions.json\` 을 고치세요.\n`;
  }

  const outPath = join(process.cwd(), "SKILLS.md");
  writeFileSync(outPath, out, "utf8");
  console.log(`문서 생성 완료: ${outPath}`);
  console.log(`스킬 ${rows.length}개 정리됨.`);
}

main();
