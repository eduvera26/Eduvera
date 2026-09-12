import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CalendarX2,
  ChevronDown,
  Home,
  ListChecks,
} from "lucide-react";
import { AccountMenu } from "../../features/auth/AccountMenu";
import { useOptionalAuth } from "../../features/auth/AuthContext";
import { NotificationCenter } from "../../features/notifications/NotificationCenter";
import { getAccessibleStudents } from "../../features/school/api";
import { demoParentChild } from "./parentDemoData";
import type { ParentChildSummary, ParentPageAction } from "./parentTypes";
import "./parent-pages.css";

export type ParentRoute = "home" | "attendance" | "leave" | "diary" | "timetable";

const parentRoutes: Array<{
  id: ParentRoute;
  label: string;
  path: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Home", path: "/parent/home", icon: Home },
  { id: "attendance", label: "Attendance", path: "/parent/attendance", icon: ListChecks },
  { id: "leave", label: "Leave", path: "/parent/leave", icon: CalendarX2 },
  { id: "diary", label: "Diary", path: "/parent/diary", icon: BookOpen },
  { id: "timetable", label: "Timetable", path: "/parent/timetable", icon: CalendarDays },
];

export interface ParentShellProps {
  active: ParentRoute;
  pageLabel: string;
  child?: ParentChildSummary;
  children: ReactNode;
  onSelectChild?: (childId: string) => ParentPageAction;
  childOptions?: Array<{ id: string; name: string; grade: string; section: string }>;
  presenceStatus?: "in" | "away";
}

export function ParentShell({
  active,
  pageLabel,
  child = demoParentChild,
  children,
  onSelectChild,
  childOptions,
  presenceStatus,
}: ParentShellProps) {
  const auth = useOptionalAuth();
  const schoolName = auth?.memberships.find((membership) => membership.role === "guardian")?.school_name ?? "Cambridge International School";
  const schoolCrest = schoolName.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  const [searchParams] = useSearchParams();
  const selectedStudentId = searchParams.get("student_id");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const studentsQuery = useQuery({
    queryKey: ["school", "accessible-students"],
    queryFn: getAccessibleStudents,
    staleTime: 60_000,
  });
  const accessibleChildren = studentsQuery.data?.results.map((student) => ({
    id: student.id,
    name: student.user.display_name,
    grade: `Grade ${student.current_enrollment.grade}`,
    section: student.current_enrollment.section,
  }));
  const selectableChildren = accessibleChildren?.length
    ? accessibleChildren
    : childOptions?.length ? childOptions : [child];

  const chooseChild = async (childId: string) => {
    await onSelectChild?.(childId);
    setSelectorOpen(false);
  };

  return (
    <div className="parent-app">
      <header className="parent-header">
        <div className="parent-header__top">
          <div className="parent-brand" aria-label={schoolName}>
            <span className="parent-brand__crest" aria-hidden="true">{schoolCrest}</span>
            <span className="parent-brand__name">{schoolName}</span>
          </div>
          <div className="parent-header__actions">
            <NotificationCenter buttonClassName="icon-button" iconSize={20} />
            <AccountMenu buttonClassName="profile-button" ariaLabel="Open parent profile" iconSize={20} />
          </div>
        </div>
        <div className="parent-header__context">
          <div className="child-switcher-wrap">
            <button
              className="child-switcher"
              type="button"
              aria-expanded={selectorOpen}
              aria-haspopup={selectableChildren.length > 1 ? "listbox" : undefined}
              onClick={() => selectableChildren.length > 1 && setSelectorOpen((current) => !current)}
            >
              <span className={presenceStatus === "in" ? "presence-dot presence-dot--in" : presenceStatus === "away" ? "presence-dot presence-dot--away" : "presence-dot"} />
              <span>{child.name} • Class {child.grade.replace("Grade ", "")}{child.section}</span>
              {selectableChildren.length > 1 ? <ChevronDown size={15} /> : null}
            </button>
            {selectorOpen && selectableChildren.length > 1 ? (
              <div className="child-menu" role="listbox" aria-label="Select child">
                {selectableChildren.map((option) => (
                  <button key={option.id} type="button" role="option" aria-selected={option.id === child.id} onClick={() => void chooseChild(option.id)}>
                    <strong>{option.name}</strong>
                    <span>{option.grade} • Section {option.section}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="parent-header__page">{pageLabel}</span>
        </div>
      </header>

      <main className="parent-main">{children}</main>

      <nav className="parent-bottom-nav" aria-label="Parent portal navigation">
        {parentRoutes.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <NavLink
              key={item.id}
              className={isActive ? "parent-nav-item is-active" : "parent-nav-item"}
              to={selectedStudentId ? `${item.path}?student_id=${encodeURIComponent(selectedStudentId)}` : item.path}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={isActive ? 2.25 : 1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
