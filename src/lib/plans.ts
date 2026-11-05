export type PlanId = "monthly" | "yearly" | "lifetime";

export const PLANS: { id: PlanId; name: string; price: string; cadence: string; note?: string }[] = [
  { id: "monthly", name: "Monthly", price: "$1.99", cadence: "per month" },
  { id: "yearly", name: "Yearly", price: "$20", cadence: "per year", note: "Save 16%" },
  { id: "lifetime", name: "Lifetime", price: "$35", cadence: "one time" },
];

export const PAID_TABS = ["simulator", "optimizer", "crowds", "rideopt"] as const;

export const isPaidTab = (tab: string) => (PAID_TABS as readonly string[]).includes(tab);
