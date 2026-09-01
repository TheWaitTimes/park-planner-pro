import { useState } from "react";
import { Link } from "react-router-dom";
import msiLogo from "@/assets/msi-logo.png.asset.json";
import { Home as HomeIcon, CalendarRange, Gauge, Zap, Trophy, FileText, LogIn, LogOut, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import DaySimulator from "@/pages/DaySimulator";
import DayOptimizer from "@/pages/DayOptimizer";
import LightningLanes from "@/pages/LightningLanes";
import Rankings from "@/pages/Rankings";
import Blog from "@/pages/Blog";

type Tab = "home" | "simulator" | "optimizer" | "lanes" | "rankings" | "blog";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "simulator", label: "Day Simulator", icon: CalendarRange },
  { id: "optimizer", label: "Day Optimizer", icon: Gauge },
  { id: "lanes", label: "Lightning Lanes", icon: Zap },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "blog", label: "Blog", icon: FileText },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [simulatorPark, setSimulatorPark] = useState<string | undefined>(undefined);
  const { session, isAdmin, signOut } = useAuth();


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header sticky top-0 z-50 shadow-sm border-b border-header-foreground/10">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src={msiLogo.url}
              alt="Main Street Insights logo"
              width={446}
              height={512}
              className="h-10 sm:h-14 md:h-16 w-auto shrink-0"
              loading="eager"
              decoding="async"
            />
            <h1 className="font-display text-base sm:text-xl md:text-2xl text-header-foreground tracking-tight font-semibold whitespace-nowrap">
              Main Street <span className="text-header-accent font-normal">Insights</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-sm font-body shrink-0">
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
                  aria-label="Sign out"
                  className="text-header-foreground/80 hover:text-header-foreground inline-flex items-center gap-1.5 min-h-[44px] px-1"
                >
                  <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                aria-label="Sign in"
                className="text-header-foreground/80 hover:text-header-foreground inline-flex items-center gap-1.5 min-h-[44px] px-1"
              >
                <LogIn className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            )}
          </div>
        </div>
        {/* Tab Navigation */}
        <nav className="hidden md:block border-t border-header-foreground/10">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`font-body text-sm md:text-[15px] font-medium px-3 sm:px-4 py-3 transition-colors inline-flex items-center gap-2 border-b-2 -mb-px shrink-0 snap-start whitespace-nowrap ${
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 md:pb-10">

        {activeTab === "home" && (
          <Home
            onPlanPark={(park) => {
              setSimulatorPark(park);
              setActiveTab("simulator");
            }}
          />
        )}
        {activeTab === "simulator" && <DaySimulator initialPark={simulatorPark} />}

        {activeTab === "optimizer" && <DayOptimizer />}
        {activeTab === "lanes" && <LightningLanes />}
        {activeTab === "rankings" && <Rankings />}
        {activeTab === "blog" && <Blog />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border text-muted-foreground text-center py-6 font-body text-sm mt-12 pb-bottom-nav md:pb-0">
        Main Street Insights © 2026
      </footer>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Sections"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-header border-t border-header-foreground/10 bottom-nav-safe"
      >
        <div className="grid grid-cols-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 py-2 font-body text-[10px] font-medium transition-colors ${
                  isActive ? "text-header-accent" : "text-header-foreground/70"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                <span className="leading-none truncate max-w-full">
                  {tab.label.replace("Day ", "").replace("Lightning Lanes", "Lanes")}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
