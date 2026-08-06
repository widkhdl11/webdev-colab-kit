# 설치된 스킬 목록

> 생성일: 2026-08-06 · 총 12개 · 대상: `.claude/skills/`

## 한눈에 보기

| 스킬 | 무슨 일을 하나 | 부르는 법 | 추가일 |
|------|----------------|-----------|--------|
| `checkpoint` | 화면을 하나만 먼저 만들어 보여주고, 이 방향이 맞는지 확인받는다. | 자동 | 2026-07-30 |
| `design-interview` | 새 화면을 만들기 전에 어떤 느낌·색·빽빽함이 좋은지 골라가며 물어본다. | 자동 | 2026-07-30 |
| `goal` | 오늘 뭘 할지 적어두고, 나중에 다시 꺼내 본다. | `/goal` 로 직접 | 2026-07-30 |
| `kickoff` | '이런 거 만들고 싶어'에서 시작해, 뭘 만들지 같이 정리하고 문서로 남긴다. | 자동 | 2026-08-06 |
| `retro` | 같은 실수가 또 났을 때, 다음엔 안 그러도록 규칙 자체를 고친다. | 자동 | 2026-07-23 |
| `scaffold` | 새 프로젝트가 쓸 폴더와 기본 설정 파일을 한 번에 만든다. | `/scaffold` 로 직접 | 2026-07-21 |
| `setup` | 만들 것이 정해진 뒤, 이 프로젝트에 맞는 규칙과 자동 검사를 준비한다. | 자동 | 2026-07-30 |
| `skill-manager` | 스킬을 창고에서 가져오고, 지금 뭐가 깔렸는지 이 문서로 정리한다. | 자동 | 2026-08-05 |
| `spec` | 돈·로그인·권한처럼 틀리면 사고 나는 기능은, 만들기 전에 지켜야 할 규칙부터 못 박는다. | 자동 | 2026-07-31 |
| `status` | 지금 어디까지 했는지 다시 본다. | `/status` 로 직접 | 2026-07-07 |
| `supabase-postgres-best-practices` | 데이터베이스 표를 만들거나 권한을 건드리기 전에, 안전한 방법을 먼저 확인한다. | 자동 | 2026-08-04 |
| `wrap-up` | 일을 멈추기 전에, 다음에 이어서 할 수 있도록 상태를 적어둔다. | 자동 | 2026-07-30 |

## 스킬 파일에 적힌 원래 설명

모델이 "지금 이 스킬을 꺼낼까"를 판단할 때 읽는 문장입니다. 위의 쉬운 설명과 달리 사람이 읽으라고 쓴 글이 아닙니다.

### `checkpoint`

페이지나 주요 UI 컴포넌트를 처음 만들기 시작할 때, 또는 사용자가 "일단 ~까지만 만들어서 보여줘"라고 할 때 사용. 대표 결과물 하나를 먼저 제출해 시각적 방향 승인을 받는 절차. 이미 승인된 방향의 반복 작업에는 불필요.

### `design-interview`

새 시각 방향의 화면을 만들기 전, 디자인 취향을 깊게 상담할 때 사용. 빈 질문이 아니라 선택지·예시가 채워진 양식을 문서 반복으로 수렴시킨다. 결론은 시안(design-drafter)의 입력이 되고, 승인 후 design-rules.md 로 확정된다. 이미 승인된 방향의 반복 화면에는 쓰지 않는다(빠른 경로)

### `goal`

세션 목표를 설정하거나 확인한다

### `kickoff`

사용자가 새 웹사이트나 기능을 "만들고 싶다"고 말했는데 활성 프로젝트가 없거나 PRODUCT.md가 비어있거나 해당 내용이 없을 때 사용. 대화 인터뷰로 요구를 구체화해 PRODUCT.md를 함께 작성하는 절차. 이미 PRODUCT.md에 있는 작업의 구현 요청에는 사용하지 않는다.

### `retro`

기능 완성 후, 반복 실수가 있을 때, 구조적 하네스 결함(물어볼 자리가 없던 빈칸)을 1회라도 발견했을 때, 또는 사용자가 회고를 요청할 때 사용. 판단 실수·재량적 예외는 빼고 구조적 빈칸만 하네스에 반영하는 절차.

### `scaffold`

프로젝트 골격(FSD 6레이어 + tsconfig + 워킹 스켈레톤)을 생성한다

### `setup`

kickoff로 PRODUCT.md가 승인된 직후 사용. 프로젝트 특성에 맞춰 하네스 구성(rules, 서브에이전트, 게이트 규칙)을 제안하고 사용자 승인 후 생성한 뒤, 스캐폴딩을 실행하는 절차. 킷 기본 구성이 충분하면 아무것도 만들지 않는다.

### `skill-manager`

Use when the user wants to see which skill bundles are available to pull from their my-skills repo, pull a bundle into the current project's .claude/skills/ folder, or generate a human-readable inventory document (SKILLS.md) describing the skills currently installed in the project. Trigger on requests like "가져올 수 있는 꾸러미 보여줘", "collab-kit 꾸러미 가져와", "스킬 설명 문서 만들어줘", "이 프로젝트에 무슨 스킬 있어".

### `spec`

결제·인증·권한·동시성, 또는 시간에 따라 변하는 상태·파생 속성처럼 어기면 사고가 나는 기능의 구현 전에 사용. 사용자와 인터뷰하며 동작·불변식 스펙 문서를 작성하고 승인받는 절차. 단순 UI/콘텐츠 기능에는 사용하지 않는다.

### `status`

현재 프로젝트 상태 브리핑을 다시 본다

### `supabase-postgres-best-practices`

Postgres best practices maintained by Supabase, for Postgres running anywhere. Load this skill BEFORE writing or changing anything that lives in a Postgres database: creating or altering tables and columns (including choosing column types), schema design, migrations and declarative schema files, RLS policies and the tests that verify them, indexes, triggers, database functions, queues and scheduled jobs (pg_cron, pgmq), vector/semantic search (pgvector), and restoring dumps (pg_restore) or importing data. Also load it when diagnosing slow queries, high CPU, timeouts, EXPLAIN plans, connection exhaustion, locking, bloat, or rows visible to the wrong user or tenant. This is not just a performance guide — schema, migration, security, and SQL authoring tasks need these rules too, even for a one-column change or a single query.

### `wrap-up`

사용자가 "오늘은 여기까지", "정리하자"라고 하거나 세션을 끝내려는 신호를 보일 때 사용. /wrap-up으로 직접 호출도 가능. 다음 세션이 이어받도록 상태를 동결하는 절차.

---

이 문서는 `node .claude/skills/skill-manager/scripts/doc.mjs` 가 만듭니다. 직접 고쳐도 다음 실행 때 덮어써집니다.
쉬운 설명을 바꾸려면 `.claude/skills/skill-manager/easy-descriptions.json` 을 고치세요.
