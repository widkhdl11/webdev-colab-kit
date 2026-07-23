import "@/shared/ui/tokens.css";
import "@/shared/ui/base.css";
import { createRouter } from "@/shared/lib/router";
import { mountStudentsPage } from "@/pages/students/ui";
import { mountStudentDetailPage } from "@/pages/student-detail/ui";
import { mountStudentFormPage } from "@/pages/student-form/ui";

const root = document.getElementById("app");
if (root) {
  createRouter(
    root,
    [
      { path: "students", mount: (r) => mountStudentsPage(r) },
      { path: "students/new", mount: (r) => mountStudentFormPage(r, "create") },
      { path: "students/:id/edit", mount: (r, p) => mountStudentFormPage(r, "edit", p.id) },
      { path: "students/:id", mount: (r, p) => mountStudentDetailPage(r, p.id ?? "") },
    ],
    "students",
  );
}
