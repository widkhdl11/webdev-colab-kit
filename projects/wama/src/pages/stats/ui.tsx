import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStudents } from "@/entities/student/repo";
import { GRADE_LADDER } from "@/entities/student/model";
import { getAcademyExams } from "@/entities/stats/repo";
import {
  overallTrend, subjectTrend, gradeAverages, siteRanking, siteSummary,
  subjectsOf, regularSites, latestSite,
  type StatExam, type Site, type TrendPoint, type GradeAvg,
} from "@/entities/stats/model";
import "./stats.css";

// 성적 통계 페이지 — 표시만. 집계·파생값은 entities/stats 에서 온다(ui-layers: 여기서 계산 금지).
// 3탭(전체/과목별/학년별) · 정기시험 기준 · 값은 백분율(0–100). 승인 시안 stats.html.

// ── 차트 좌표계 (viewBox 960×360) ───────────────────────────────────────
const VB = { w: 960, h: 360 };
const PLOT = { x0: 64, x1: 932, yTop: 40, yBot: 304 }; // yTop=100%, yBot=0%
const xAt = (i: number, n: number): number => PLOT.x0 + ((i + 0.5) / Math.max(n, 1)) * (PLOT.x1 - PLOT.x0);
const yAt = (pct: number): number => PLOT.yBot - (Math.max(0, Math.min(100, pct)) / 100) * (PLOT.yBot - PLOT.yTop);

function GridAndAxes(): ReactNode {
  return (
    <>
      {[0, 25, 50, 75, 100].map((m) => {
        const y = yAt(m);
        return (
          <g key={m}>
            <line className="c-grid" x1={PLOT.x0} y1={y} x2={PLOT.x1} y2={y} />
            <text className="c-axis" x={PLOT.x0 - 10} y={y + 4} textAnchor="end">{m}</text>
          </g>
        );
      })}
      <line className="c-axisline" x1={PLOT.x0} y1={PLOT.yTop} x2={PLOT.x0} y2={PLOT.yBot} />
      <line className="c-axisline" x1={PLOT.x0} y1={PLOT.yBot} x2={PLOT.x1} y2={PLOT.yBot} />
    </>
  );
}

function XLabels({ sites }: { readonly sites: readonly Site[] }): ReactNode {
  const n = sites.length;
  return (
    <>
      {sites.map((s, i) => {
        const x = xAt(i, n);
        return (
          <g key={`${s.year}-${s.semester}-${s.kind}`}>
            <text className="c-axis" x={x} y={PLOT.yBot + 22} textAnchor="middle">{`${s.semester}학기 ${s.kind}`}</text>
            <text className="c-axisyear" x={x} y={PLOT.yBot + 37} textAnchor="middle">{`'${String(s.year).slice(2)}`}</text>
          </g>
        );
      })}
    </>
  );
}

// Catmull-Rom → 3차 베지어로 부드러운 곡선(승인 시안: 부드러운 곡선 + area 그라데이션).
function smoothPath(pts: readonly { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// 꺾은선 차트 — 점 클릭 시 onSelect(i). selected 인덱스는 강조.
function LineChart({
  points, ariaLabel, selected, onSelect,
}: {
  readonly points: readonly TrendPoint[];
  readonly ariaLabel: string;
  readonly selected?: number;
  readonly onSelect?: (i: number) => void;
}): ReactNode {
  // 한 문서에 차트가 여럿이라 그라데이션 id 가 겹치면 안 된다 — React 가 인스턴스마다 유일한 id 를 준다.
  const gradId = `c-area-grad-${useId()}`;
  const n = points.length;
  const sites = points.map((p) => p.site);
  const coords = points.map((p, i) => ({ x: xAt(i, n), y: yAt(p.avgPct), v: p.avgPct }));
  const linePath = smoothPath(coords);
  const areaPath = n > 0
    ? `${linePath} L${coords[n - 1].x},${PLOT.yBot} L${coords[0].x},${PLOT.yBot} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label={ariaLabel} className="c-svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="c-area-stop0" />
          <stop offset="1" className="c-area-stop1" />
        </linearGradient>
      </defs>
      <GridAndAxes />
      {n > 0 && <path className="c-area" style={{ fill: `url(#${gradId})` }} d={areaPath} />}
      {n > 0 && <path className="c-line" d={linePath} />}
      {coords.map((c, i) => {
        const isSel = selected === i;
        const s = sites[i];
        const label = `${s.year} ${s.semester}학기 ${s.kind} 평균 ${c.v}점${onSelect ? " · 학생 순위 보기" : ""}${isSel ? " (선택됨)" : ""}`;
        const marks = (
          <>
            {isSel && <circle className="c-halo" cx={c.x} cy={c.y} r={11} />}
            <circle className={isSel ? "c-dot c-dot--sel" : "c-dot"} cx={c.x} cy={c.y} r={isSel ? 5.5 : 4.5} />
            <text className={isSel ? "c-vallabel" : "c-valnum"} x={c.x} y={c.y - 13} textAnchor="middle">{c.v}</text>
          </>
        );
        if (!onSelect) return <g key={i}>{marks}</g>;
        // 클릭·키보드 접근 가능한 포인트
        return (
          <g
            key={i}
            className="c-mark"
            role="button"
            tabIndex={0}
            aria-label={label}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); }
            }}
          >
            <circle className="c-hit" cx={c.x} cy={c.y} r={16} />
            {marks}
          </g>
        );
      })}
      <XLabels sites={sites} />
    </svg>
  );
}

// 막대 차트 (학년별) — 값 라벨 + 학년 라벨.
function BarChart({ bars, ariaLabel }: { readonly bars: readonly GradeAvg[]; readonly ariaLabel: string }): ReactNode {
  const n = bars.length;
  const bw = Math.min(72, ((PLOT.x1 - PLOT.x0) / Math.max(n, 1)) * 0.5);
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label={ariaLabel} className="c-svg">
      <GridAndAxes />
      {bars.map((b, i) => {
        const cx = xAt(i, n);
        const y = yAt(b.avgPct);
        return (
          <g key={b.grade}>
            <rect className="c-bar" x={cx - bw / 2} y={y} width={bw} height={PLOT.yBot - y} rx={4} />
            <text className="c-valnum" x={cx} y={y - 8} textAnchor="middle">{b.avgPct}</text>
            <text className="c-axis" x={cx} y={PLOT.yBot + 24} textAnchor="middle">{b.grade}</text>
          </g>
        );
      })}
    </svg>
  );
}

function EmptyState({ message }: { readonly message: string }): ReactNode {
  return <div className="chart-empty"><p className="page__desc">{message}</p></div>;
}

function ChartCard({
  title, desc, children,
}: {
  readonly title: string;
  readonly desc: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-head">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className="chart">{children}</div>
    </section>
  );
}

// ── 드릴다운(전체 탭): 선택 시점의 학생 순위 ─────────────────────────────
function DrilldownTable({
  exams, site, nameOf,
}: {
  readonly exams: readonly StatExam[];
  readonly site: Site;
  readonly nameOf: Map<string, string>;
}): ReactNode {
  const navigate = useNavigate();
  const rows = siteRanking(exams, site);
  return (
    <div className="drill">
      <div className="drill-head">
        <span className="tag">선택된 시험</span>
        <span className="drill-title">{`${site.year} ${site.semester}학기 ${site.kind}고사`}</span>
        <span className="drill-sub">{`· 학생 평균 점수 내림차순 · 전체 ${rows.length}명`}</span>
      </div>
      {rows.length === 0
        ? <EmptyState message="이 시점에 응시한 학생이 없습니다." />
        : (
          <div className="table-card">
            <table>
              <caption className="sr-only">
                {`${site.year} ${site.semester}학기 ${site.kind}고사 학생 평균 점수 순위. 순위·이름·학년·평균 점수, 내림차순.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">이름</th>
                  <th scope="col">학년</th>
                  <th scope="col" className="num-cell">평균 점수</th>
                </tr>
              </thead>
              {/* 이름은 링크(키보드·SR로 상세 진입 — 시안 .name-link). 행 전체 클릭은 마우스 편의로 유지. */}
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.studentId} className="rowlink" onClick={() => navigate(`/students/${r.studentId}`)}>
                    <td className="tnum">{i + 1}</td>
                    <td>
                      <Link className="name-link" to={`/students/${r.studentId}`}>
                        {nameOf.get(r.studentId) ?? "(이름 없음)"}
                      </Link>
                    </td>
                    <td>{r.grade}</td>
                    <td className="num-cell tnum">{`${r.pct}점`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function StatCard({
  label, children, sub,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly sub: string;
}): ReactNode {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{children}</div>
      <div className="stat__note">{sub}</div>
    </div>
  );
}

// ── 탭① 전체 통계 ────────────────────────────────────────────────────────
function PanelAll({
  exams, totalStudents, nameOf,
}: {
  readonly exams: readonly StatExam[];
  readonly totalStudents: number;
  readonly nameOf: Map<string, string>;
}): ReactNode {
  const trend = overallTrend(exams);
  const latest = latestSite(exams);
  const drillRef = useRef<HTMLDivElement>(null);
  const [selIdx, setSelIdx] = useState(Math.max(0, trend.length - 1)); // 기본: 최신 시점

  if (trend.length === 0 || latest == null) {
    return (
      <div className="panel">
        <EmptyState message="표시할 정기시험 성적이 없습니다. 중간·기말 점수를 입력하면 추이가 나타납니다." />
      </div>
    );
  }

  const sum = siteSummary(exams, latest);
  const safeIdx = Math.min(selIdx, trend.length - 1);

  function select(i: number): void {
    setSelIdx(i);
    drillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="panel">
      <section className="stats" aria-label="요약 지표">
        <StatCard label="전체 평균 점수" sub={`${latest.year} ${latest.semester}학기 ${latest.kind}고사 기준`}>
          <div><span className="num tnum">{sum.avgPct}</span><small> 점</small></div>
        </StatCard>
        <StatCard label="응시 학생 수" sub="최신 정기시험 응시">
          <div><span className="num tnum">{sum.taken}</span><small>{` / ${totalStudents}명`}</small></div>
        </StatCard>
        <StatCard label="최고 평균 과목" sub="최신 정기시험 기준">
          {sum.best
            ? (
              <div>
                <span className="subject-pill">{sum.best.subject}</span>
                <span className="num tnum best-num">{`${sum.best.avgPct}점`}</span>
              </div>
            )
            : <div className="page__desc">—</div>}
        </StatCard>
      </section>

      <section className="chart-card" aria-label="전체 학생 평균 점수 추이">
        <div className="chart-head">
          <h2>전체 학생 평균 점수 추이</h2>
          <p>정기시험(중간·기말) 시점별 전체 응시생 평균 · 포인트를 누르면 그 시험의 학생 순위가 아래에 열립니다.</p>
        </div>
        <div className="chart">
          <LineChart
            points={trend}
            ariaLabel={`전체 학생 평균 점수 추이 (정기시험 ${trend.length}시점, 0–100점). 포인트를 눌러 학생 순위를 봅니다.`}
            selected={safeIdx}
            onSelect={select}
          />
        </div>
        <div ref={drillRef}>
          <DrilldownTable exams={exams} site={trend[safeIdx].site} nameOf={nameOf} />
        </div>
      </section>
    </div>
  );
}

// ── 탭② 과목별 통계 ──────────────────────────────────────────────────────
function PanelSubject({ exams }: { readonly exams: readonly StatExam[] }): ReactNode {
  const subjects = subjectsOf(exams);
  const [subject, setSubject] = useState(subjects[0] ?? "");

  if (subjects.length === 0 || regularSites(exams).length === 0) {
    return <div className="panel"><EmptyState message="표시할 정기시험 과목 성적이 없습니다." /></div>;
  }

  const current = subjects.includes(subject) ? subject : subjects[0];
  return (
    <div className="panel">
      <section className="chart-card" aria-label="과목별 통계">
        <div className="chart-head chart-head--row">
          <div>
            <h2>과목별 점수 변화</h2>
            <p>과목을 고르면 정기시험 시점별 학원 평균 추이를 봅니다.</p>
          </div>
          <label className="subject-picker">
            <span className="sr-only">과목 선택</span>
            <select
              className="select"
              aria-label="과목 선택"
              value={current}
              onChange={(e) => setSubject(e.target.value)}
            >
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="chart">
          <LineChart points={subjectTrend(exams, current)} ariaLabel={`${current} 정기시험 평균 추이(0–100점)`} />
        </div>
      </section>
    </div>
  );
}

// ── 탭③ 학년별 통계 ──────────────────────────────────────────────────────
const gradeRank = (g: string): number => {
  const i = GRADE_LADDER.indexOf(g as (typeof GRADE_LADDER)[number]);
  return i < 0 ? GRADE_LADDER.length : i; // 사다리 밖(미정)은 맨 뒤
};

function PanelGrade({ exams }: { readonly exams: readonly StatExam[] }): ReactNode {
  const latest = latestSite(exams);
  const bars = latest
    ? [...gradeAverages(exams, latest)].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
    : [];
  return (
    <div className="panel">
      <ChartCard
        title="학년별 평균"
        desc={latest ? `${latest.year} ${latest.semester}학기 ${latest.kind}고사 기준 · 현재 학년별 학원 평균` : "정기시험 성적 없음"}
      >
        {bars.length === 0
          ? <EmptyState message="표시할 정기시험 성적이 없습니다." />
          : (
            <BarChart
              bars={bars}
              ariaLabel={`학년별 평균 점수(최신 정기시험 기준, 0–100점). ${bars.map((b) => `${b.grade} ${b.avgPct}점`).join(", ")}.`}
            />
          )}
      </ChartCard>
    </div>
  );
}

// ── 탭 셸 ────────────────────────────────────────────────────────────────
function Tabs({ panels }: { readonly panels: readonly { id: string; label: string; node: ReactNode }[] }): ReactNode {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="tabbar" role="tablist" aria-label="통계 보기 전환">
        {panels.map((p, i) => (
          <button
            key={p.id}
            className={i === active ? "tab tab--active" : "tab"}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-controls={`panel-${p.id}`}
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div key={p.id} id={`panel-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} hidden={i !== active}>
          {p.node}
        </div>
      ))}
    </div>
  );
}

interface StatsData {
  readonly exams: readonly StatExam[] | null; // null = 로드 실패
  readonly error: string | null;
  readonly totalStudents: number;
  readonly nameOf: Map<string, string>;
}

export function StatsPage(): ReactNode {
  const [data, setData] = useState<StatsData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const students = await listStudents();
      if (!alive) return;
      const nameOf = new Map(students.map((s) => [s.id, s.name]));
      const gradeOf = new Map(students.map((s) => [s.id, s.grade]));
      // 학년은 student read-model에서 주입(stats 슬라이스는 student를 import하지 않는다).
      const examsRes = await getAcademyExams((id) => gradeOf.get(id) ?? "미정");
      if (!alive) return;
      setData({
        exams: examsRes.ok ? examsRes.value : null,
        error: examsRes.ok ? null : examsRes.error,
        totalStudents: students.length,
        nameOf,
      });
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <h1 className="page__title">성적 통계</h1>
          <p className="page__desc">
            정기시험(중간·기말) 기준 · 전체 평균 추이 · 과목별 변화 · 학년별 평균. 값은 만점 대비 백분율(0–100).
          </p>
        </div>
        <Link className="btn-ghost btn-ghost--sm" to="/students">학생 목록</Link>
      </div>

      {data === null && <p className="page__desc">불러오는 중…</p>}

      {/* 로드 실패는 빈 상태로 위장하지 않는다 — 오류 + 재시도(스펙: 부분 집계로 오해할 값 표시 금지). */}
      {data !== null && data.exams === null && (
        <div className="chart-empty" role="alert">
          <p className="page__desc">{data.error}</p>
          <button className="btn-primary" type="button" onClick={() => { setData(null); setReloadKey((k) => k + 1); }}>
            다시 시도
          </button>
        </div>
      )}

      {data !== null && data.exams !== null && (
        <Tabs
          panels={[
            { id: "all", label: "전체 통계", node: <PanelAll exams={data.exams} totalStudents={data.totalStudents} nameOf={data.nameOf} /> },
            { id: "subject", label: "과목별 통계", node: <PanelSubject exams={data.exams} /> },
            { id: "grade", label: "학년별 통계", node: <PanelGrade exams={data.exams} /> },
          ]}
        />
      )}
    </main>
  );
}
