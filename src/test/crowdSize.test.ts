import { describe, it, expect } from "vitest";
import {
  CROWD_SIZES,
  CROWD_SIZE_MULTIPLIER,
  crowdAdjustedWait,
  MAX_WAIT_MINUTES,
} from "@/lib/parkModel";

describe("expected crowd size (Ride Optimizer)", () => {
  it("offers exactly Light, Moderate and Busy", () => {
    expect(CROWD_SIZES).toEqual(["Light", "Moderate", "Busy"]);
  });

  it("uses the agreed wait factors", () => {
    expect(CROWD_SIZE_MULTIPLIER).toEqual({ Light: 0.75, Moderate: 1.0, Busy: 1.35 });
  });

  it("leaves Moderate waits at the modelled average", () => {
    expect(crowdAdjustedWait(40, "Moderate")).toBe(40);
  });

  it("lowers waits for Light crowds", () => {
    expect(crowdAdjustedWait(40, "Light")).toBe(30);
  });

  it("raises waits for Busy crowds", () => {
    expect(crowdAdjustedWait(40, "Busy")).toBe(54);
  });

  it("never lets a busy-day wait pass the single-ride ceiling", () => {
    expect(crowdAdjustedWait(142, "Busy")).toBe(MAX_WAIT_MINUTES);
  });

  it("never drops a Light-day wait below the five-minute floor", () => {
    expect(crowdAdjustedWait(5, "Light")).toBe(5);
  });
});
