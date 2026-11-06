import { describe, it, expect } from "vitest";
import { isPaidTab, PLANS } from "@/lib/plans";

describe("paid tier", () => {
  it("locks the four planning tools", () => {
    for (const t of ["simulator", "optimizer", "crowds", "rideopt"]) expect(isPaidTab(t)).toBe(true);
  });
  it("keeps the rest free", () => {
    for (const t of ["home", "calendar", "lanes", "rankings", "blog"]) expect(isPaidTab(t)).toBe(false);
  });
  it("lists the agreed prices", () => {
    expect(PLANS.map((p) => p.price)).toEqual(["$1.99", "$20", "$35"]);
  });
});
