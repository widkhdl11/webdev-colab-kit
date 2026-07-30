# LESSONS.md — 승인된 교훈 (retro 절차로만 갱신 — 훅이 직접 수정을 차단함)

형식: 날짜 | 패턴 | 근거 | 반영 위치 (permissions / 게이트 / rules / CLAUDE.md)

## 2026-07-24 — RLS 격리는 구조 검증만으론 불충분

- 증상: 정책 표현식(academy_id=current_academy_id())이 스펙과 일치해 "검증 통과"로 봤으나, security definer
  함수의 `set search_path=public`이 pg_temp 섀도잉을 못 막아 격리가 실제로는 우회 가능했다.
- 교훈: (1) 모든 security definer 함수는 `set search_path=''` + 스키마 완전 한정. (2) RLS/인가는 정책이 "있다"가
  아니라 두 테넌트 세션으로 "새지 않는다"를 행동으로 증명해야 한다. (3) 프리미티브 함수(current_academy_id 등)는
  적대적 입력(temp table 섀도잉)까지 테스트.
