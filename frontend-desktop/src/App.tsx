import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import { AttendanceIndex, RegisterPage } from "./pages/AttendancePage";
import { LeavePage } from "./pages/LeavePage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PrincipalHome } from "./pages/PrincipalHome";
import { TeacherHome } from "./pages/TeacherHome";
import { TimetablePage } from "./pages/TimetablePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

function RequireStaff() {
  const { status, persona } = useAuth();
  if (status === "loading") return <div style={{ padding: 40, color: "var(--faint)" }}>Loading…</div>;
  if (status !== "signed-in" || !persona) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequirePrincipal() {
  const { persona } = useAuth();
  return persona === "principal" ? <Outlet /> : <Navigate to="/" replace />;
}

function Home() {
  const { persona } = useAuth();
  return persona === "principal" ? <PrincipalHome /> : <TeacherHome />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireStaff />}>
                <Route element={<Shell />}>
                  <Route index element={<Home />} />
                  <Route path="attendance" element={<AttendanceIndex />} />
                  <Route path="attendance/:classId" element={<RegisterPage />} />
                  <Route path="leave" element={<LeavePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route element={<RequirePrincipal />}>
                    <Route path="timetable" element={<TimetablePage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
