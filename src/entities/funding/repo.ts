// 데이터 리포지토리 — 화면에 필요한 스냅샷 조회 + 후원/개설 명령.
// 두 구현: MemoryRepo(오프라인·env 없을 때), SupabaseRepo(RPC 경유 서버 강제).
import { hasSupabase } from "@/shared/api/client";
import { callRpc, selectRows } from "@/shared/api/rpc";
import {
  type AppState, type Project, type Snapshot, type Res, type DraftValues,
  type FundingStatus, contributeTo, createProject, settleExpiredAll, snapshotFrom,
} from "./store";
import { seedState, DEMO_ACCOUNTS } from "./seed";

export interface FundingRepo {
  load(currentUser: string): Promise<Snapshot>;
  contribute(projectId: string, actor: string, amount: number): Promise<Res<null>>;
  create(actor: string, draft: DraftValues): Promise<Res<{ id: string }>>;
}

// ── 인메모리(오프라인) ──────────────────────────────────
export class MemoryRepo implements FundingRepo {
  private state: AppState = seedState(Date.now());

  async load(currentUser: string): Promise<Snapshot> {
    this.state = settleExpiredAll(this.state, Date.now());
    return snapshotFrom(this.state.projects, this.state.balances, DEMO_ACCOUNTS, currentUser);
  }
  async contribute(projectId: string, actor: string, amount: number): Promise<Res<null>> {
    const r = contributeTo(this.state, projectId, actor, amount, Date.now());
    if (!r.ok) return r;
    this.state = r.value;
    return { ok: true, value: null };
  }
  async create(actor: string, draft: DraftValues): Promise<Res<{ id: string }>> {
    const r = createProject(this.state, { creator: actor, ...draft }, Date.now());
    if (!r.ok) return r;
    this.state = r.value.state;
    return { ok: true, value: { id: r.value.id } };
  }
}

// ── Supabase(서버 강제) ─────────────────────────────────
interface UserRow { nickname: string; balance: number }
interface FundingRow {
  id: string; creator: string; title: string; description: string[] | null; category: string;
  target: number; reward_pool: number; deadline: string; status: string; raised: number;
}
interface ContribRow { funding_id: string; funder: string; amount: number; seq: number }

const STATUSES: FundingStatus[] = ["OPEN", "SUCCESS", "FAILED"];
const asStatus = (s: string): FundingStatus => (STATUSES.includes(s as FundingStatus) ? (s as FundingStatus) : "OPEN");

function rowToProject(f: FundingRow, rows: ContribRow[]): Project {
  const ms = Date.parse(f.deadline);
  return {
    funding: {
      id: f.id, creator: f.creator, target: f.target, rewardPool: f.reward_pool,
      deadline: Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER, // 파싱 실패 시 만료로 오판하지 않음
      status: asStatus(f.status), raised: f.raised,
      contributions: [...rows].sort((a, b) => a.seq - b.seq).map((c) => ({ funder: c.funder, amount: c.amount })),
    },
    meta: { title: f.title, description: f.description ?? [], category: f.category },
  };
}

class SupabaseRepo implements FundingRepo {
  async load(currentUser: string): Promise<Snapshot> {
    await callRpc("settle_expired_all", {}); // 마감 지연 정산(서버 시계)
    const [users, fundings, contribs] = await Promise.all([
      selectRows<UserRow>("app_user"),
      selectRows<FundingRow>("funding"),
      selectRows<ContribRow>("contribution"),
    ]);
    const byFunding = new Map<string, ContribRow[]>();
    for (const c of contribs) {
      const list = byFunding.get(c.funding_id);
      if (list) list.push(c); else byFunding.set(c.funding_id, [c]);
    }
    const projects = fundings.map((f) => rowToProject(f, byFunding.get(f.id) ?? []));
    const balances: Record<string, number> = {};
    for (const u of users) balances[u.nickname] = u.balance;
    return snapshotFrom(projects, balances, DEMO_ACCOUNTS, currentUser);
  }
  async contribute(projectId: string, actor: string, amount: number): Promise<Res<null>> {
    const r = await callRpc("contribute", { p_funding_id: projectId, p_funder: actor, p_amount: amount });
    return r.ok ? { ok: true, value: null } : { ok: false, error: r.error ?? "후원 실패" };
  }
  async create(actor: string, draft: DraftValues): Promise<Res<{ id: string }>> {
    const r = await callRpc("open_funding", {
      p_creator: actor, p_title: draft.title, p_description: draft.description,
      p_category: draft.category, p_target: draft.target, p_reward: draft.rewardPool,
      p_deadline: new Date(draft.deadline).toISOString(),
    });
    if (!r.ok) return { ok: false, error: r.error ?? "개설 실패" };
    const id = typeof r.id === "string" ? r.id : "";
    return id ? { ok: true, value: { id } } : { ok: false, error: "개설 응답이 올바르지 않아요" };
  }
}

export const repo: FundingRepo = hasSupabase ? new SupabaseRepo() : new MemoryRepo();
export { hasSupabase };
