// app 레이어 = 합성 루트. 리포지토리(인메모리 또는 Supabase RPC) + 해시 라우팅 + 비동기 로딩 + 토스트.
import "@/shared/ui/tokens.css";
import "@/shared/ui/base.css";
import { el } from "@/shared/lib/dom";
import { HomePage } from "@/pages/home/ui";
import { FundingDetailPage } from "@/pages/funding-detail/ui";
import { CreatePage } from "@/pages/create/ui";
import { WalletPage } from "@/pages/wallet/ui";
import type { HeaderProps } from "@/widgets/header/ui";
import type { Snapshot, DraftValues } from "@/entities/funding/store";
import { repo, hasSupabase } from "@/entities/funding/repo";

let currentUser = "민서";
let snapshot: Snapshot | null = null;
let flash: { text: string; kind: "ok" | "error" } | null = null;
let toastTimer = 0;
let loadSeq = 0; // 세대 토큰: 늦게 도착한 stale 로드 응답을 버린다(계정 전환/후원 경합 방지)

const setFlash = (text: string, kind: "ok" | "error") => { flash = { text, kind }; };
const balance = (): number => snapshot?.users.find((u) => u.nickname === currentUser)?.balance ?? 0;
const statusOf = (id: string): string | undefined => snapshot?.projects.find((p) => p.id === id)?.status;

// 최신 요청만 스냅샷에 반영하고 렌더. 반환값 = 이 호출이 실제로 데이터를 적용했는지.
async function refresh(): Promise<boolean> {
  const seq = ++loadSeq;
  let applied = true;
  try {
    const snap = await repo.load(currentUser);
    if (seq !== loadSeq) return false; // 더 최신 refresh가 진행 중 — 그쪽이 렌더한다
    snapshot = snap;
  } catch (e) {
    if (seq !== loadSeq) return false;
    setFlash(e instanceof Error ? e.message : "데이터를 불러오지 못했어요", "error");
    applied = false;
  }
  render();
  return applied;
}

function switchUser(nickname: string): void {
  currentUser = nickname;
  void refresh();
}

async function onContribute(projectId: string, amount: number): Promise<void> {
  const before = statusOf(projectId);
  const r = await repo.contribute(projectId, currentUser, amount);
  if (!r.ok) {
    setFlash(r.error, "error");
    await refresh(); // 실패도 서버측 변화(지연 마감 정산 등)를 반영해야 함
    return;
  }
  const applied = await refresh();
  if (!applied) return; // 재로딩 실패/경합 — 거짓 "완료" 표시 금지(에러 토스트는 이미 처리)
  const after = statusOf(projectId);
  setFlash(after === "SUCCESS" && before !== "SUCCESS"
    ? "🎉 목표 100% 달성! 정산이 완료됐어요."
    : `${amount.toLocaleString("ko-KR")} P 후원 완료`, "ok");
  render();
}

async function onCreate(draft: DraftValues): Promise<string | null> {
  const r = await repo.create(currentUser, draft);
  if (!r.ok) return r.error;
  await refresh();
  setFlash("펀딩이 개설됐어요", "ok");
  location.hash = `#/f/${r.value.id}`; // hashchange → render(토스트 표시)
  return null;
}

function headerProps(route: string): HeaderProps {
  return {
    users: (snapshot?.users ?? []).map((u) => ({ nickname: u.nickname })),
    currentNick: currentUser, balance: balance(), route, onSwitch: switchUser,
  };
}

function render(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;
  const hash = location.hash || "#/";

  let page: HTMLElement;
  if (!snapshot) {
    page = el("div", { class: "page loading", text: "불러오는 중…" });
  } else {
    const header = headerProps(hash);
    const now = Date.now();
    if (hash.startsWith("#/f/")) {
      const id = hash.slice("#/f/".length);
      page = FundingDetailPage({
        header, project: snapshot.projects.find((p) => p.id === id) ?? null,
        currentNick: currentUser, balance: balance(),
        onContribute: (amount) => void onContribute(id, amount), now,
      });
    } else if (hash === "#/new") {
      page = CreatePage({ header, balance: balance(), onCreate });
    } else if (hash === "#/me") {
      page = WalletPage({
        header, currentNick: currentUser, balance: balance(),
        created: snapshot.myCreated, backed: snapshot.myBacked, now,
      });
    } else {
      page = HomePage(header, snapshot.projects, now);
    }
  }

  const f = flash;
  flash = null;
  root.replaceChildren(page);
  window.scrollTo(0, 0);

  if (f) {
    const toast = el("div", { class: `toast toast--${f.kind}`, role: "status", text: f.text });
    root.append(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 3200);
  }
}

window.addEventListener("hashchange", render);
console.info(`[포인트펀딩] 데이터 모드: ${hasSupabase ? "Supabase(서버)" : "인메모리(로컬 데모)"}`);
render(); // 로딩 화면 먼저
void refresh();
