import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CalendarClock, CreditCard, Loader2, RefreshCw, Crown } from "lucide-react";
import bayLakeLogo from "@/assets/bay-lake-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS } from "@/lib/plans";
import Paywall from "@/components/Paywall";
import SocialLinksAdmin from "@/components/SocialLinksAdmin";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

export default function ProDashboard() {
  const { session, isAdmin, loading } = useAuth();
  const { subscribed, plan, subscriptionEnd, cancelAtPeriodEnd, checking, refresh } = useSubscription();
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    document.title = "My Pro | Bay Lake Insights Co.";
  }, []);

  if (!loading && !session) return <Navigate to="/login" replace />;

  const planInfo = PLANS.find((p) => p.id === plan);
  const isLifetime = plan === "lifetime";

  const openPortal = async () => {
    setOpening(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setOpening(false);
    if (error || !data?.url) {
      toast({ title: "Couldn't open billing", description: data?.error ?? "Please try again." });
      return;
    }
    window.open(data.url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header border-b border-header-foreground/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={bayLakeLogo.url} alt="Bay Lake Insights Co. logo" className="h-14 w-14 object-contain shrink-0" />
            <span className="font-display text-lg font-semibold text-header-foreground">Bay Lake Insights Co.</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-body text-header-foreground/80 hover:text-header-foreground min-h-[44px]">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">My Pro</h1>
            <p className="mt-1 font-body text-muted-foreground">{session?.user.email}</p>
          </div>
          <Button variant="ghost" onClick={refresh} disabled={checking}>
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {!subscribed ? (
          <div className="mt-8"><Paywall toolName="Pro" /></div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-secondary" /> Status
                </div>
                <div className="mt-2 font-display text-2xl font-semibold text-foreground">
                  {cancelAtPeriodEnd ? "Ending soon" : "Active"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <Crown className="h-4 w-4 text-secondary" /> Plan
                </div>
                <div className="mt-2 font-display text-2xl font-semibold text-foreground">{planInfo?.name ?? "Pro"}</div>
                <div className="font-body text-sm text-muted-foreground">{planInfo ? `${planInfo.price} ${planInfo.cadence}` : ""}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <CalendarClock className="h-4 w-4 text-secondary" />
                  {isLifetime ? "Next payment" : cancelAtPeriodEnd ? "Access ends" : "Next payment"}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold text-foreground">
                  {isLifetime ? "None" : fmtDate(subscriptionEnd)}
                </div>
                {isLifetime && <div className="font-body text-sm text-muted-foreground">Paid once, yours forever</div>}
              </div>
            </div>

            <section className="mt-6 rounded-lg border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-secondary mt-0.5" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Payment details</h2>
                  <p className="font-body text-sm text-muted-foreground">
                    Update your card, see receipts{isLifetime ? "" : ", or cancel your plan"} on Stripe's secure page.
                  </p>
                </div>
              </div>
              <Button onClick={openPortal} disabled={opening} className="min-h-[44px]">
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage payment details"}
              </Button>
            </section>
          </>
        )}

        {isAdmin && <SocialLinksAdmin />}
      </main>
    </div>
  );
}
