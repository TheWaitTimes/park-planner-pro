import { describe, it, expect } from "vitest";
import { scoreFromIndex, holidayFactor, labelForScore } from "@/lib/crowdEstimator";

describe("crowd estimator", () => {
  it("maps a typical day (1.0x) to a mid score", () => expect(scoreFromIndex(1)).toBe(6));
  it("clamps the score between 1 and 10", () => {
    expect(scoreFromIndex(0.2)).toBe(1);
    expect(scoreFromIndex(2)).toBe(10);
  });
  it("flags Christmas week as a peak", () => expect(holidayFactor(new Date(2026, 11, 26)).factor).toBe(1.3));
  it("finds Thanksgiving 2026 (Nov 26)", () => expect(holidayFactor(new Date(2026, 10, 26)).label).toBe("Thanksgiving week"));
  it("labels scores 1-3 as Light", () => expect(labelForScore(3)).toBe("Light"));
});
