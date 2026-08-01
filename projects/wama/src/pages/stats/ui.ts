import { el, svgEl } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";
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

function gridAndAxes(): Child[] {
  const marks = [0, 25, 50, 75, 100];
  const out: Child[] = [];
  for (const m of marks) {
    const y = yAt(m);
    out.push(svgEl("line", { class: "c-grid", x1: PLOT.x0, y1: y, x2: PLOT.x1, y2: y }));
    out.push(svgEl("text", { class: "c-axis", x: PLOT.x0 - 10, y: y + 4, "text-anchor": "end" }, String(m)));
  }
  out.push(svgEl("line", { class: "c-axisline", x1: PLOT.x0, y1: PLOT.yTop, x2: PLOT.x0, y2: PLOT.yBot }));
  out.push(svgEl("line", { class: "c-axisline", x1: PLOT.x0, y1: PLOT.yBot, x2: PLOT.x1, y2: PLOT.yBot }));
  return out;
}

function xLabels(sites: readonly Site[]): Child[] {
  const n = sites.length;
  return sites.flatMap((s, i) => {
    const x = xAt(i, n);
    return [
      svgEl("text", { class: "c-axis", x, y: PLOT.yBot + 22, "text-anchor": "middle" }, `${s.semester}학기 ${s.kind}`),
      svgEl("text", { class: "c-axisyear", x, y: PLOT.yBot + 37, "text-anchor": "middle" }, `'${String(s.year).slice(2)}`),
    ];
  });
}

let gradSeq = 0; // area 그라데이션 id 유일화(한 문서에 차트 여러 개)

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
function lineChart(points: readonly TrendPoint[], ariaLabel: string, opts: { selected?: number; onSelect?: (i: number) => void } = {}): SVGElement {
  const n = points.length;
  const sites = points.map((p) => p.site);
  const coords = points.map((p, i) => ({ x: xAt(i, n), y: yAt(p.avgPct), v: p.avgPct }));
  const linePath = smoothPath(coords);
  const areaPath = n > 0
    ? `${linePath} L${coords[n - 1].x},${PLOT.yBot} L${coords[0].x},${PLOT.yBot} Z`
    : "";
  const gradId = `c-area-grad-${gradSeq++}`;

  const marks: Child[] = coords.flatMap((c, i) => {
    const isSel = opts.selected === i;
    const s = sites[i];
    const label = `${s.year} ${s.semester}학기 ${s.kind} 평균 ${c.v}점${opts.onSelect ? " · 학생 순위 보기" : ""}${isSel ? " (선택됨)" : ""}`;
    const nodes: Child[] = [];
    if (isSel) nodes.push(svgEl("circle", { class: "c-halo", cx: c.x, cy: c.y, r: 11 }));
    nodes.push(svgEl("circle", { class: isSel ? "c-dot c-dot--sel" : "c-dot", cx: c.x, cy: c.y, r: isSel ? 5.5 : 4.5 }));
    nodes.push(svgEl("text", { class: isSel ? "c-vallabel" : "c-valnum", x: c.x, y: c.y - 13, "text-anchor": "middle" }, String(c.v)));
    if (!opts.onSelect) return nodes;
    // 클릭·키보드 접근 가능한 포인트
    const hit = svgEl("g", {
      class: "c-mark", role: "button", tabindex: "0", "aria-label": label,
      onclick: () => opts.onSelect?.(i),
      onkeydown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onSelect?.(i); } },
    }, svgEl("circle", { class: "c-hit", cx: c.x, cy: c.y, r: 16 }), ...nodes);
    return [hit];
  });

  return svgEl("svg", { viewBox: `0 0 ${VB.w} ${VB.h}`, role: "img", "aria-label": ariaLabel, class: "c-svg" },
    svgEl("defs", {}, svgEl("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" },
      svgEl("stop", { offset: "0", class: "c-area-stop0" }),
      svgEl("stop", { offset: "1", class: "c-area-stop1" }),
    )),
    ...gridAndAxes(),
    n > 0 && svgEl("path", { class: "c-area", style: `fill:url(#${gradId})`, d: areaPath }),
    n > 0 && svgEl("path", { class: "c-line", d: linePath }),
    ...marks,
    ...xLabels(sites),
  );
}

// 막대 차트 (학년별) — 값 라벨 + 학년 라벨.
function barChart(bars: readonly GradeAvg[], ariaLabel: string): SVGElement {
  const n = bars.length;
  const bw = Math.min(72, ((PLOT.x1 - PLOT.x0) / Math.max(n, 1)) * 0.5);
  const cells: Child[] = bars.flatMap((b, i) => {
    const cx = xAt(i, n);
    const y = yAt(b.avgPct);
    return [
      svgEl("rect", { class: "c-bar", x: cx - bw / 2, y, width: bw, height: PLOT.yBot - y, rx: 4 }),
      svgEl("text", { class: "c-valnum", x: cx, y: y - 8, "text-anchor": "middle" }, String(b.avgPct)),
      svgEl("text", { class: "c-axis", x: cx, y: PLOT.yBot + 24, "text-anchor": "middle" }, b.grade),
    ];
  });
  return svgEl("svg", { viewBox: `0 0 ${VB.w} ${VB.h}`, role: "img", "aria-label": ariaLabel, class: "c-svg" },
    ...gridAndAxes(), ...cells);
}

function emptyState(msg: string): HTMLElement {
  return el("div", { class: "chart-empty" }, el("p", { class: "page__desc" }, msg));
}

function chartCard(title: string, desc: string, body: Child): HTMLElement {
  return el("section", { class: "card chart-card", "aria-label": title },
    el("div", { class: "chart-head" },
      el("h2", {}, title),
      el("p", {}, desc),
    ),
    el("div", { class: "chart" }, body),
  );
}

// ── 드릴다운(전체 탭): 선택 시점의 학생 순위 ─────────────────────────────
function drilldownTable(exams: readonly StatExam[], site: Site, nameOf: Map<string, string>): HTMLElement {
  const rows = siteRanking(exams, site);
  const body = rows.length === 0
    ? emptyState("이 시점에 응시한 학생이 없습니다.")
    : el("div", { class: "table-card" },
        el("table", {},
          el("caption", { class: "sr-only" }, `${site.year} ${site.semester}학기 ${site.kind}고사 학생 평균 점수 순위. 순위·이름·학년·평균 점수, 내림차순.`),
          el("thead", {}, el("tr", {},
            el("th", { scope: "col" }, "순위"),
            el("th", { scope: "col" }, "이름"),
            el("th", { scope: "col" }, "학년"),
            el("th", { scope: "col", class: "num-cell" }, "평균 점수"),
          )),
          // 이름은 링크(키보드·SR로 상세 진입 — 시안 .name-link). 행 전체 클릭은 마우스 편의로 유지.
          el("tbody", {}, ...rows.map((r, i) => el("tr", { class: "rowlink", onclick: () => { location.hash = `#/students/${r.studentId}`; } },
            el("td", { class: "tnum" }, String(i + 1)),
            el("td", {}, el("a", { class: "name-link", href: `#/students/${r.studentId}` }, nameOf.get(r.studentId) ?? "(이름 없음)")),
            el("td", {}, r.grade),
            el("td", { class: "num-cell tnum" }, `${r.pct}점`),
          ))),
        ),
      );
  return el("div", { class: "drill" },
    el("div", { class: "drill-head" },
      el("span", { class: "tag" }, "선택된 시험"),
      el("span", { class: "drill-title" }, `${site.year} ${site.semester}학기 ${site.kind}고사`),
      el("span", { class: "drill-sub" }, `· 학생 평균 점수 내림차순 · 전체 ${rows.length}명`),
    ),
    body,
  );
}

function statCard(label: string, valueNode: Child, sub: string): HTMLElement {
  return el("div", { class: "card stat" },
    el("div", { class: "stat__label" }, label),
    el("div", { class: "stat__value" }, valueNode),
    el("div", { class: "stat__note" }, sub),
  );
}

// ── 탭① 전체 통계 ────────────────────────────────────────────────────────
function panelAll(exams: readonly StatExam[], totalStudents: number, nameOf: Map<string, string>): HTMLElement {
  const trend = overallTrend(exams);
  const latest = latestSite(exams);
  if (trend.length === 0 || latest == null) {
    return el("div", { class: "panel" }, emptyState("표시할 정기시험 성적이 없습니다. 중간·기말 점수를 입력하면 추이가 나타납니다."));
  }
  const sum = siteSummary(exams, latest);
  const cards = el("section", { class: "stats", "aria-label": "요약 지표" },
    statCard("전체 평균 점수",
      el("div", {}, el("span", { class: "num tnum" }, String(sum.avgPct)), el("small", {}, " 점")),
      `${latest.year} ${latest.semester}학기 ${latest.kind}고사 기준`),
    statCard("응시 학생 수",
      el("div", {}, el("span", { class: "num tnum" }, String(sum.taken)), el("small", {}, ` / ${totalStudents}명`)),
      "최신 정기시험 응시"),
    statCard("최고 평균 과목",
      sum.best
        ? el("div", {}, el("span", { class: "subject-pill" }, sum.best.subject), el("span", { class: "num tnum best-num" }, `${sum.best.avgPct}점`))
        : el("div", { class: "page__desc" }, "—"),
      "최신 정기시험 기준"),
  );

  const chartHost = el("div", { class: "chart" });
  const drillHost = el("div", {});
  let selIdx = trend.length - 1; // 기본: 최신 시점
  const ariaLabel = `전체 학생 평균 점수 추이 (정기시험 ${trend.length}시점, 0–100점). 포인트를 눌러 학생 순위를 봅니다.`;
  const onSelect = (i: number): void => {
    selIdx = i;
    redraw();
    drillHost.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  function redraw(): void {
    chartHost.replaceChildren(lineChart(trend, ariaLabel, { selected: selIdx, onSelect }));
    drillHost.replaceChildren(drilldownTable(exams, trend[selIdx].site, nameOf));
  }
  redraw();

  return el("div", { class: "panel" },
    cards,
    el("section", { class: "card chart-card", "aria-label": "전체 학생 평균 점수 추이" },
      el("div", { class: "chart-head" },
        el("h2", {}, "전체 학생 평균 점수 추이"),
        el("p", {}, "정기시험(중간·기말) 시점별 전체 응시생 평균 · 포인트를 누르면 그 시험의 학생 순위가 아래에 열립니다."),
      ),
      chartHost,
      drillHost,
    ),
  );
}

// ── 탭② 과목별 통계 ──────────────────────────────────────────────────────
function panelSubject(exams: readonly StatExam[]): HTMLElement {
  const subjects = subjectsOf(exams);
  if (subjects.length === 0 || regularSites(exams).length === 0) {
    return el("div", { class: "panel" }, emptyState("표시할 정기시험 과목 성적이 없습니다."));
  }
  const chartHost = el("div", { class: "chart" });
  const draw = (subject: string): void => {
    chartHost.replaceChildren(lineChart(subjectTrend(exams, subject), `${subject} 정기시험 평균 추이(0–100점)`));
  };
  const select = el("select", { class: "select", "aria-label": "과목 선택", onchange: (e: Event) => draw((e.target as HTMLSelectElement).value) },
    ...subjects.map((s) => el("option", { value: s }, s)),
  );
  draw(subjects[0]);
  return el("div", { class: "panel" },
    el("section", { class: "card chart-card", "aria-label": "과목별 통계" },
      el("div", { class: "chart-head chart-head--row" },
        el("div", {},
          el("h2", {}, "과목별 점수 변화"),
          el("p", {}, "과목을 고르면 정기시험 시점별 학원 평균 추이를 봅니다."),
        ),
        el("label", { class: "subject-picker" }, el("span", { class: "sr-only" }, "과목 선택"), select),
      ),
      chartHost,
    ),
  );
}

// ── 탭③ 학년별 통계 ──────────────────────────────────────────────────────
const gradeRank = (g: string): number => {
  const i = GRADE_LADDER.indexOf(g as (typeof GRADE_LADDER)[number]);
  return i < 0 ? GRADE_LADDER.length : i; // 사다리 밖(미정)은 맨 뒤
};

function panelGrade(exams: readonly StatExam[]): HTMLElement {
  const latest = latestSite(exams);
  const bars = latest
    ? [...gradeAverages(exams, latest)].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
    : [];
  const body = bars.length === 0
    ? emptyState("표시할 정기시험 성적이 없습니다.")
    : barChart(bars, `학년별 평균 점수(최신 정기시험 기준, 0–100점). ${bars.map((b) => `${b.grade} ${b.avgPct}점`).join(", ")}.`);
  return el("div", { class: "panel" },
    chartCard("학년별 평균",
      latest ? `${latest.year} ${latest.semester}학기 ${latest.kind}고사 기준 · 현재 학년별 학원 평균` : "정기시험 성적 없음",
      body),
  );
}

// ── 탭 셸 ────────────────────────────────────────────────────────────────
function tabs(panels: { id: string; label: string; node: HTMLElement }[]): HTMLElement {
  const tablist = el("div", { class: "tabbar", role: "tablist", "aria-label": "통계 보기 전환" });
  const buttons: HTMLButtonElement[] = [];
  const select = (idx: number): void => {
    panels.forEach((p, i) => {
      p.node.hidden = i !== idx;
      buttons[i].setAttribute("aria-selected", String(i === idx));
      buttons[i].classList.toggle("tab--active", i === idx);
    });
  };
  panels.forEach((p, i) => {
    const b = el("button", {
      class: "tab", type: "button", role: "tab", id: `tab-${p.id}`, "aria-controls": `panel-${p.id}`,
      onclick: () => select(i),
    }, p.label) as HTMLButtonElement;
    buttons.push(b);
    tablist.append(b);
    p.node.id = `panel-${p.id}`;
    p.node.setAttribute("role", "tabpanel");
    p.node.setAttribute("aria-labelledby", `tab-${p.id}`);
  });
  const wrap = el("div", {}, tablist, ...panels.map((p) => p.node));
  select(0);
  return wrap;
}

export async function mountStatsPage(root: HTMLElement): Promise<void> {
  const [students, hdr] = await Promise.all([listStudents(), getSessionHeader()]);
  const nameOf = new Map(students.map((s) => [s.id, s.name]));
  const gradeOf = new Map(students.map((s) => [s.id, s.grade]));
  // 학년은 student read-model에서 주입(stats 슬라이스는 student를 import하지 않는다).
  const examsRes = await getAcademyExams((id) => gradeOf.get(id) ?? "미정");

  // 로드 실패는 빈 상태로 위장하지 않는다 — 오류 + 재시도(스펙: 부분 집계로 오해할 값 표시 금지).
  const content = examsRes.ok
    ? tabs([
        { id: "all", label: "전체 통계", node: panelAll(examsRes.value, students.length, nameOf) },
        { id: "subject", label: "과목별 통계", node: panelSubject(examsRes.value) },
        { id: "grade", label: "학년별 통계", node: panelGrade(examsRes.value) },
      ])
    : el("div", { class: "chart-empty", role: "alert" },
        el("p", { class: "page__desc" }, examsRes.error),
        el("button", { class: "btn-primary", type: "button", onclick: () => { void mountStatsPage(root); } }, "다시 시도"),
      );

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page" },
      el("div", { class: "page-head" },
        el("div", {},
          el("h1", { class: "page__title" }, "성적 통계"),
          el("p", { class: "page__desc" }, "정기시험(중간·기말) 기준 · 전체 평균 추이 · 과목별 변화 · 학년별 평균. 값은 만점 대비 백분율(0–100)."),
        ),
        el("a", { class: "btn-ghost btn-ghost--sm", href: "#/students" }, "학생 목록"),
      ),
      content,
    ),
  );
}
