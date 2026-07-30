---
name: spec
description: 결제·인증·권한·동시성, 또는 시간에 따라 변하는 상태·파생 속성처럼 어기면 사고가 나는 기능의 구현 전에 사용. 사용자와 인터뷰하며 불변식 중심의 스펙 문서를 작성하고 승인받는 절차. 단순 UI/콘텐츠 기능에는 사용하지 않는다.
argument-hint: [기능명]
---
# 스펙 — 테스트로 컴파일 가능한 불변식 문서
활성 프로젝트(루트 ACTIVE)의 projects/<이름>/docs/specs/_TEMPLATE.md 형식으로 projects/<이름>/docs/specs/$ARGUMENTS.md 를 작성한다.

## 절차
1. 기능의 "어기면 사고"를 사용자와 함께 나열 → 각각을 불변식 문장으로.
   **데이터 모델 기능(kickoff에서 시변·파생 등으로 플래그된 것)이면
   docs/references/modeling-checklist.md를 깊게 훑어** 필드 단위로 불변식을 도출한다 —
   선택지와 트레이드오프를 제시하는 질문 방식으로.
2. 체크리스트로 각 불변식을 검증: 참/거짓 판정 가능한가 / 위반 시 무슨 일이
   일어나는지 명시됐나 / 신뢰 경계(믿는 값·안 믿는 값)가 적혔나 / 강제 위치가 적혔나
3. 시나리오는 Given/When/Then + INV ID 참조 필수. 불변식마다 실패 경로 시나리오 1개 이상
4. status: draft로 저장 → spec-auditor 서브에이전트가 있으면 감사 →
   사용자에게 승인 요청 → 승인 시 status: approved로 변경
5. approved 후: rules/tdd.md에 따라 테스트 먼저. spec-coverage 게이트가 추적을 강제한다

## 금지
- 산문 명세 금지 — ID 없는 불변식은 테스트가 참조할 수 없다
- 사용자 승인 없이 status: approved 변경 금지
