import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { PLANS, PlanId, corsHeaders, json } from "../_shared/stripe-plans.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return json({ error: "Please sign in first" }, 401);

    const { plan } = await req.json().catch(() => ({}));
    const chosen = PLANS[plan as PlanId];
    if (!chosen) return json({ error: "Unknown plan" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const origin = req.headers.get("origin") ?? "";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      customer_creation: !customerId && chosen.mode === "payment" ? "always" : undefined,
      line_items: [{ price: chosen.price, quantity: 1 }],
      mode: chosen.mode,
      payment_intent_data: chosen.mode === "payment" ? { metadata: { plan: "lifetime" } } : undefined,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=canceled`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("[create-checkout]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
