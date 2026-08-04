import { describe, it, expect } from "vitest";
import {
  ageFromBirthDate,
  gradeFromBirthDate,
  effectiveGrade,
  gradeNumberOf,
  summarizeEvaluations,
  GRADE_LADDER,
  type Student,
} from "./model";

// 나이·학년은 오늘 날짜에 따라 변하는 파생값(시변 상태)이므로 today 를 주입해 고정 시점으로 검증한다.
// 위험 지점 셋: (1) 한국 학년도 3월 경계, (2) 보정 오프셋이 상수라는 성질, (3) 사다리 범위 밖(미취학·졸업).
const at = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

describe("ageFromBirthDate — 만 나이", () => {
  it("생일이 지났으면 연도 차 그대로", () => {
    expect(ageFromBirthDate("2011-04-12", at(2026, 8, 1))).toBe(15);
  });

  it("생일 전이면 한 살 적다", () => {
    expect(ageFromBirthDate("2011-04-12", at(2026, 3, 1))).toBe(14);
  });

  it("생일 당일은 이미 지난 것으로 센다", () => {
    expect(ageFromBirthDate("2011-04-12", at(2026, 4, 12))).toBe(15);
  });

  it("잘못된 날짜 문자열은 null (0살로 표시하지 않는다)", () => {
    expect(ageFromBirthDate("", at(2026, 8, 1))).toBeNull();
    expect(ageFromBirthDate("모름", at(2026, 8, 1))).toBeNull();
  });

  it("미래 생년월일은 null (음수 나이 금지)", () => {
    expect(ageFromBirthDate("2030-05-05", at(2026, 8, 1))).toBeNull();
  });
});

describe("gradeFromBirthDate — 학년도 3월 경계", () => {
  it("3월 1일부터 새 학년도: 같은 학생이 2/28 엔 중2, 3/1 엔 중3", () => {
    expect(gradeFromBirthDate("2011-04-12", at(2026, 2, 28))).toBe("중2");
    expect(gradeFromBirthDate("2011-04-12", at(2026, 3, 1))).toBe("중3");
  });

  it("초1 진입도 3월 경계를 따른다 (2월엔 아직 미취학 → null)", () => {
    expect(gradeFromBirthDate("2019-05-05", at(2026, 3, 1))).toBe("초1");
    expect(gradeFromBirthDate("2019-05-05", at(2026, 2, 28))).toBeNull();
  });

  it("사다리 범위 밖(졸업)은 null — 상위에서 보정해야 한다", () => {
    expect(gradeFromBirthDate("2007-05-05", at(2026, 3, 1))).toBeNull(); // 고3 다음 학년도
  });

  it("잘못된 날짜는 null", () => {
    expect(gradeFromBirthDate("모름", at(2026, 3, 1))).toBeNull();
  });
});

describe("effectiveGrade — 표준 학년 + 보정 오프셋", () => {
  it("오프셋 0 은 자동 학년과 같다", () => {
    expect(effectiveGrade("2011-04-12", 0, at(2026, 3, 1))).toBe("중3");
  });

  it("유급(-1)·조기입학(+1) 이 사다리를 한 칸씩 움직인다", () => {
    expect(effectiveGrade("2011-04-12", -1, at(2026, 3, 1))).toBe("중2");
    expect(effectiveGrade("2011-04-12", 1, at(2026, 3, 1))).toBe("고1");
  });

  it("오프셋은 상수라 매년 자동으로 함께 진급한다 (고정 학년 저장이 아님)", () => {
    expect(effectiveGrade("2011-04-12", -1, at(2026, 3, 1))).toBe("중2");
    expect(effectiveGrade("2011-04-12", -1, at(2027, 3, 1))).toBe("중3");
  });

  it("보정 결과가 사다리 밖이면 '미정' (고3 위·초1 아래 없음)", () => {
    expect(effectiveGrade("2008-05-05", 0, at(2026, 3, 1))).toBe("고3");
    expect(effectiveGrade("2008-05-05", 1, at(2026, 3, 1))).toBe("미정");
    expect(effectiveGrade("2019-05-05", -1, at(2026, 3, 1))).toBe("미정");
  });

  it("잘못된 날짜는 '미정' (빈 문자열로 새지 않는다)", () => {
    expect(effectiveGrade("모름", 0, at(2026, 3, 1))).toBe("미정");
  });
});

describe("gradeNumberOf — 라벨 → 학년 번호 역변환", () => {
  it("사다리의 모든 라벨이 인덱스+1 로 왕복한다 (초1=1 … 고3=12)", () => {
    expect(GRADE_LADDER.map((label) => gradeNumberOf(label))).toEqual(
      GRADE_LADDER.map((_, i) => i + 1),
    );
  });

  it("사다리에 없는 라벨은 null", () => {
    expect(gradeNumberOf("대1")).toBeNull();
    expect(gradeNumberOf("미정")).toBeNull();
    expect(gradeNumberOf("")).toBeNull();
  });

  it("역변환은 effectiveGrade 의 오프셋 계산과 맞물린다 (중3 - 중2 = 오프셋 1)", () => {
    const auto = gradeNumberOf(effectiveGrade("2011-04-12", 0, at(2026, 3, 1)));
    const held = gradeNumberOf(effectiveGrade("2011-04-12", -1, at(2026, 3, 1)));
    expect(auto).not.toBeNull();
    expect(held).not.toBeNull();
    expect((auto ?? 0) - (held ?? 0)).toBe(1);
  });
});

describe("summarizeEvaluations — 평가 완료 요약", () => {
  const stu = (id: string, evalStatus: Student["evalStatus"]): Student => ({
    id,
    name: `학생${id}`,
    grade: "중3",
    school: "면목중",
    subjects: ["수학"],
    lastEvalMonth: "2026.07",
    evalStatus,
  });

  it("완료 수와 백분율(반올림)을 낸다", () => {
    const s = summarizeEvaluations([stu("1", "done"), stu("2", "done"), stu("3", "waiting")]);
    expect(s).toEqual({ total: 3, done: 2, pct: 67 }); // 66.6…% → 67
  });

  it("학생이 없으면 0으로 나누지 않고 pct 0", () => {
    expect(summarizeEvaluations([])).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it("전원 완료면 100", () => {
    expect(summarizeEvaluations([stu("1", "done")]).pct).toBe(100);
  });
});
