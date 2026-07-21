# Supabase 연동 설정 (호스티드)

env가 없으면 앱은 **인메모리 로컬 데모**로 그대로 돌아갑니다. 아래는 실제 서버 강제 모드로 붙이는 절차.

## 1. 프로젝트 생성
1. https://supabase.com 에서 프로젝트 생성 (무료 티어).
2. **Project Settings → API** 에서 `Project URL`과 `anon public` 키 복사.

## 2. env 설정
프로젝트 루트에 `.env` 생성 (`.env.example` 복사):
```
VITE_SUPABASE_URL=https://<프로젝트-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-키>
```
> `service_role`(서버 전용) 키는 넣지 마세요 — 클라이언트 번들엔 anon 키만.

## 3. 스키마 + 시드 적용
Supabase 대시보드 **SQL Editor**에서 순서대로 실행:
1. `supabase/migrations/0001_init.sql` (테이블·RPC·RLS)
2. `supabase/seed.sql` (데모 계정·샘플 펀딩)

## 4. 실행
```
npm run dev
```
콘솔에 `데이터 모드: Supabase(서버)` 가 찍히면 연결된 겁니다 (`인메모리(로컬 데모)`면 env 미인식).

## 서버가 강제하는 것 (docs/specs/funding.md)
- 모든 금융 연산(차감·정산·소각·상태전이)은 RPC(`open_funding`/`contribute`/`settle_expired_all`) 안에서만 — 단일 트랜잭션·행 잠금(INV-CONC-1 원자성).
- 테이블은 RLS로 **읽기만** 허용 — 클라이언트 직접 write 차단(INV-ACC-1). 쓰기는 `SECURITY DEFINER` RPC로만.
- 클라이언트가 보낸 금액·펀딩id·사용자id는 신뢰하지 않고 서버에서 재검증.

## 데모 범위의 한계 (정직하게)
- **실제 로그인 없음** — "현재 계정"은 클라이언트가 고르는 데모 닉네임이고 RPC에 파라미터로 넘어갑니다. 돈 규칙(잔액/상한/자기펀딩/동시성)은 서버가 강제하지만, *행위자 신원*은 데모라 신뢰합니다. 실제 인증(Supabase Auth + auth.uid 기반 RLS)은 비범위.
