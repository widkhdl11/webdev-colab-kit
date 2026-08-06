---
name: skill-manager
description: Use when the user wants to see which skill bundles are available to pull from their my-skills repo, pull a bundle into the current project's .claude/skills/ folder, or generate a human-readable inventory document (SKILL-SUMMARY.md) describing the skills currently installed in the project. Trigger on requests like "가져올 수 있는 꾸러미 보여줘", "collab-kit 꾸러미 가져와", "스킬 설명 문서 만들어줘", "이 프로젝트에 무슨 스킬 있어".
---

# skill-manager

프로젝트에서 스킬 꾸러미를 가져오고, 무엇이 설치돼 있는지 문서로 정리하는 도구.

창고(my-skills repo)는 GitHub에 있고, 이 스킬이 필요할 때 임시로 clone해서 필요한 꾸러미만 현재 프로젝트의 `.claude/skills/`로 복사한다.

## 세 가지 기능

이 스킬은 `scripts/` 안의 세 스크립트로 동작한다. 사용자의 요청에 따라 알맞은 것을 `node`로 실행한다.

### 1. 꾸러미 목록 확인

사용자가 "가져올 수 있는 꾸러미 보여줘" / "무슨 꾸러미 있어" 같이 물으면:

```bash
node scripts/list.mjs
```

창고의 `bundles/` 밑 꾸러미들과 각 꾸러미의 스킬 목록을 출력한다.

### 2. 꾸러미 가져오기

사용자가 "<꾸러미> 가져와" / "이 프로젝트에 <꾸러미> 설치해줘" 라고 하면,
**현재 프로젝트 루트에서** 실행한다 (복사 대상이 `cwd`의 `.claude/skills/`이므로):

```bash
node scripts/pull.mjs <꾸러미이름>
```

여러 개면 공백으로 나열: `node scripts/pull.mjs collab-kit-graph study-mate-skills`

가져온 뒤에는 이어서 문서 생성(3번)을 제안한다.

### 3. 설명 문서 만들기

사용자가 "스킬 설명 문서 만들어줘" / "뭐가 설치됐는지 정리해줘" 라고 하면,
설명 문서는 12살에게 설명하듯 풀어서 이해하기 쉽게 설명해야하며, 너무 길어서도 안된다.
그리고 추상적인 표현자제, 영어를 바로 번역한듯한 어휘와 문체 금지
**현재 프로젝트 루트에서** 실행한다:

```bash
node scripts/doc.mjs
```

현재 `.claude/skills/`의 스킬들을 스캔해서 프로젝트 루트에 `SKILL-SUMMARY.md`를
생성/갱신한다. 각 스킬의 이름, 설명, 추가일이 표로 정리된다.

문서가 생성되면, 사용자가 이해하기 쉽도록 각 스킬을 한 줄로 요약해서
대화로도 함께 보여준다.

## 실행 위치 주의

- `pull.mjs`와 `doc.mjs`는 **현재 작업 폴더(cwd)**의 `.claude/skills/`를 기준으로
  동작한다. 반드시 프로젝트 루트에서 실행할 것.
- 스크립트 경로는 이 스킬이 설치된 위치 기준이다. 실행 전 스크립트의 실제
  경로를 확인하고, 필요하면 절대경로로 호출한다.

## 창고 주소 변경

창고 repo 주소는 `list.mjs`와 `pull.mjs` 상단의 `REPO` 상수에 있다.
GitHub 계정명이나 repo 이름이 바뀌면 두 파일의 `REPO`를 함께 수정한다.
private repo이므로 실행하는 컴퓨터에 SSH 인증(`ssh -T git@github.com`)이
설정돼 있어야 한다.
