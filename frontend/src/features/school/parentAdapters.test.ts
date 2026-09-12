import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptParentAttendance, adaptParentDiary, adaptParentHome } from "./adapters";
import type { ParentAttendanceResponse, ParentDiaryResponse, ParentHomeResponse } from "./api";
import { schoolApiFixture } from "../../test/schoolApiFixtures";

function attendance() {
  return { ...structuredClone(schoolApiFixture("/api/v1/screens/parent/attendance/")), subjects: [] } as ParentAttendanceResponse;
}
afterEach(() => vi.useRealTimers());

describe("parent school records", () => {
  it("uses the configured attendance minimum and distinguishes missing presence", () => {
    const data = structuredClone(schoolApiFixture("/api/v1/screens/parent/home/")) as ParentHomeResponse;
    data.attendance.percentage = 80;
    data.semester_metrics.attendance_threshold = 75;
    data.campus_presence = null;
    const result = adaptParentHome(data);
    expect(result.metrics.attendanceStatus).toBe("On track");
    expect(result.presence.status).toBe("Presence not recorded");
  });

  it("does not present checkout or yesterday’s gate event as today’s check-in", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T09:00:00Z"));
    const data = attendance();
    data.today = null;
    data.latest_gate_event = { occurred_at: "2026-09-16T08:00:00Z", direction: "out", gate: "North", source: "RFID" };
    expect(adaptParentAttendance(data).today.checkInVerified).toBe(false);
    data.latest_gate_event = { ...data.latest_gate_event, direction: "in", occurred_at: "2026-09-15T03:00:00Z" };
    expect(adaptParentAttendance(data).today.checkInVerified).toBe(false);
    data.latest_gate_event.occurred_at = "2026-09-16T03:00:00Z";
    expect(adaptParentAttendance(data).today.checkInVerified).toBe(true);
  });

  it("preserves late and half-day records in the calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T09:00:00Z"));
    const data = attendance();
    data.calendar = [
      { id: "late", date: "2026-09-15", status: "late", check_in_at: null, check_out_at: null, remarks: "" },
      { id: "half", date: "2026-09-16", status: "half_day", check_in_at: null, check_out_at: null, remarks: "" },
    ];
    const result = adaptParentAttendance(data);
    expect(result.month.days.find((day) => day.id === "2026-09-15")?.status).toBe("late");
    expect(result.month.days.find((day) => day.id === "2026-09-16")?.status).toBe("half_day");
  });

  it("includes the selected Sunday in the diary week", () => {
    const data = structuredClone(schoolApiFixture("/api/v1/screens/parent/diary/")) as ParentDiaryResponse;
    data.date = "2026-09-20";
    expect(adaptParentDiary(data).days.map((day) => day.id)).toContain(data.date);
  });
});
