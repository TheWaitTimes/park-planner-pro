import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { PLANS, corsHeaders, json } from "../_shared/stripe-plans.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return json({ subscribed: false });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: "active", limit: 5 });
      for (const s of subs.data) {
        const item = s.items.data[0];
        const price = item?.price.id;
        const plan = price === PLANS.yearly.price ? "yearly" : price === PLANS.monthly.price ? "monthly" : null;
        if (plan) {
          const end = item?.current_period_end ?? (s as any).current_period_end;
          return json({ subscribed: true, plan, subscription_end: end ? new Date(end * 1000).toISOString() : null });
        }
      }
      const pis = await stripe.paymentIntents.list({ customer: c.id, limit: 100 });
      if (pis.data.some((p) => p.status === "succeeded" && p.metadata?.plan === "lifetime")) {
        return json({ subscribed: true, plan: "lifetime", subscription_end: null });
      }
    }
    return json({ subscribed: false });
  } catch (e) {
    console.error("[check-subscription]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
