import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import "@/shared/ui/tokens.css";
import "@/shared/ui/base.css";
import {
  hasSession, getMyAcademy, getSessionHeader, signOut, onSignedOut, type SessionHeader,
} from "@/features/auth/api";
import { Header } from "@/widgets/header/ui";
import { StudentsPage } from "@/pages/students/ui";
import { StudentDetailPage } from "@/pages/student-detail/ui";
import { StudentFormPage } from "@/pages/student-form/ui";
import { EvaluationFormPage } from "@/pages/evaluation-form/ui";
import { ScoreFormPage } from "@/pages/score-form/ui";
import { ScheduleFormPage } from "@/pages/schedule-form/ui";
import { AuthPage } from "@/pages/auth/ui";
import { OnboardingPage } from "@/pages/onboarding/ui";
import { SubjectsPage } from "@/pages/subjects/ui";
import { StatsPage } from "@/pages/stats/ui";
import { AcademySettingsPage } from "@/pages/academy-settings/ui";
import { PaymentNoticePage } from "@/pages/payment-notice/ui";

// 앱 전체가 이 한 파일에 있는 이유: FSD 게이트가 같은 레이어의 다른 슬라이스 import 를 막는다.
// app/ 을 여러 파일로 쪼개면 서로가 cross-slice 가 되므로, 부트스트랩은 한 파일로 둔다.

// 클라이언트 가드는 UX(리다이렉트)일 뿐 — 실제 인가는 서버 RLS가 강제한다(auth-isolation).
// 그래서 라우트마다가 아니라 이 레이아웃이 마운트될 때 한 번만 확인한다(내비게이션마다 로딩 깜빡임 방지).
type GuardState =
  | { readonly status: "checking" }
  | { readonly status: "allow" }
  | { readonly status: "redirect"; readonly to: string };

function Checking(): ReactNode {
  return <main className="container page"><p className="page__desc">확인 중…</p></main>;
}

// 앱 본문 — 세션 + 학원 소속이 모두 있어야 들어온다.
// getMyAcademy는 3-state: 소속 있음 / 소속 없음(null) / 확인 실패(err). 확인 실패를 "소속 없음"으로
// 뭉개면 일시 오류에도 온보딩으로 튕기므로, err일 땐 로그인으로 보내 재시도하게 한다.
function AppLayout(): ReactNode {
  const [guard, setGuard] = useState<GuardState>({ status: "checking" });
  const [hdr, setHdr] = useState<SessionHeader | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await hasSession())) { if (alive) setGuard({ status: "redirect", to: "/login" }); return; }
      const a = await getMyAcademy();
      if (!alive) return;
      if (!a.ok) { setGuard({ status: "redirect", to: "/login" }); return; }
      if (a.value == null) { setGuard({ status: "redirect", to: "/onboarding" }); return; }
      // 헤더까지 받은 뒤에 통과시킨다 — 나중에 붙이면 sticky 헤더가 삽입되며 본문이 그 높이만큼 아래로 점프한다.
      // getMyAcademy 는 이미 캐시됐으므로 추가 왕복은 getUser 하나뿐이다.
      const h = await getSessionHeader();
      if (!alive) return;
      setHdr(h);
      setGuard({ status: "allow" });
    })();
    return () => { alive = false; };
  }, []);

  // 가드는 진입 시 1회만 돈다(내비게이션마다 재검사하면 이동할 때마다 로딩이 깜빡인다).
  // 대신 그 뒤 세션이 죽는 건 구독으로 잡는다 — 그러지 않으면 로그아웃된 화면이 그대로 남는다.
  useEffect(() => onSignedOut(() => setGuard({ status: "redirect", to: "/login" })), []);

  // 리다이렉트 판정이 먼저다 — hdr 은 통과 경로에서만 채워지므로 순서가 뒤집히면 영영 "확인 중…"에 갇힌다.
  if (guard.status === "redirect") return <Navigate to={guard.to} replace />;
  if (guard.status === "checking" || hdr === null) return <Checking />;
  return (
    <>
      <Header academyName={hdr.academyName} teacher={{ name: hdr.teacherName }} />
      <Outlet />
    </>
  );
}

// 회원가입 직후 학원 연결 단계 — 세션은 있어야 하고, 이미 소속이 있으면 앱으로.
function OnboardingGuard(): ReactNode {
  const [guard, setGuard] = useState<GuardState>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await hasSession())) { if (alive) setGuard({ status: "redirect", to: "/login" }); return; }
      const a = await getMyAcademy();
      if (!alive) return;
      if (!a.ok) { setGuard({ status: "redirect", to: "/login" }); return; }
      if (a.value != null) { setGuard({ status: "redirect", to: "/students" }); return; }
      setGuard({ status: "allow" });
    })();
    return () => { alive = false; };
  }, []);

  if (guard.status === "checking") return <Checking />;
  if (guard.status === "redirect") return <Navigate to={guard.to} replace />;
  return <Outlet />;
}

// 로그인/회원가입 — 이미 로그인이면: 소속 있으면 앱, 소속 없으면 온보딩. 확인 실패면 폼 노출(재로그인).
function PublicGuard(): ReactNode {
  const [guard, setGuard] = useState<GuardState>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await hasSession())) { if (alive) setGuard({ status: "allow" }); return; }
      const a = await getMyAcademy();
      if (!alive) return;
      if (a.ok && a.value != null) { setGuard({ status: "redirect", to: "/students" }); return; }
      if (a.ok && a.value == null) { setGuard({ status: "redirect", to: "/onboarding" }); return; }
      setGuard({ status: "allow" });
    })();
    return () => { alive = false; };
  }, []);

  if (guard.status === "checking") return <Checking />;
  if (guard.status === "redirect") return <Navigate to={guard.to} replace />;
  return <Outlet />;
}

function LogoutRoute(): ReactNode {
  const navigate = useNavigate();
  // 로그아웃은 어떻게든 끝나야 한다 — signOut 이 실패해도 로그인으로 보낸다(캐시는 signOut 첫 줄에서 이미 비워진다).
  // finally 가 없으면 실패 시 "확인 중…"에 영구 체류 + unhandled rejection 이 된다.
  useEffect(() => {
    void (async () => {
      try { await signOut(); } finally { navigate("/login", { replace: true }); }
    })();
  }, [navigate]);
  return <Checking />;
}

function App(): ReactNode {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicGuard />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
        </Route>

        <Route element={<OnboardingGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>

        <Route path="/logout" element={<LogoutRoute />} />

        <Route element={<AppLayout />}>
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<AcademySettingsPage />} />
          <Route path="/students/new" element={<StudentFormPage mode="create" />} />
          <Route path="/students/:id/edit" element={<StudentFormPage mode="edit" />} />
          <Route path="/students/:id/evaluate" element={<EvaluationFormPage />} />
          <Route path="/students/:id/evaluate/:evalId/edit" element={<EvaluationFormPage mode="edit" />} />
          <Route path="/students/:id/score" element={<ScoreFormPage />} />
          <Route path="/students/:id/score/:examId/edit" element={<ScoreFormPage mode="edit" />} />
          <Route path="/students/:id/schedule" element={<ScheduleFormPage />} />
          <Route path="/students/:id/notice" element={<PaymentNoticePage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/students" replace />} />
      </Routes>
    </HashRouter>
  );
}

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(<StrictMode><App /></StrictMode>);
}
