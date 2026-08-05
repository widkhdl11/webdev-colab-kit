#!/usr/bin/env node
// pull.mjs — 창고에서 지정한 꾸러미를 현재 프로젝트 .claude/skills/ 로 가져온다.
//
// 사용법:
//   node pull.mjs <꾸러미이름>
//   node pull.mjs <꾸러미이름> <꾸러미이름2> ...
//
// 동작:
//   1. REPO를 임시 폴더에 얕게 clone
//   2. bundles/<꾸러미>/skills/* 를 현재 작업 폴더의 .claude/skills/ 로 복사
//   3. 이미 있는 스킬은 덮어쓰기 전에 알림
//   4. 임시 폴더 삭제
//
// 주의: 이 스크립트는 "현재 프로젝트 루트"에서 실행된다고 가정한다.
//       즉 실행 위치(process.cwd())의 .claude/skills/ 로 복사한다.

import { execSync } from "node:child_process";
import {
  mkdtempSync, rmSync, readdirSync, existsSync, statSync,
  mkdirSync, cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── 설정: 창고 repo 주소 (계정명이 다르면 여기만 바꾸면 됨) ──
// HTTPS + gh 자격증명 헬퍼(credential.helper=manager)로 붙는다. list.mjs 의 REPO 와 항상 같이 고친다.
const REPO = "https://github.com/widkhdl11/my-skills.git";
const BUNDLES_DIR = "bundles";

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function main() {
  const wanted = process.argv.slice(2);
  if (wanted.length === 0) {
    console.error("가져올 꾸러미 이름을 지정하세요. 예: node pull.mjs collab-kit-graph");
    process.exit(1);
  }

  const projectSkills = join(process.cwd(), ".claude", "skills");
  mkdirSync(projectSkills, { recursive: true });

  const tmp = mkdtempSync(join(tmpdir(), "myskills-"));
  try {
    execSync(`git clone --depth 1 ${REPO} "${tmp}"`, { stdio: "pipe" });

    for (const bundle of wanted) {
      const srcSkills = join(tmp, BUNDLES_DIR, bundle, "skills");
      if (!existsSync(srcSkills)) {
        console.error(`✗ 꾸러미 '${bundle}'를 창고에서 찾을 수 없습니다.`);
        continue;
      }

      const skills = readdirSync(srcSkills).filter((n) =>
        isDir(join(srcSkills, n))
      );

      console.log(`\n[${bundle}] 스킬 ${skills.length}개 가져오는 중...`);
      for (const skill of skills) {
        const from = join(srcSkills, skill);
        const to = join(projectSkills, skill);
        const overwrite = existsSync(to);
        cpSync(from, to, { recursive: true });
        console.log(`  ${overwrite ? "↻ 덮어씀" : "＋ 추가"}  ${skill}`);
      }
    }

    console.log(`\n완료. → ${projectSkills}`);
    console.log(`설명 문서를 만들려면: node doc.mjs`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
