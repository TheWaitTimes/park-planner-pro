import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS, type PlanId } from "@/lib/plans";

export default function Paywall({ toolName }: { toolName: string }) {
  const { session } = useAuth();
  const { refresh, checking } = useSubscription();
  const { toast } = useToast();
  const [busy, setBusy] = useState<PlanId | null>(null);

  const buy = async (plan: PlanId) => {
    setBusy(plan);
    const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plan } });
    setBusy(null);
    if (error || !data?.url) {
      toast({ title: "Couldn't start checkout", description: data?.error ?? "Please try again." });
      return;
    }
    window.open(data.url, "_blank");
  };

  return (
    <section className="mx-auto max-w-3xl text-center py-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
        <Lock className="h-5 w-5 text-secondary" />
      </div>
      <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold text-foreground">
        {toolName === "Pro" ? "Go Pro" : `${toolName} is a Pro tool`}
      </h2>
      <p className="mt-2 font-body text-muted-foreground">
        Pro unlocks the Day Simulator, Day Planner, Crowd Estimator and Ride Optimizer.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-5 flex flex-col">
            <div className="font-display text-lg font-semibold text-foreground">{p.name}</div>
            <div className="mt-2 font-display text-3xl font-bold text-foreground">{p.price}</div>
            <div className="font-body text-sm text-muted-foreground">{p.cadence}</div>
            {p.note && <div className="mt-1 text-xs font-semibold text-secondary">{p.note}</div>}
            <ul className="mt-4 space-y-1 text-left font-body text-sm text-foreground flex-1">
              <li className="flex gap-2"><Check className="h-4 w-4 text-secondary shrink-0" />All four Pro tools</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-secondary shrink-0" />
                {p.id === "lifetime" ? "Pay once, keep forever" : "Cancel anytime"}
              </li>
            </ul>
            {session ? (
              <Button className="mt-5 min-h-[44px]" onClick={() => buy(p.id)} disabled={busy !== null}>
                {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Choose ${p.name}`}
              </Button>
            ) : (
              <Button asChild className="mt-5 min-h-[44px]"><Link to="/login">Sign in to subscribe</Link></Button>
            )}
          </div>
        ))}
      </div>

      {session && (
        <Button variant="ghost" className="mt-6" onClick={refresh} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          Already paid? Refresh my access
        </Button>
      )}
    </section>
  );
}
