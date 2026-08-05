import { describe, it, expect } from "vitest";
import {
  examAvgPct, summarizeScores, isIrregularKind,
  formatRegularPeriod, formatRegularExamName, parseRegularPeriod,
  formatIrregularPeriod, parseIrregularPeriod,
  type Exam, type SubjectScore,
} from "./model";

// 성적 카드의 파생값 단위 검증. 만점이 시험마다 다르므로 백분율 환산이 전제이고,
// 레거시·미입력으로 max<=0 인 행이 섞여 들어와도 NaN/Infinity 로 새지 않아야 한다.
const sc = (subject: string, score: number, max: number): SubjectScore => ({ subject, score, max });
const mk = (id: string, scores: SubjectScore[]): Exam => ({
  id,
  examName: `${id} 시험`,
  kind: "중간",
  period: "2026 1학기",
  scores,
});

describe("examAvgPct — 한 시험의 과목 평균 백분율", () => {
  it("만점이 다른 과목을 백분율로 환산해 평균낸다 (원점수 평균 아님)", () => {
    // 국어 80/100 = 80%, 수학 40/50 = 80% → 80% (원점수 (80+40)/2 = 60 이 아님)
    expect(examAvgPct(mk("e1", [sc("국어", 80, 100), sc("수학", 40, 50)]))).toBe(80);
  });

  it("max<=0 과목은 분모에서 제외한다 (0점 취급도, NaN/Infinity 도 아님)", () => {
    const v = examAvgPct(mk("e1", [sc("국어", 90, 100), sc("수학", 50, 0)]));
    expect(v).toBe(90);
    expect(Number.isFinite(v)).toBe(true);
  });

  it("유효 과목이 하나도 없으면 0", () => {
    expect(examAvgPct(mk("e1", [sc("수학", 50, 0)]))).toBe(0);
    expect(examAvgPct(mk("e2", []))).toBe(0);
  });

  it("정수로 반올림한다", () => {
    expect(examAvgPct(mk("e1", [sc("수학", 1, 3)]))).toBe(33); // 33.33…
    expect(examAvgPct(mk("e2", [sc("국어", 70, 100), sc("수학", 75, 100)]))).toBe(73); // 72.5
  });
});

describe("summarizeScores — 시험 단위 요약", () => {
  it("count 는 과목 쌍이 아니라 시험 수", () => {
    const exams = [
      mk("e1", [sc("국어", 80, 100), sc("수학", 80, 100)]),
      mk("e2", [sc("국어", 60, 100), sc("수학", 60, 100)]),
    ];
    expect(summarizeScores(exams).count).toBe(2);
  });

  it("각 시험의 과목 평균을 낸 뒤 시험들끼리 평균·최고를 낸다", () => {
    const exams = [
      mk("e1", [sc("국어", 100, 100), sc("수학", 60, 100)]), // 80
      mk("e2", [sc("국어", 60, 100), sc("수학", 60, 100)]), // 60
    ];
    expect(summarizeScores(exams)).toEqual({ count: 2, avgPct: 70, bestPct: 80 });
  });

  it("백분율이 정의되지 않는 시험(max<=0 뿐)은 평균·최고에서 빠지되 count 에는 남는다", () => {
    const exams = [
      mk("e1", [sc("국어", 80, 100)]), // 80
      mk("e2", [sc("수학", 50, 0)]), // 백분율 미정의 → 평균에서 제외 (0 으로 끌어내리지 않음)
    ];
    expect(summarizeScores(exams)).toEqual({ count: 2, avgPct: 80, bestPct: 80 });
  });

  it("시험이 없으면 전부 0", () => {
    expect(summarizeScores([])).toEqual({ count: 0, avgPct: 0, bestPct: 0 });
  });

  it("전부 백분율 미정의면 count 만 남고 평균·최고는 0", () => {
    expect(summarizeScores([mk("e1", [sc("수학", 50, 0)])])).toEqual({
      count: 1,
      avgPct: 0,
      bestPct: 0,
    });
  });
});

// ── 시험 식별 문자열의 형식 ──────────────────────────────────────────────────
// 이 슬라이스가 period·examName 을 **쓰는 쪽**이다. 읽는 쪽은 entities/stats 의 parsePeriod 이고,
// stats 는 자족 슬라이스라(FSD 동일 레이어 import 금지) 이 함수들을 가져다 쓸 수 없다.
// 그래서 형식을 코드로 공유하는 대신 **양쪽 테스트에 같은 문자열 리터럴을 박아** 고정한다.
// 여기 "2026 1학기" 를 바꾸면 stats/model.test.ts 의 짝 테스트가 깨져야 한다 —
// 조용히 갈라지면 통계에서 시험이 통째로 사라진다(정기시험으로 인식 안 됨).
describe("정기/비정기 시험 식별 문자열 (읽는 쪽: entities/stats parsePeriod)", () => {
  it("정기 period 는 'YYYY N학기'", () => {
    expect(formatRegularPeriod("2026", "1학기")).toBe("2026 1학기");
  });

  it("정기 시험명은 'N학기 X고사'", () => {
    expect(formatRegularExamName("1학기", "중간")).toBe("1학기 중간고사");
    expect(formatRegularExamName("2학기", "기말")).toBe("2학기 기말고사");
  });

  it("정기 period 를 폼 값으로 되돌린다 (수정 화면 프리필)", () => {
    expect(parseRegularPeriod("2026 1학기")).toEqual({ year: "2026", semester: "1학기" });
  });

  it("정기 형식이 아니면 되돌리지 않는다", () => {
    expect(parseRegularPeriod("2026.08.05")).toBeNull();
    expect(parseRegularPeriod("2026 3학기")).toBeNull();
    expect(parseRegularPeriod("")).toBeNull();
  });

  it("비정기 period 는 날짜를 점으로 — 폼의 date 값과 오간다", () => {
    expect(formatIrregularPeriod("2026-08-05")).toBe("2026.08.05");
    expect(parseIrregularPeriod("2026.08.05")).toBe("2026-08-05");
  });

  it("학원·모의는 비정기, 중간·기말은 정기다", () => {
    expect(isIrregularKind("학원")).toBe(true);
    expect(isIrregularKind("모의")).toBe(true);
    expect(isIrregularKind("중간")).toBe(false);
    expect(isIrregularKind("기말")).toBe(false);
  });
});
