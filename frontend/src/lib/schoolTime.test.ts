import { describe, expect, it } from "vitest";

import { schoolClock, shiftSchoolDate } from "./schoolTime";

describe("school time helpers", () => {
  it("uses the school timezone at the UTC date boundary", () => {
    expect(schoolClock(new Date("2026-09-10T19:00:00.000Z"))).toEqual({
      date: "2026-09-11",
      weekday: 5,
      minutes: 30,
    });
  });

  it("shifts ISO calendar dates without browser timezone drift", () => {
    expect(shiftSchoolDate(1, "2026-12-31")).toBe("2027-01-01");
    expect(shiftSchoolDate(-1, "2026-03-01")).toBe("2026-02-28");
  });
});

