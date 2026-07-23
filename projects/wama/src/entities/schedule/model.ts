// 학생 시간표 표시용 읽기 모델. 과목·요일·시간대 — 학생마다 상이.
export type Weekday = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export interface ScheduleSlot {
  readonly id: string;
  readonly subject: string;
  readonly weekday: Weekday;
  readonly start: string; // "17:00"
  readonly end: string; // "18:30"
  readonly teacher: string;
}
