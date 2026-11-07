// Prices are mode-specific. Swap these sets when switching between test and live Stripe keys.
// TEST: monthly price_1UZGapIf0L29xp0dViusJBA8, yearly price_1UZGeoIf0L29xp0dmP3EuGVx, lifetime price_1UZGf5If0L29xp0d7bAttjUP
// LIVE (active):
export const PLANS = {
  monthly: { price: "price_1UYSK1If0L29xp0d51VexFdO", mode: "subscription" as const },
  yearly: { price: "price_1UYSKhIf0L29xp0ds3ip2qKm", mode: "subscription" as const },
  lifetime: { price: "price_1UYSKtIf0L29xp0ddmYgey3N", mode: "payment" as const },
};
export type PlanId = keyof typeof PLANS;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
