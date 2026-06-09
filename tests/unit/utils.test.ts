import { describe, expect, it } from "vitest";
import { parseDate } from "@/lib/utils";

describe("parseDate", () => {
  it("parses Brazilian dd/MM/yyyy with time as day/month, not month/day", () => {
    const parsed = parseDate("01/06/2026 12:05");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(5); // June (0-indexed), not January
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getHours()).toBe(12);
    expect(parsed?.getMinutes()).toBe(5);
  });

  it("parses dd/MM/yyyy without time and high day numbers", () => {
    const parsed = parseDate("18/05/2026");
    expect(parsed?.getMonth()).toBe(4); // May
    expect(parsed?.getDate()).toBe(18);
  });

  it("still parses ISO strings and passes Date instances through", () => {
    expect(parseDate("2026-06-01T12:00:00.000Z")?.toISOString()).toBe("2026-06-01T12:00:00.000Z");
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(parseDate(date)).toBe(date);
  });

  it("returns undefined for empty or invalid values", () => {
    expect(parseDate("")).toBeUndefined();
    expect(parseDate(" ")).toBeUndefined();
    expect(parseDate(null)).toBeUndefined();
    expect(parseDate("not a date")).toBeUndefined();
  });
});
