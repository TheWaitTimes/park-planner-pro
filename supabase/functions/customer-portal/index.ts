import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, json } from "../_shared/stripe-plans.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    if (!data.user?.email) return json({ error: "Please sign in first" }, 401);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: data.user.email, limit: 1 });
    if (!customers.data.length) return json({ error: "No billing account found" }, 404);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${req.headers.get("origin") ?? ""}/account`,
    });
    return json({ url: portal.url });
  } catch (e) {
    console.error("[customer-portal]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
