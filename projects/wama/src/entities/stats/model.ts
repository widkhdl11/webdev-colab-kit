// 성적 통계 집계 — 순수 도메인 함수. UI·네트워크 없음(entities). 표시 레이어가 아니라 여기서 계산한다.
// docs/specs/stats.md 의 불변식을 구현한다:
//   INV-ST2: 점수는 집계 전 백분율((score/max)×100)로 환산 — 만점 다른 점수를 원점수로 섞지 않는다.
//   INV-ST3: 평균은 학생별 평균을 먼저 내고 그 평균들을 평균(학생 동등 가중) — 과목 총합÷과목수 금지.
//   INV-ST4: 유효 점수 없는 항목(미응시)은 제외하고 0으로 대체하지 않는다.
//   (INV-ST1 학원 격리는 RLS 행동 검증 — tests/inv/stats.integration.test.ts)
// 집계는 studentSiteMeanPct(학생 시점 평균) → academyAvgAtSite(학생 평균들의 평균) 한 경로로만 흐른다.

// 통계 집계의 입력 단위 — 타 슬라이스(exam-score/student) 타입에 의존하지 않도록 자체 정의한다(FSD: 슬라이스 자족).
// 한 시험(학생 1명, 과목 N개) + 학생의 현재 학년(페이지가 student read-model에서 주입).
export interface StatScore {
  readonly subject: string;
  readonly score: number; // 취득 점수 (미응시는 NaN — 유효성은 validScores 가 판정)
  readonly max: number; // 만점
}
export interface StatExam {
  readonly id: string;
  readonly kind: string; // "중간"|"기말"|"학원"|"모의" — 통계는 중간/기말만 정기로 취급
  readonly period: string; // 정기: "YYYY 학기", 비정기: "YYYY.MM.DD"
  readonly studentId: string;
  readonly grade: string; // 조회 시점 현재 학년. 저장 스냅샷 아님(페이지가 주입).
  readonly scores: readonly StatScore[];
}

// 정기시험 한 시점 = (연도, 학기, 중간/기말). 꺾은선 축의 한 점.
export type RegularKind = "중간" | "기말";
export interface Site {
  readonly year: number;
  readonly semester: number;
  readonly kind: RegularKind;
}

const validScores = (scores: readonly StatScore[]): StatScore[] =>
  // INV-ST2 분모 방어 + INV-ST4: 만점>0 이고 점수가 실수인 것만(미입력 NaN·만점0 제외).
  scores.filter((s) => s.max > 0 && Number.isFinite(s.score));

const meanOf = (xs: readonly number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

// 한 학생의 한 시점 평균 백분율. INV-ST2(백분율 환산) + INV-ST4(미응시 제외).
// 유효 점수가 하나도 없으면 null(미응시) — 0 으로 대체하지 않는다.
export function studentSiteMeanPct(scores: readonly StatScore[]): number | null {
  const valid = validScores(scores);
  return meanOf(valid.map((s) => (s.score / s.max) * 100));
}

export function isRegular(kind: string): boolean {
  return kind === "중간" || kind === "기말";
}

// 정기 period "YYYY 학기" → {year, semester}. 형식이 아니면 null(비정기 날짜 등).
export function parsePeriod(period: string): { year: number; semester: number } | null {
  const m = /^(\d{4})\s+([12])학기$/.exec(period.trim());
  if (!m) return null;
  return { year: Number(m[1]), semester: Number(m[2]) };
}

// 정기시험 한 건의 시점. 비정기·형식 불일치면 null.
export function siteOf(exam: StatExam): Site | null {
  if (!isRegular(exam.kind)) return null;
  const p = parsePeriod(exam.period);
  if (!p) return null;
  return { year: p.year, semester: p.semester, kind: exam.kind as RegularKind };
}

const siteKey = (s: Site): string => `${s.year}-${s.semester}-${s.kind}`;
// 정렬 키: 연도 → 학기 → 중간(0) → 기말(1).
const siteOrder = (s: Site): number => s.year * 100 + s.semester * 10 + (s.kind === "중간" ? 0 : 1);
const sameSite = (a: Site, b: Site): boolean =>
  a.year === b.year && a.semester === b.semester && a.kind === b.kind;

// 축에 올릴 정기 시점들 — 유효 점수가 하나라도 있는(=실시된) 시점만, 시간순 정렬.
export function regularSites(exams: readonly StatExam[]): Site[] {
  const seen = new Map<string, Site>();
  for (const e of exams) {
    if (validScores(e.scores).length === 0) continue; // 미실시(유효 점수 0) 제외
    const s = siteOf(e);
    if (s) seen.set(siteKey(s), s);
  }
  return [...seen.values()].sort((a, b) => siteOrder(a) - siteOrder(b));
}

interface StudentMean { readonly studentId: string; readonly grade: string; readonly pct: number; }

// 한 시점의 학생별 평균들(미응시 학생 제외). 같은 학생의 여러 행은 합쳐 한 표로 센다(중복 방어 → INV-ST3).
function studentMeansAtSite(exams: readonly StatExam[], site: Site): StudentMean[] {
  const byStudent = new Map<string, { grade: string; scores: StatScore[] }>();
  for (const e of exams) {
    const s = siteOf(e);
    if (!s || !sameSite(s, site)) continue;
    const cur = byStudent.get(e.studentId) ?? { grade: e.grade, scores: [] };
    cur.scores.push(...e.scores);
    byStudent.set(e.studentId, cur);
  }
  const out: StudentMean[] = [];
  for (const [studentId, { grade, scores }] of byStudent) {
    const m = studentSiteMeanPct(scores);
    if (m !== null) out.push({ studentId, grade, pct: m });
  }
  return out;
}

// 한 시점의 학원 평균 = 학생별 평균들의 평균(학생 동등 가중). INV-ST3 + INV-ST4.
// 전체·과목·학년 평균이 모두 이 한 경로로 흐른다(중복 없는 단일 진실).
export function academyAvgAtSite(exams: readonly StatExam[], site: Site): number | null {
  return meanOf(studentMeansAtSite(exams, site).map((s) => s.pct));
}

export interface TrendPoint {
  readonly site: Site;
  readonly avgPct: number; // 표시용 반올림 정수
}

// 전체 평균 추이(탭①): 각 정기 시점의 학원 평균(학생 동등 가중).
// regularSites 는 유효 점수 있는 시점만 → academyAvgAtSite 는 여기서 non-null 보장.
export function overallTrend(exams: readonly StatExam[]): TrendPoint[] {
  return regularSites(exams).map((site) => ({ site, avgPct: Math.round(academyAvgAtSite(exams, site) ?? 0) }));
}

export interface RankRow {
  readonly studentId: string;
  readonly grade: string;
  readonly pct: number; // 반올림 정수
}

// 드릴다운: 선택한 시점의 학생 평균(백분율) 내림차순. 미응시 학생은 애초에 빠진다(0점으로 최하위 아님).
export function siteRanking(exams: readonly StatExam[], site: Site): RankRow[] {
  return studentMeansAtSite(exams, site)
    .map((s) => ({ studentId: s.studentId, grade: s.grade, pct: Math.round(s.pct) }))
    .sort((a, b) => b.pct - a.pct);
}

// 한 시점·한 과목의 학원 평균(그 과목 점수만, 학생 동등 가중). 유효 표본 없으면 null.
function subjectSiteAvg(exams: readonly StatExam[], site: Site, subject: string): number | null {
  const byStudent = new Map<string, StatScore[]>();
  for (const e of exams) {
    const s = siteOf(e);
    if (!s || !sameSite(s, site)) continue;
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(...e.scores.filter((sc) => sc.subject === subject));
    byStudent.set(e.studentId, arr);
  }
  const means = [...byStudent.values()].map(studentSiteMeanPct).filter((m): m is number => m !== null);
  return meanOf(means);
}

// 과목별 추이(탭②): 한 과목의 정기 시점별 학원 평균(그 과목 점수만, 학생 동등 가중).
// 그 과목이 없는 시점은 점을 찍지 않는다(0으로 위장 금지 — INV-ST4 취지, "부분 집계로 오해할 값 표시 금지").
export function subjectTrend(exams: readonly StatExam[], subject: string): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const site of regularSites(exams)) {
    const avg = subjectSiteAvg(exams, site, subject);
    if (avg !== null) out.push({ site, avgPct: Math.round(avg) });
  }
  return out;
}

// 통계에 등장하는 과목 목록(유효 점수가 있는 과목만), 이름 오름차순. 과목 select 채움용.
export function subjectsOf(exams: readonly StatExam[]): string[] {
  const set = new Set<string>();
  for (const e of exams) for (const s of validScores(e.scores)) set.add(s.subject);
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

export interface SiteSummary {
  readonly avgPct: number; // 학원 평균(백분율, 학생 동등 가중)
  readonly taken: number; // 그 시점 유효 응시 학생 수
  readonly best: { readonly subject: string; readonly avgPct: number } | null; // 최고 평균 과목
}

// 요약 카드(탭①): 한 시점의 학원 평균·응시 수·최고 평균 과목.
export function siteSummary(exams: readonly StatExam[], site: Site): SiteSummary {
  const taken = studentMeansAtSite(exams, site).length;
  let best: { subject: string; avgPct: number } | null = null;
  for (const subject of subjectsOf(exams)) {
    const a = subjectSiteAvg(exams, site, subject);
    if (a !== null && (best === null || a > best.avgPct)) best = { subject, avgPct: Math.round(a) };
  }
  return { avgPct: Math.round(academyAvgAtSite(exams, site) ?? 0), taken, best };
}

export interface GradeAvg {
  readonly grade: string;
  readonly avgPct: number;
}

// 학년별 평균(탭③): 최신 정기 시점 기준, 현재 학년별 학원 평균.
// 학년 사다리 순 정렬은 표시 관심사 → 페이지가 담당한다(여기서 student 슬라이스에 의존하지 않도록, FSD 자족).
export function gradeAverages(exams: readonly StatExam[], site: Site): GradeAvg[] {
  const byGrade = new Map<string, number[]>();
  for (const s of studentMeansAtSite(exams, site)) {
    const arr = byGrade.get(s.grade) ?? [];
    arr.push(s.pct);
    byGrade.set(s.grade, arr);
  }
  return [...byGrade.entries()].map(([grade, pcts]) => ({ grade, avgPct: Math.round(meanOf(pcts) ?? 0) }));
}

// 최신(가장 마지막) 정기 시점 — 드릴다운 기본 선택·학년별 기준.
export function latestSite(exams: readonly StatExam[]): Site | null {
  const sites = regularSites(exams);
  return sites.length > 0 ? sites[sites.length - 1] : null;
}
