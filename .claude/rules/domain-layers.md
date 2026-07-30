---
paths:
  - "projects/*/src/entities/**"
  - "projects/*/src/features/**"
---
# 도메인 레이어 규칙
- 도메인 규칙(불변식, 상태 전이)은 entities에, 유스케이스 조합은 features에
- 값 객체는 스마트 컨스트럭터로: 불법 상태를 표현 불가능하게, 검증은 경계에서 1회
- entities는 UI를 모른다 — DOM, 이벤트 핸들러, 렌더링 코드 금지
- 상태 전이는 명시적 함수로 (예: approve(order) → Order | TransitionError). 암묵적 필드 대입 금지
- 해당 기능의 스펙이 projects/<이름>/docs/specs/에 있으면 INV ID를 주석으로 참조한다
