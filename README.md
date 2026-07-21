# webdev-collab-kit v2

Claude Code 대화형 위에서 사용자와 함께 웹사이트를 만드는 협업 세션 킷.
**오케스트레이터는 사용자다.** 모델은 설득(.md), 코드는 판정(게이트·훅).

## 시작
```
킷을 프로젝트 루트에 복사 → claude 실행 → "이런 웹사이트를 만들고 싶어"
```
kickoff가 인터뷰 → PLAN.md 합의 → setup이 하네스 구성+스캐폴딩 → 구현.

## 생애주기와 스킬
kickoff(제품 정의) → setup(하네스 구성+골격) → /spec(위험 기능 불변식 문서)
→ 구현(+checkpoint 시각 승인) → 리뷰(서브에이전트) → retro(교훈 승격) → wrap-up(상태 동결)
슬래시 전용: /goal(세션 목표) /status(브리핑) /scaffold(골격 재생성)

## 컨텍스트 계층 (규칙의 거처)
0토큰 강제: permissions.deny, 훅(.claude/hooks/), 게이트(gates/)
상시(고정비): CLAUDE.md — 헌법+라우팅만, ~40줄
경로 조건(결정론): .claude/rules/*.md (paths 매칭 시 자동 로드)
작업 조건: .claude/skills/ (description 매칭 시 로드)
요청 시: docs/ (라우팅 지시로 필요할 때 Read)

## 검증 체계
- 편집 직후: 훅 → run-gates --quick (FSD 레이어·보안 패턴)
- 턴 종료: 훅 → run-gates 전체 (tsc + npm test + spec-coverage)
- spec-coverage: approved 스펙의 모든 INV-*는 테스트가 참조해야 통과
- 세션 시작: SessionStart 훅 → briefing (대기 결정·게이트·멈춘 지점·다음 할 일·진행률)
- 보호: LESSONS.md/설정/게이트/훅은 직접 수정 차단, 위험 bash 차단, .env는 deny

## 서브에이전트 (전부 읽기 전용 — 만드는 자와 판정하는 자의 분리)
code-reviewer / security-reviewer(스펙 강제위치 검사 포함) / ui-reviewer(design-rules 기준)
/ test-auditor(알리바이 테스트 감사). 탐색은 내장 Explore 사용.
setup 조건부: spec-auditor, doc-drift-auditor.

주의: 훅/스킬 스키마는 Claude Code 버전에 따라 다를 수 있음 — 적용 후 /hooks 와
/context 로 로드 확인 권장.
