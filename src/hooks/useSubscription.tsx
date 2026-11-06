import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PlanId } from "@/lib/plans";

interface SubState {
  subscribed: boolean;
  plan: PlanId | null;
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
  checking: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SubState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState({
    subscribed: false,
    plan: null as PlanId | null,
    subscriptionEnd: null as string | null,
    cancelAtPeriodEnd: false,
  });
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setState({ subscribed: false, plan: null, subscriptionEnd: null, cancelAtPeriodEnd: false });
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("check-subscription");
    setChecking(false);
    if (error || !data) return;
    setState({
      subscribed: !!data.subscribed,
      plan: data.plan ?? null,
      subscriptionEnd: data.subscription_end ?? null,
      cancelAtPeriodEnd: !!data.cancel_at_period_end,
    });
  }, [session]);

  useEffect(() => {
    refresh();
    if (!session) return;
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh, session]);

  return <Ctx.Provider value={{ ...state, checking, refresh }}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
