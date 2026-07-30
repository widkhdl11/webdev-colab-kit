---
paths:
  - "projects/*/src/**"
  - "projects/*/tests/**"
---
# TDD 규칙 (스펙이 있는 기능)
- projects/<이름>/docs/specs/에 해당 기능의 approved 스펙이 있으면: 구현 전에 시나리오를 테스트로 먼저 작성한다
- 테스트 설명문에 INV ID를 포함한다 (spec-coverage 게이트가 추적한다)
- 테스트 작성 → 실행해서 실패(red)를 출력으로 보여준다 → 구현 → 통과(green) 순서.
  구현 후 끼워 맞춘 테스트는 알리바이지 검증이 아니다
- 검증 대상 자체를 모킹하지 않는다. 불변식마다 실패 경로 테스트를 반드시 포함한다
- 네트워크 의존 통합 테스트(실제 Supabase 등 외부에 붙는 INV 검증)는 기본 `npm test`에서 분리한다 —
  별도 `test:integration` 스크립트 + 전용 vitest config, 테스트는 `projects/<이름>/tests/` 에 둔다.
  게이트가 `npm test`를 돌리므로, 통합 테스트가 기본 run에 있으면 프로젝트 일시정지·네트워크 장애 시 게이트가
  비결정적으로 실패한다. 기본 test는 오프라인 유닛만. (spec-coverage는 tests/도 스캔하므로 INV 커버리지엔 무관)
