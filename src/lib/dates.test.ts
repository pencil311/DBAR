import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  enumerateDates,
  formatDisplayDate,
  formatShortDate,
  fullWeekdayName,
  isValidDateString,
  startOfWeek,
  todayIST,
  toISTDateString,
} from "@/lib/dates";

describe("toISTDateString", () => {
  it("rolls a late-UTC timestamp forward to the correct IST calendar date", () => {
    // 2026-07-04T20:00:00Z is 2026-07-05T01:30:00+05:30 in IST — the classic
    // Vercel-runs-in-UTC bug where a server using local/UTC "today" would
    // mark the day before the one the student actually experienced.
    const moment = new Date("2026-07-04T20:00:00Z");
    expect(toISTDateString(moment)).toBe("2026-07-05");
  });

  it("does not roll over for a timestamp still within the same IST day", () => {
    // 2026-07-04T10:00:00Z is 2026-07-04T15:30:00+05:30 — same IST day.
    const moment = new Date("2026-07-04T10:00:00Z");
    expect(toISTDateString(moment)).toBe("2026-07-04");
  });

  it("handles the midnight-UTC boundary (which is already evening IST)", () => {
    // 2026-01-01T00:00:00Z is 2026-01-01T05:30:00+05:30 — still Jan 1 IST.
    const moment = new Date("2026-01-01T00:00:00Z");
    expect(toISTDateString(moment)).toBe("2026-01-01");
  });
});

describe("todayIST", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-07-04", 1)).toBe("2026-07-05");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("subtracts days across a month boundary", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("handles a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-07-24", "2026-08-12")).toBe(19);
  });

  it("is zero for the same date", () => {
    expect(daysBetween("2026-07-24", "2026-07-24")).toBe(0);
  });

  it("is negative when `toDate` is earlier", () => {
    expect(daysBetween("2026-07-24", "2026-07-20")).toBe(-4);
  });
});

describe("enumerateDates", () => {
  it("lists every date inclusive of both ends", () => {
    expect(enumerateDates("2026-07-01", "2026-07-04")).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
    ]);
  });

  it("returns an empty array when start is after end", () => {
    expect(enumerateDates("2026-07-05", "2026-07-01")).toEqual([]);
  });

  it("returns a single date when start equals end", () => {
    expect(enumerateDates("2026-07-01", "2026-07-01")).toEqual(["2026-07-01"]);
  });
});

describe("isValidDateString", () => {
  it("accepts a well-formed real date", () => {
    expect(isValidDateString("2026-07-06")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidDateString("2026/07/06")).toBe(false);
    expect(isValidDateString("2026-7-6")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });

  it("rejects calendar dates that don't exist", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-04-31")).toBe(false);
  });

  it("accepts a leap day only in a leap year", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
  });
});

describe("formatDisplayDate", () => {
  it("formats with weekday, month, and day", () => {
    expect(formatDisplayDate("2026-07-06")).toBe("Mon, Jul 6");
  });
});

describe("formatShortDate", () => {
  it("formats month and day only", () => {
    expect(formatShortDate("2026-07-01")).toBe("Jul 1");
  });
});

describe("fullWeekdayName", () => {
  it("names a weekend day", () => {
    expect(fullWeekdayName("2026-07-04")).toBe("Saturday");
  });

  it("names a weekday", () => {
    expect(fullWeekdayName("2026-07-06")).toBe("Monday");
  });
});

describe("startOfWeek", () => {
  it("returns the same date when it's already a Monday", () => {
    expect(startOfWeek("2026-07-06")).toBe("2026-07-06");
  });

  it("returns the Monday of the week for a midweek date", () => {
    expect(startOfWeek("2026-07-08")).toBe("2026-07-06"); // Wednesday
  });

  it("returns the Monday of the week for a Saturday", () => {
    expect(startOfWeek("2026-07-04")).toBe("2026-06-29");
  });

  it("returns the Monday of the week for a Sunday", () => {
    expect(startOfWeek("2026-07-05")).toBe("2026-06-29");
  });
});
