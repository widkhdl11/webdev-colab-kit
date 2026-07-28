import "@/shared/ui/tokens.css";
import "@/shared/ui/base.css";
import { createRouter } from "@/shared/lib/router";
import { hasSession, getMyAcademy, signOut } from "@/features/auth/api";
import { mountStudentsPage } from "@/pages/students/ui";
import { mountStudentDetailPage } from "@/pages/student-detail/ui";
import { mountStudentFormPage } from "@/pages/student-form/ui";
import { mountEvaluationFormPage } from "@/pages/evaluation-form/ui";
import { mountScoreFormPage } from "@/pages/score-form/ui";
import { mountScheduleFormPage } from "@/pages/schedule-form/ui";
import { mountAuthPage } from "@/pages/auth/ui";
import { mountOnboardingPage } from "@/pages/onboarding/ui";
import { mountSubjectsPage } from "@/pages/subjects/ui";

// 클라이언트 가드는 UX(리다이렉트)일 뿐 — 실제 인가는 서버 RLS가 강제한다(auth-isolation).
// getMyAcademy는 3-state: 소속 있음 / 소속 없음(null) / 확인 실패(err). 확인 실패를 "소속 없음"으로
// 뭉개면 일시 오류에도 온보딩으로 튕기므로, err일 땐 로그인으로 보내 재시도하게 한다.
async function guardApp(run: () => void | Promise<void>): Promise<void> {
  if (!(await hasSession())) { location.hash = "#/login"; return; }
  const a = await getMyAcademy();
  if (!a.ok) { location.hash = "#/login"; return; }
  if (a.value == null) { location.hash = "#/onboarding"; return; }
  await run();
}

// 회원가입 직후 학원 연결 단계 — 세션은 있어야 하고, 이미 소속이 있으면 앱으로.
async function guardOnboarding(run: () => void | Promise<void>): Promise<void> {
  if (!(await hasSession())) { location.hash = "#/login"; return; }
  const a = await getMyAcademy();
  if (!a.ok) { location.hash = "#/login"; return; }
  if (a.value != null) { location.hash = "#/students"; return; }
  await run();
}

// 로그인/회원가입 — 이미 로그인이면: 소속 있으면 앱, 소속 없으면 온보딩. 확인 실패면 폼 노출(재로그인).
async function guardPublic(run: () => void): Promise<void> {
  if (await hasSession()) {
    const a = await getMyAcademy();
    if (a.ok && a.value != null) { location.hash = "#/students"; return; }
    if (a.ok && a.value == null) { location.hash = "#/onboarding"; return; }
  }
  run();
}

const root = document.getElementById("app");
if (root) {
  createRouter(
    root,
    [
      { path: "login", mount: (r) => guardPublic(() => mountAuthPage(r, "login")) },
      { path: "signup", mount: (r) => guardPublic(() => mountAuthPage(r, "signup")) },
      { path: "onboarding", mount: (r) => guardOnboarding(() => mountOnboardingPage(r)) },
      { path: "logout", mount: async () => { await signOut(); location.hash = "#/login"; } },
      { path: "students", mount: (r) => guardApp(() => mountStudentsPage(r)) },
      { path: "subjects", mount: (r) => guardApp(() => mountSubjectsPage(r)) },
      { path: "students/new", mount: (r) => guardApp(() => mountStudentFormPage(r, "create")) },
      { path: "students/:id/edit", mount: (r, p) => guardApp(() => mountStudentFormPage(r, "edit", p.id)) },
      { path: "students/:id/evaluate", mount: (r, p) => guardApp(() => mountEvaluationFormPage(r, p.id ?? "")) },
      { path: "students/:id/evaluate/:evalId/edit", mount: (r, p) => guardApp(() => mountEvaluationFormPage(r, p.id ?? "", "edit", p.evalId)) },
      { path: "students/:id/score", mount: (r, p) => guardApp(() => mountScoreFormPage(r, p.id ?? "")) },
      { path: "students/:id/score/:examId/edit", mount: (r, p) => guardApp(() => mountScoreFormPage(r, p.id ?? "", "edit", p.examId)) },
      { path: "students/:id/schedule", mount: (r, p) => guardApp(() => mountScheduleFormPage(r, p.id ?? "")) },
      { path: "students/:id", mount: (r, p) => guardApp(() => mountStudentDetailPage(r, p.id ?? "")) },
    ],
    "students",
  );
}
