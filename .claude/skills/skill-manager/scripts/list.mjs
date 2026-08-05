#!/usr/bin/env node
// list.mjs — 창고(my-skills)에서 가져올 수 있는 꾸러미 목록을 보여준다.
//
// 사용법:
//   node list.mjs
//
// 동작:
//   1. REPO를 임시 폴더에 얕게 clone
//   2. bundles/ 밑의 각 꾸러미를 스캔
//   3. 꾸러미 이름 + 그 안 스킬 개수 + 스킬 이름들을 출력
//   4. 임시 폴더 삭제

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── 설정: 창고 repo 주소 (계정명이 다르면 여기만 바꾸면 됨) ──
// HTTPS + gh 자격증명 헬퍼(credential.helper=manager)로 붙는다.
// SSH 를 쓰지 않는 이유: 이 PC 의 ~/.ssh 에 키 쌍이 없고(config·known_hosts 뿐),
// gh CLI 가 이미 repo 스코프로 로그인돼 있어 별도 키 발급 없이 private 레포를 읽는다.
const REPO = "https://github.com/widkhdl11/my-skills.git";
// 창고의 실제 최상위 폴더명. 그 아래 구조(<꾸러미>/skills/*)는 스크립트 기대와 같다.
const BUNDLES_DIR = "plugins";

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), "myskills-"));
  try {
    execSync(`git clone --depth 1 ${REPO} "${tmp}"`, { stdio: "pipe" });

    const bundlesPath = join(tmp, BUNDLES_DIR);
    if (!existsSync(bundlesPath)) {
      console.log(`창고에 ${BUNDLES_DIR}/ 폴더가 없습니다.`);
      return;
    }

    const bundles = readdirSync(bundlesPath).filter((n) =>
      isDir(join(bundlesPath, n))
    );

    if (bundles.length === 0) {
      console.log("가져올 수 있는 꾸러미가 없습니다.");
      return;
    }

    console.log(`가져올 수 있는 꾸러미 (${bundles.length}개):\n`);
    for (const bundle of bundles.sort()) {
      const skillsDir = join(bundlesPath, bundle, "skills");
      let skills = [];
      if (existsSync(skillsDir)) {
        skills = readdirSync(skillsDir).filter((n) =>
          isDir(join(skillsDir, n))
        );
      }
      console.log(`  ${bundle}  (스킬 ${skills.length}개)`);
      for (const s of skills.sort()) {
        console.log(`      - ${s}`);
      }
    }
    console.log(`\n가져오려면: node pull.mjs <꾸러미이름>`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
