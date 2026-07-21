// 인메모리 앱 상태 + 리듀서. 백엔드 없이 하드코딩 시드 위에서 실제로 동작한다.
// 돈 규칙(차감·지분·정산)은 검증된 model.ts를 그대로 재사용하고, 여기선 여러 펀딩을 담아 조율만 한다.
import {
  type Funding, type FundingStatus, type Points, type UserId, type World,
  openFunding, contribute as domainContribute, settleExpired, CAP,
} from "./model";
import { gradientFor } from "./catalog";

export { CAP };
export type { FundingStatus } from "./model";

export interface Meta {
  title: string;
  description: string[];
  category: string;
}
export interface Project {
  funding: Funding;
  meta: Meta;
}
export interface AppState {
  balances: Record<UserId, Points>;
  users: UserId[]; // 데모 계정 (id === 닉네임)
  projects: Project[];
  currentUser: UserId;
}
export type Res<T> = { ok: true; value: T } | { ok: false; error: string };

export const balanceOf = (s: AppState, u: UserId): Points => s.balances[u] ?? 0;

// --- 리듀서 (순수: 새 상태 반환) ---

export function contributeTo(s: AppState, projectId: string, funder: UserId, amount: Points, now: number): Res<AppState> {
  const idx = s.projects.findIndex((p) => p.funding.id === projectId);
  if (idx < 0) return { ok: false, error: "존재하지 않는 펀딩이에요" };
  const proj = s.projects[idx];
  const world: World = { balances: s.balances, funding: proj.funding };
  const r = domainContribute(world, funder, amount, now);
  if (!r.ok) return r;
  const projects = s.projects.slice();
  projects[idx] = { ...proj, funding: r.value.funding };
  return { ok: true, value: { ...s, balances: r.value.balances, projects } };
}

export interface NewProject {
  creator: UserId;
  title: string;
  description: string[];
  category: string;
  target: Points;
  rewardPool: Points;
  deadline: number;
}
export function createProject(s: AppState, np: NewProject, now: number): Res<{ state: AppState; id: string }> {
  const id = `new-${s.projects.length + 1}`;
  const r = openFunding(s.balances, {
    id, creator: np.creator, target: np.target, rewardPool: np.rewardPool, deadline: np.deadline,
  }, now);
  if (!r.ok) return r;
  const project: Project = { funding: r.value.funding, meta: { title: np.title, description: np.description, category: np.category } };
  return { ok: true, value: { state: { ...s, balances: r.value.balances, projects: [...s.projects, project] }, id } };
}

// 마감 지난 OPEN 펀딩을 일괄 FAILED 처리(멱등). 렌더 전에 호출한다.
export function settleExpiredAll(s: AppState, now: number): AppState {
  let state = s;
  for (const p of s.projects) {
    if (p.funding.status === "OPEN" && now >= p.funding.deadline) {
      const idx = state.projects.findIndex((x) => x.funding.id === p.funding.id);
      const r = settleExpired({ balances: state.balances, funding: state.projects[idx].funding }, now);
      if (r.ok) {
        const projects = state.projects.slice();
        projects[idx] = { ...state.projects[idx], funding: r.value.funding };
        state = { ...state, balances: r.value.balances, projects };
      }
    }
  }
  return state;
}

// --- 뷰 (표시용 파생) ---

export interface FunderView {
  nickname: UserId;
  amount: Points;
  sharePct: number;
}
export interface ProjectView {
  id: string;
  title: string;
  description: string[];
  category: string;
  gradient: string;
  creatorName: UserId;
  target: Points;
  raised: Points;
  funderCount: number;
  deadline: number;
  status: FundingStatus;
  topFunders: FunderView[];
  moreFunders: number;
}

function aggregate(f: Funding): { funder: UserId; amount: Points }[] {
  const totals = new Map<UserId, Points>();
  for (const c of f.contributions) totals.set(c.funder, (totals.get(c.funder) ?? 0) + c.amount);
  return [...totals.entries()].map(([funder, amount]) => ({ funder, amount })).sort((a, b) => b.amount - a.amount);
}
const pctOf = (amount: Points, raised: Points): number =>
  raised > 0 ? Math.round((amount / raised) * 1000) / 10 : 0;

export function toView(p: Project): ProjectView {
  const agg = aggregate(p.funding);
  const top = agg.slice(0, 3);
  return {
    id: p.funding.id, title: p.meta.title, description: p.meta.description,
    category: p.meta.category, gradient: gradientFor(p.meta.category),
    creatorName: p.funding.creator, target: p.funding.target, raised: p.funding.raised,
    funderCount: agg.length, deadline: p.funding.deadline, status: p.funding.status,
    topFunders: top.map((a) => ({ nickname: a.funder, amount: a.amount, sharePct: pctOf(a.amount, p.funding.raised) })),
    moreFunders: Math.max(0, agg.length - top.length),
  };
}
export const findView = (s: AppState, id: string): ProjectView | null => {
  const p = s.projects.find((x) => x.funding.id === id);
  return p ? toView(p) : null;
};

// 지금 참여 가능한 최대 (min(상한, 잔액, 남은 목표)) = 도메인 INV-BAL-2 경계.
export const maxParticipatable = (raised: Points, target: Points, balance: Points): Points =>
  Math.max(0, Math.min(CAP, balance, target - raised));

// 개설 폼이 넘기는 값(창작자는 app이 currentUser로 채움).
export type DraftValues = Omit<NewProject, "creator">;

// 화면이 한 번에 필요로 하는 스냅샷 (인메모리·Supabase 리포지토리 공통 출력).
export interface Snapshot {
  users: { nickname: UserId; balance: Points }[];
  projects: ProjectView[];
  myCreated: ProjectView[];
  myBacked: { project: ProjectView; funder: FunderView }[];
}

// 프로젝트 목록 + 잔액에서 스냅샷을 만든다(순수). 두 리포지토리가 공유한다.
export function snapshotFrom(projects: Project[], balances: Record<UserId, Points>, demoUsers: UserId[], currentUser: UserId): Snapshot {
  const projectViews = projects.map(toView);
  const myCreated = projectViews.filter((v) => v.creatorName === currentUser);
  const myBacked = projects.flatMap((p) => {
    const amount = p.funding.contributions.filter((c) => c.funder === currentUser).reduce((a, c) => a + c.amount, 0);
    if (amount <= 0) return [];
    return [{ project: toView(p), funder: { nickname: currentUser, amount, sharePct: pctOf(amount, p.funding.raised) } }];
  });
  return {
    users: demoUsers.map((n) => ({ nickname: n, balance: balances[n] ?? 0 })),
    projects: projectViews, myCreated, myBacked,
  };
}
