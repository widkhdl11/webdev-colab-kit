import { describe, it, expect } from "vitest";
import {
  ageFromBirthDate,
  gradeFromBirthDate,
  effectiveGrade,
  gradeOffsetFor,
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

// 학년 "직접 지정"의 오프셋 계산. 화면(student-form)이 들고 있던 규칙을 여기로 옮긴 것이다.
//
// 화면 버전은 표준 학년을 **라벨로 바꿨다가 되돌리는** 경로였다(gradeFromBirthDate → gradeNumberOf).
// 사다리 밖(미취학·졸업)은 라벨이 없어 null 이 되고 오프셋이 0 으로 뭉개졌다.
// 그런데 바로 그때 화면은 "표준 학년 범위를 벗어남 — 직접 지정하세요"라고 안내한다.
// 즉 **화면이 시킨 행동이 100% 실패**했다: 학년을 골라 저장해도 다시 "미정"이 됐다.
describe("gradeOffsetFor — 지정한 학년이 그대로 유지되는 오프셋", () => {
  it("표준보다 한 학년 위를 고르면 +1", () => {
    expect(gradeOffsetFor("2011-04-12", "고1", at(2026, 3, 1))).toBe(1); // 표준 중3
  });

  it("표준과 같은 학년을 고르면 0", () => {
    expect(gradeOffsetFor("2011-04-12", "중3", at(2026, 3, 1))).toBe(0);
  });

  it("유급은 음수", () => {
    expect(gradeOffsetFor("2011-04-12", "중2", at(2026, 3, 1))).toBe(-1);
  });

  it("표준 학년이 사다리 밖이어도 지정한 학년이 유지된다", () => {
    // 2020년생은 2026 학년도 기준 표준 번호가 0 — 라벨이 없다(초1 미만).
    expect(gradeFromBirthDate("2020-05-05", at(2026, 3, 1))).toBeNull();
    const offset = gradeOffsetFor("2020-05-05", "초1", at(2026, 3, 1));
    expect(effectiveGrade("2020-05-05", offset, at(2026, 3, 1))).toBe("초1");
  });

  it("졸업 쪽으로 벗어나도 마찬가지다", () => {
    expect(gradeFromBirthDate("2007-05-05", at(2026, 3, 1))).toBeNull(); // 고3 다음
    const offset = gradeOffsetFor("2007-05-05", "고3", at(2026, 3, 1));
    expect(effectiveGrade("2007-05-05", offset, at(2026, 3, 1))).toBe("고3");
  });

  it("고른 학년은 이듬해에 한 학년 올라간다 — 오프셋은 상수라 함께 진급한다", () => {
    const offset = gradeOffsetFor("2011-04-12", "고1", at(2026, 3, 1));
    expect(effectiveGrade("2011-04-12", offset, at(2027, 3, 1))).toBe("고2");
  });

  it("생년월일이 없거나 잘못됐으면 보정하지 않는다(0)", () => {
    expect(gradeOffsetFor("", "중1", at(2026, 3, 1))).toBe(0);
    expect(gradeOffsetFor("모름", "중1", at(2026, 3, 1))).toBe(0);
  });

  it("사다리에 없는 학년 라벨이면 보정하지 않는다(0)", () => {
    expect(gradeOffsetFor("2011-04-12", "대1", at(2026, 3, 1))).toBe(0);
  });
});
