import { describe, it, expect } from "vitest";
import {
  studentSiteMeanPct,
  academyAvgAtSite,
  parsePeriod,
  isRegular,
  regularSites,
  siteRanking,
  overallTrend,
  subjectTrend,
  gradeAverages,
  subjectsOf,
  siteSummary,
  latestSite,
  type StatExam,
  type StatScore,
  type Site,
} from "./model";

// docs/specs/stats.md 의 집계 불변식(INV-ST2/ST3/ST4)을 순수 함수 단위로 검증한다.
// ST1(학원 격리)은 RLS 행동 검증이라 tests/inv/stats.integration.test.ts 에서 다룬다.
// 집계는 studentSiteMeanPct → academyAvgAtSite(프로덕션 경로) 로 흐른다 — 이 둘을 직접 검증한다.

const sc = (subject: string, score: number, max: number): StatScore => ({ subject, score, max });
const mk = (studentId: string, kind: string, period: string, grade: string, scores: StatScore[]): StatExam =>
  ({ id: `${studentId}-${kind}-${period}`, kind, period, studentId, grade, scores });
const FINAL: Site = { year: 2026, semester: 1, kind: "기말" };

describe("studentSiteMeanPct — 백분율 환산(INV-ST2) + 미응시 제외(INV-ST4)", () => {
  it("INV-ST2: 만점이 다른 점수를 백분율로 환산해 평균낸다(원점수 합산 아님)", () => {
    // 국어 80/100 = 80%, 수학 40/50 = 80% → 평균 80% (원점수 (80+40)/2 = 60 이 아님)
    expect(studentSiteMeanPct([sc("국어", 80, 100), sc("수학", 40, 50)])).toBe(80);
  });

  it("INV-ST4: 점수 미입력(NaN)·만점 0 항목은 평균에서 제외(0점 아님)", () => {
    expect(studentSiteMeanPct([sc("국어", 90, 100), sc("수학", NaN, 100), sc("영어", 50, 0)])).toBe(90);
  });

  it("INV-ST4: 유효 점수가 하나도 없으면 null(미응시) — 0 이 아니다", () => {
    expect(studentSiteMeanPct([sc("수학", NaN, 100)])).toBeNull();
    expect(studentSiteMeanPct([])).toBeNull();
  });
});

describe("academyAvgAtSite — 학생 동등 가중(INV-ST3) + 미응시 제외(INV-ST4) [프로덕션 경로]", () => {
  it("INV-ST3: 학생별 평균을 먼저 내고 그 평균들을 평균(다과목 학생 과대반영 금지)", () => {
    // A: 3과목 각 90 → 90, B: 1과목 60 → 60. 학생 동등 (90+60)/2 = 75.
    // (과목 총합÷과목수 = (90*3+60)/4 = 82.5 가 아니다)
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("국", 90, 100), sc("영", 90, 100), sc("수", 90, 100)]),
      mk("B", "기말", "2026 1학기", "중2", [sc("수", 60, 100)]),
    ];
    expect(academyAvgAtSite(exams, FINAL)).toBe(75);
  });

  it("INV-ST3(중복 방어): 같은 학생의 여러 시험 행은 한 표로만 센다", () => {
    // A 가 같은 시점에 두 행(수90 / 영90)으로 나뉘어 와도 학생 A 는 1표(평균 90).
    // B 60 → 학원평균 (90+60)/2 = 75. 중복이 안 막히면 means=[90,90,60]→80 이 됐을 것.
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 90, 100)]),
      mk("A", "기말", "2026 1학기", "중3", [sc("영", 90, 100)]),
      mk("B", "기말", "2026 1학기", "중2", [sc("수", 60, 100)]),
    ];
    expect(academyAvgAtSite(exams, FINAL)).toBe(75);
  });

  it("INV-ST4: 미응시 학생은 학원 평균에서 빠지고 끌어내리지 않는다", () => {
    // A 80, B 미응시(NaN) → B 제외, 학원평균 80 (B 를 0 으로 치면 40 이 됐을 것)
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 80, 100)]),
      mk("B", "기말", "2026 1학기", "중2", [sc("수", NaN, 100)]),
    ];
    expect(academyAvgAtSite(exams, FINAL)).toBe(80);
  });

  it("모두 미응시면 null(표시할 값 없음)", () => {
    const exams = [mk("A", "기말", "2026 1학기", "중3", [sc("수", NaN, 100)])];
    expect(academyAvgAtSite(exams, FINAL)).toBeNull();
  });
});

describe("siteRanking — 드릴다운 순위(S4: 미응시 제외 + 내림차순)", () => {
  it("미응시 학생은 순위에서 빠지고(0점 최하위 아님), 내림차순·학년 포함", () => {
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 80, 100)]),
      mk("B", "기말", "2026 1학기", "중3", [sc("수", NaN, 100)]), // 미응시
      mk("C", "기말", "2026 1학기", "중2", [sc("수", 60, 100)]),
    ];
    const r = siteRanking(exams, FINAL);
    expect(r.map((x) => x.studentId)).toEqual(["A", "C"]); // B 없음, 80 → 60 내림차순
    expect(r[0]).toEqual({ studentId: "A", grade: "중3", pct: 80 });
  });
});

describe("parsePeriod / isRegular — 정기시험 시간축 식별", () => {
  it("정기 period 'YYYY 학기' 를 (연도, 학기)로 파싱", () => {
    expect(parsePeriod("2026 1학기")).toEqual({ year: 2026, semester: 1 });
    expect(parsePeriod("2025 2학기")).toEqual({ year: 2025, semester: 2 });
  });

  it("형식이 아니면 null(비정기 날짜 등)", () => {
    expect(parsePeriod("2026.07.12")).toBeNull();
    expect(parsePeriod("")).toBeNull();
  });

  it("isRegular 은 중간·기말만 참", () => {
    expect(isRegular("중간")).toBe(true);
    expect(isRegular("기말")).toBe(true);
    expect(isRegular("학원")).toBe(false);
    expect(isRegular("모의")).toBe(false);
  });
});

describe("regularSites / overallTrend — 시점 정렬·미실시 제외·추이", () => {
  it("정기시험만, (연도→학기→중간→기말) 순으로 정렬한다", () => {
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 80, 100)]),
      mk("A", "중간", "2026 1학기", "중3", [sc("수", 70, 100)]),
      mk("A", "기말", "2025 2학기", "중3", [sc("수", 60, 100)]),
      mk("A", "학원", "2026.06.01", "중3", [sc("수", 99, 100)]), // 비정기 → 제외
    ];
    expect(regularSites(exams).map((s) => `${s.year} ${s.semester} ${s.kind}`)).toEqual([
      "2025 2 기말", "2026 1 중간", "2026 1 기말",
    ]);
  });

  it("유효 점수가 하나도 없는 정기 시점은 축에서 제외(미실시)", () => {
    const exams = [
      mk("A", "중간", "2026 1학기", "중3", [sc("수", NaN, 100)]), // 미실시
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 88, 100)]),
    ];
    expect(regularSites(exams).map((s) => s.kind)).toEqual(["기말"]);
  });

  it("overallTrend 는 시점 순 학원 평균을 낸다", () => {
    const exams = [
      mk("A", "중간", "2026 1학기", "중3", [sc("수", 70, 100)]),
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 90, 100)]),
    ];
    expect(overallTrend(exams).map((p) => `${p.site.kind}:${p.avgPct}`)).toEqual(["중간:70", "기말:90"]);
  });

  it("빈 데이터·비정기만: 추이 빈 배열, latestSite null", () => {
    expect(overallTrend([])).toEqual([]);
    expect(latestSite([])).toBeNull();
    const irregularOnly = [mk("A", "학원", "2026.06.01", "중3", [sc("수", 80, 100)])];
    expect(regularSites(irregularOnly)).toEqual([]);
    expect(latestSite(irregularOnly)).toBeNull();
  });
});

describe("subjectTrend — 과목 없는 시점은 0이 아니라 점 생략(INV-ST4 취지)", () => {
  it("영어는 기말에만 있으면 중간에 0을 찍지 않고 기말 1점만 반환", () => {
    const exams = [
      mk("A", "중간", "2026 1학기", "중3", [sc("수", 70, 100)]), // 영어 없음
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 90, 100), sc("영어", 50, 100)]),
    ];
    const st = subjectTrend(exams, "영어");
    expect(st.length).toBe(1);
    expect(`${st[0].site.kind}:${st[0].avgPct}`).toBe("기말:50");
  });
});

describe("gradeAverages — 학년별 학원 평균(현재 학년 기준)", () => {
  it("현재 학년으로 묶어 학생 동등 평균", () => {
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수", 80, 100)]),
      mk("C", "기말", "2026 1학기", "중3", [sc("수", 60, 100)]),
      mk("B", "기말", "2026 1학기", "중2", [sc("수", 70, 100)]),
    ];
    const byGrade = Object.fromEntries(gradeAverages(exams, FINAL).map((g) => [g.grade, g.avgPct]));
    expect(byGrade["중3"]).toBe(70); // (80+60)/2
    expect(byGrade["중2"]).toBe(70);
  });
});

describe("subjectsOf / siteSummary", () => {
  it("subjectsOf 는 유효 점수가 있는 과목만, 오름차순", () => {
    const exams = [
      mk("A", "중간", "2026 1학기", "중3", [sc("수학", 80, 100), sc("영어", NaN, 100)]),
      mk("B", "중간", "2026 1학기", "중2", [sc("국어", 70, 100), sc("수학", 90, 100)]),
    ];
    expect(subjectsOf(exams)).toEqual(["국어", "수학"]); // 영어는 유효 점수 없어 제외
  });

  it("siteSummary: 학원 평균·응시 수·최고 과목(INV-ST3 학생 동등)", () => {
    // A(중3): 수학90 영어70 → 80. B(중2): 수학60 → 60. 학원평균 70.
    const exams = [
      mk("A", "기말", "2026 1학기", "중3", [sc("수학", 90, 100), sc("영어", 70, 100)]),
      mk("B", "기말", "2026 1학기", "중2", [sc("수학", 60, 100)]),
    ];
    const sum = siteSummary(exams, FINAL);
    expect(sum.avgPct).toBe(70);
    expect(sum.taken).toBe(2);
    expect(sum.best).toEqual({ subject: "수학", avgPct: 75 }); // 수학 (90+60)/2=75 > 영어 70
  });
});

// ── 시험 식별 문자열의 형식 (쓰는 쪽: entities/exam-score) ───────────────────
// stats 는 자족 슬라이스라 exam-score 를 import 할 수 없다(FSD 동일 레이어 금지).
// 그래서 형식 계약을 코드가 아니라 **같은 문자열 리터럴**로 양쪽 테스트에 고정한다.
// 아래 "2026 1학기" 는 exam-score/model.test.ts 의 formatRegularPeriod 테스트와 짝이다.
// 한쪽 형식만 바꾸면 반대쪽 테스트가 깨진다 — 조용히 갈라지면 정기시험이 통계에서 사라진다.
describe("period 형식 계약 — exam-score 가 쓰고 stats 가 읽는다", () => {
  it("exam-score 의 formatRegularPeriod('2026','1학기') 산출물을 읽어낸다", () => {
    expect(parsePeriod("2026 1학기")).toEqual({ year: 2026, semester: 1 });
  });

  it("exam-score 의 formatRegularExamName 산출물은 period 가 아니다 — 섞이지 않는다", () => {
    expect(parsePeriod("1학기 중간고사")).toBeNull();
  });

  it("비정기 period(점 찍힌 날짜)는 정기 시점으로 읽지 않는다", () => {
    expect(parsePeriod("2026.08.05")).toBeNull();
  });

  it("정기 종류 판정도 exam-score 와 같은 집합이어야 한다", () => {
    expect(isRegular("중간")).toBe(true);
    expect(isRegular("기말")).toBe(true);
    expect(isRegular("학원")).toBe(false);
    expect(isRegular("모의")).toBe(false);
  });
});
