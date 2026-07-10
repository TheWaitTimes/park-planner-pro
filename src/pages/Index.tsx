import { useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon, CalendarRange, Gauge, Trophy, FileText, LogIn, LogOut, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoAsset from "@/assets/logo.png.asset.json";
import Home from "@/pages/Home";
import DaySimulator from "@/pages/DaySimulator";
import DayOptimizer from "@/pages/DayOptimizer";
import Rankings from "@/pages/Rankings";
import Blog from "@/pages/Blog";

type Tab = "home" | "simulator" | "optimizer" | "rankings" | "blog";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "simulator", label: "Day Simulator", icon: CalendarRange },
  { id: "optimizer", label: "Day Optimizer", icon: Gauge },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "blog", label: "Blog", icon: FileText },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { session, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header sticky top-0 z-50 shadow-sm border-b border-header-foreground/10">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="font-display text-xl md:text-2xl text-header-foreground tracking-tight font-semibold">
            Main Street <span className="text-header-accent font-normal">Insights</span>
          </h1>
          <div className="flex items-center gap-3 text-sm font-body">
            {session ? (
              <>
                {isAdmin && (
                  <span className="hidden sm:inline-flex items-center text-[11px] uppercase tracking-wide font-semibold text-header-accent border border-header-accent/40 rounded px-2 py-0.5">
                    Admin
                  </span>
                )}
                <span className="hidden md:inline text-header-foreground/60 truncate max-w-[180px]">
                  {session.user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-header-foreground/80 hover:text-header-foreground inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-header-foreground/80 hover:text-header-foreground inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
        {/* Tab Navigation */}
        <nav className="border-t border-header-foreground/10">
          <div className="max-w-7xl mx-auto px-6 flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`font-body text-sm md:text-[15px] font-medium px-4 py-3 transition-colors inline-flex items-center gap-2 border-b-2 -mb-px ${
                    isActive
                      ? "text-header-accent border-header-accent"
                      : "text-header-foreground/70 border-transparent hover:text-header-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {activeTab === "home" && <Home />}
        {activeTab === "simulator" && <DaySimulator />}
        {activeTab === "optimizer" && <DayOptimizer />}
        {activeTab === "rankings" && <Rankings />}
        {activeTab === "blog" && <Blog />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border text-muted-foreground text-center py-6 font-body text-sm mt-12">
        Main Street Insights © 2026
      </footer>
    </div>
  );
}
