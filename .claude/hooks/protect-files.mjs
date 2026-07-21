#!/usr/bin/env node
// 보호 파일 직접 수정 차단 (PreToolUse: Edit|Write|MultiEdit)
import { readFileSync } from "node:fs";
const PROTECTED = [
  { p: "docs/LESSONS.md", why: "LESSONS.md는 retro 스킬의 사용자 승인 절차로만 갱신한다" },
  { p: ".claude/settings.json", why: "훅/권한 설정은 사용자가 직접 수정한다" },
  { p: ".claude/hooks/", why: "훅 스크립트는 사용자가 직접 수정한다 (훅으로 훅 우회 차단)" },
  { p: "gates/", why: "판정 레이어는 제안 후 사용자가 반영한다 (retro/setup 절차)" },
];
const input = JSON.parse(readFileSync(0, "utf-8"));
const path = input.tool_input?.file_path ?? "";
const hit = PROTECTED.find(({ p }) => path.includes(p));
if (hit) {
  console.error(`${path} 는 보호 파일. ${hit.why}. 수정이 필요하면 내용을 제안하고 사용자에게 요청하라.`);
  process.exit(2);
}
process.exit(0);
