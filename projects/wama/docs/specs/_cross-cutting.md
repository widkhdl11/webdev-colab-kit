# 횡단 미결 사항 (cross-cutting)

> 여러 기능에 걸친 미결 플래그 모음. 한 스펙에 넣으면 거짓, 쪼개면 발명이라 여기 산다.
> 각 항목은 관련 기능의 `/spec` 인터뷰에서 반드시 다룬다. 결정되면 해당 스펙(들)에
> 정식으로 적고 여기서 지운다 — 이 파일이 비는 것이 목표.
> 원문 출처: PRODUCT.md 모델링 플래그 (2026-07-23, modeling-checklist 훑기) — 문구 발명 없이 이주.

## 미결 항목

- 🟡 **학원(academy) 필드 = 학원명·지점명·전화번호** (인증 시안에서 확정). 지점명 도입 →
  **학원↔지점 카디널리티 미정**: 한 학원에 여러 지점이면 지점이 별도 엔티티(1:N)이고 격리 단위가
  학원인지 지점인지 auth-isolation 스펙에 영향. → **결정 필요 + auth-isolation 스펙에서 확정**
  <!-- 관련: auth-isolation(봉인됨 — 확정 시 재승인 절차 필요) -->
- 🟡 **과목(subject) 자유문자열 → 엔티티/코드화 검토**. rename 소급 안 됨·통계 분열 위험. → **결정 필요(DECISIONS)**
  <!-- 관련: schedule · evaluation · exam-score -->
  <!-- stats 소진(2026-07-31, /spec stats): 통계는 저장 문자열 그대로 그룹, 병합·정규화 안 함(비범위). 근거 DECISIONS 2026-07-25. -->
- 🟡 **유일성·중복**: 동명이인 구별 수단 / 시간표 시간 겹침 / 시험 중복 입력. → **스펙(중복 방지) + UI(동명이인 구별)**
  <!-- 관련: student-registration · schedule · exam-score -->
- 🟡 **기준 시점·단위**: 진급 기준일 3/1(Asia/Seoul) · "이번 달" 시간대. → **스펙에 포함**
  <!-- 관련: student-registration(학년 파생) · evaluation("이번 달") -->
  <!-- 점수 단위/만점 가변 소진(2026-07-31, /spec stats): 통계는 (score/max_score)×100 백분율 환산 후 집계(INV-ST2). max_score는 exam_score 행별 저장(0007). -->
- 🟡 **교차 테이블 학원 무결성** (security-reviewer 2026-07-24, LOW-MEDIUM, 이월). evaluation/schedule의
  student_id가 타 학원 학생을 가리켜도 RLS는 academy_id만 보므로 통과 → 내 학원 밑에 타 학원 학생 참조 행 생성
  가능(직접 유출 아님, 무결성 오염). 지금은 student/schedule/evaluation이 목업 repo라 미도달. → **student·시간표·
  평가 데이터 계층 배선 시** guard/정책에 "참조 student의 academy = current_academy_id()" 검증 추가.
  <!-- 관련: auth-isolation(뿌리) · schedule · evaluation — 데이터 계층 배선 시점에 발동 -->
<!-- 소진됨(2026-08-03, /spec payment-notice-export):
     · 전학 시 과거 학교 이력 → 남기지 않음(현재값만, 발행 스냅샷 없음).
     · 돈 값의 단위·신뢰 → 원 정수 고정, 학생엔 총액 아닌 (과목→월정액) 예외만, 내보내기 수정은 저장 안 함.
     기록처: payment-notice-export.md(INV-PN2/PN5/PN6·규칙) · student-registration.md(횡단 결정 이관 주석) -->

## 미이주 참고

- 구 PRODUCT "참고 데이터모델"의 academy·teacher·schedule 나열 — 트리비얼이라 이주 생략
  (엔티티별 절은 각 스펙으로 이주 완료). 원문 필요 시: `git show a0c88ee:projects/wama/docs/PRODUCT.md`
