import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, ClipboardCheck, FileText, LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { normaliseNotifications, staffApi } from "../features/staff";
import { useAuth, type Persona } from "../lib/auth";
import { Initials } from "./ui";

interface NavItem { to: string; label: string; icon: typeof LayoutGrid; personas: Persona[] }

/* Navigation is derived from persona, not a fixed menu. */
const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutGrid, personas: ["principal", "teacher"] },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck, personas: ["principal", "teacher"] },
  { to: "/leave", label: "Leave requests", icon: FileText, personas: ["principal", "teacher"] },
  { to: "/timetable", label: "Timetable", icon: CalendarDays, personas: ["principal"] },
  { to: "/notifications", label: "Notifications", icon: Bell, personas: ["principal", "teacher"] },
];

function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.getAttribute("data-theme") ?? "");
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);
  const isDark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return { isDark, toggle: () => setTheme(isDark ? "light" : "dark") };
}

export function Shell() {
  const { user, persona, school, logout, demoMode } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const unread = useQuery({
    queryKey: ["notifications"],
    queryFn: staffApi.notifications,
    select: (v) => normaliseNotifications(v).filter((n) => !n.read_at).length,
    staleTime: 30_000,
  });
  const items = NAV.filter((n) => persona && n.personas.includes(persona));
  const current = items.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)));

  return (
    <div className="app">
      <aside className="side">
        <div style={{ padding: "0 18px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 17, letterSpacing: ".14em", fontWeight: 700 }}>OMNISCHOOL</div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{school?.school_name ?? "—"}</div>
            <div style={{ fontSize: 11, color: "var(--faint)" }}>{persona === "principal" ? "Leadership" : "Teaching"} · staff console</div>
          </div>
        </div>

        <nav className="grp" aria-label="Main">
          <div className="lbl" style={{ padding: "0 10px 6px" }}>Authorized tools</div>
          {items.map((n) => {
            const Icon = n.icon;
            const badge = n.to === "/notifications" && unread.data ? <span className="badge" style={{ color: "var(--cri)", background: "var(--cri-bg)" }}>{unread.data}</span> : null;
            return (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className="nav-i">
                <Icon size={16} strokeWidth={1.8} /><span>{n.label}</span>{badge}
              </NavLink>
            );
          })}
        </nav>

        {persona === "teacher" ? (
          <div className="grp" style={{ marginTop: "auto" }}>
            <div className="lbl" style={{ padding: "0 10px 6px" }}>Not available to you</div>
            <div className="nav-i" style={{ opacity: .45 }} aria-disabled="true"><CalendarDays size={16} strokeWidth={1.8} /><span>Timetable</span></div>
          </div>
        ) : null}

        <div style={{ marginTop: persona === "teacher" ? 0 : "auto", padding: "14px 18px 0", borderTop: "1px solid var(--line-3)", display: "flex", alignItems: "center", gap: 10 }}>
          <Initials name={user?.display_name ?? "?"} src={user?.avatar_url} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.display_name}</div>
            <div style={{ fontSize: 11, color: "var(--faint)" }}>{persona === "principal" ? "Principal" : "Teacher"}</div>
          </div>
          <button className="btn sm" style={{ marginLeft: "auto", padding: 6 }} onClick={() => void logout()} aria-label="Sign out" title="Sign out"><LogOut size={14} /></button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{current?.label ?? "Staff console"}</div>
          {demoMode ? <span className="st neu" style={{ fontSize: 11 }}>Demo data</span> : null}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            <button className="btn sm" onClick={toggle} aria-label="Toggle theme" style={{ padding: 6 }}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>
        </div>
        <div className="body"><Outlet /></div>
      </div>
    </div>
  );
}
