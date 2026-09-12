import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { schoolApiFixture } from "./test/schoolApiFixtures";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("./lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/api")>();
  return { ...original, apiFetch: apiFetchMock };
});

const user = {
  id: "user-1",
  username: "aarav.student",
  email: "aarav@example.com",
  first_name: "Aarav",
  last_name: "Sharma",
  display_name: "Aarav Sharma",
  role: "student",
};

function mockSession(membershipRoles: Array<"guardian" | "student" | "staff"> = ["guardian", "student"]) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path === "/api/v1/auth/session/") {
      return Promise.resolve({ authenticated: true, user, csrf_token: "csrf", demo_mode: true });
    }
    if (path === "/api/v1/auth/me/") {
      return Promise.resolve({
        user,
        students: [],
        memberships: membershipRoles.map((role, index) => ({
          id: `membership-${index}`,
          school_id: "school-1",
          school_name: "Cambridge International School",
          role,
        })),
        demo_mode: true,
      });
    }
    return Promise.resolve(schoolApiFixture(path));
  });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  mockSession();
});

afterEach(cleanup);

interface RouteSmokeCase {
  path: string;
  heading: string | RegExp;
}

const implementedScreenRoutes: RouteSmokeCase[] = [
  { path: "/parent/home", heading: "Action Required" },
  { path: "/parent/attendance", heading: "Today's Presence Pulse" },
  { path: "/parent/leave", heading: "Leave Application by Aarav" },
  { path: "/parent/diary", heading: /Wednesday, 16 Sep/ },
  { path: "/student", heading: "Aarav Sharma" },
  { path: "/student/attendance", heading: /Aarav Sharma/ },
  { path: "/student/attendance/eligibility", heading: /Hey Aarav!/ },
  { path: "/student/leave/new", heading: "Apply Leave" },
  { path: "/student/leave", heading: "Leave Tracker" },
  { path: "/student/timetable", heading: "Class 7A Timetable" },
  { path: "/student/timetable/week", heading: "My Timetable" },
];

describe("implemented application routes", () => {
  it.each(implementedScreenRoutes)("renders $path for an authorized session", async ({ path, heading }) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });

  it("renders the parent timetable alias", async () => {
    render(<MemoryRouter initialEntries={["/parent/timetable"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Class 7A Timetable" })).toBeVisible();
  });

  it("opens Copilot from its visible navigation destination", async () => {
    render(<MemoryRouter initialEntries={["/student/copilot"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("dialog", { name: "Attendance Copilot" })).toBeVisible();
  });

  it("renders a real launcher instead of silently changing portals", async () => {
    render(<MemoryRouter initialEntries={["/student/apps"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Everything for school, in one place" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Attendance" })).toBeVisible();
  });

  it("keeps student home distinct and routes Attendance from its navigation", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/student"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Aarav Sharma" })).toBeVisible();
    expect(screen.queryByText("Overall Aggregate")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open digital student ID for Aarav Sharma" }));
    expect(screen.getByRole("dialog", { name: "Aarav Sharma" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close digital student ID" }));
    await user.click(screen.getByRole("link", { name: "Attendance" }));
    expect(await screen.findByText("Overall Aggregate")).toBeVisible();
  });

  it("switches the parent ID card across all accessible children and marks off-campus red", async () => {
    const interact = userEvent.setup();
    const original = apiFetchMock.getMockImplementation() as (path: string) => Promise<unknown>;
    const first = (schoolApiFixture("/api/v1/students/") as { results: Array<{ id: string; user: { display_name: string }; admission_number: string }> }).results[0]!;
    const second = { ...first, id: "student-2", admission_number: "CIS-002", user: { ...first.user, display_name: "Ananya Sharma" } };
    const third = { ...first, id: "student-3", admission_number: "CIS-003", user: { ...first.user, display_name: "Rohan Sharma" } };
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/api/v1/students/") return Promise.resolve({ results: [first, second, third] });
      if (path.startsWith("/api/v1/screens/parent/home/")) {
        const selected = path.includes("student-2") ? second : path.includes("student-3") ? third : first;
        return Promise.resolve({ ...(schoolApiFixture(path) as object), student: selected, siblings: [second, third], campus_presence: null });
      }
      return original(path);
    });
    render(<MemoryRouter initialEntries={["/parent/home"]}><App /></MemoryRouter>);
    expect((await screen.findAllByText("Not on campus"))[0]).toBeVisible();
    expect(document.querySelector(".presence-dot--away")).toBeInTheDocument();
    expect(document.querySelector(".status-pill--danger")).toBeInTheDocument();
    expect(document.querySelector(".child-status-card")).not.toBeInTheDocument();
    const switchToAnanya = await screen.findByRole("button", { name: "Switch to Ananya" });
    expect(document.querySelector(".parent-id-stack.has-three-or-more")).toBeInTheDocument();
    await interact.click(switchToAnanya);
    expect(document.querySelector(".parent-id-stack.is-switching")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Open digital student ID for Ananya Sharma/ })).toBeVisible();
    await interact.click(screen.getByRole("button", { name: "Switch to Rohan" }));
    await interact.click(await screen.findByRole("button", { name: /Open digital student ID for Rohan Sharma/ }));
    expect(screen.getByRole("dialog", { name: "Rohan Sharma" })).toHaveTextContent("CIS-003");
  });

  it("renders the timetable as a weekly period chart without the old tab switcher", async () => {
    render(<MemoryRouter initialEntries={["/student/timetable"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Weekly period chart" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Week Grid" })).not.toBeInTheDocument();
  });
});

describe("authentication and route authorization", () => {
  it("sends an anonymous visitor to sign in and preserves the intended route", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/api/v1/auth/session/") {
        return Promise.resolve({ authenticated: false, user: null, csrf_token: "csrf", demo_mode: true });
      }
      return Promise.reject(new Error("Unexpected request"));
    });
    render(<MemoryRouter initialEntries={["/parent/attendance"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Sign in to your school" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Parent view/i })).toBeVisible();
  });

  it("redirects a student away from parent-only records", async () => {
    mockSession(["student"]);
    render(<MemoryRouter initialEntries={["/parent/home"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Aarav Sharma" })).toBeVisible();
    expect(screen.getByText("Today’s presence")).toBeVisible();
  });

  it("holds a newly registered account outside tenant data until membership exists", async () => {
    mockSession([]);
    render(<MemoryRouter initialEntries={["/student/attendance"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Now connect with your school" })).toBeVisible();
    expect(screen.getByText(/needs to verify your membership/i)).toBeVisible();
  });
});
