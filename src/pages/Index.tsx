import { useState } from "react";
import { Link } from "react-router-dom";
import bayLakeLogo from "@/assets/bay-lake-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, CalendarRange, CalendarDays, Gauge, Zap, Trophy, Target, Users, LogIn, LogOut, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import DaySimulator from "@/pages/DaySimulator";
import DayOptimizer from "@/pages/DayOptimizer";
import RideOptimizer from "@/pages/RideOptimizer";
import LightningLanes from "@/pages/LightningLanes";
import ParkCalendar from "@/pages/ParkCalendar";
import Rankings from "@/pages/Rankings";
import CrowdEstimator from "@/pages/CrowdEstimator";

type Tab = "home" | "calendar" | "simulator" | "optimizer" | "lanes" | "rankings" | "rideopt" | "crowds";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "simulator", label: "Day Simulator", icon: CalendarRange },
  { id: "optimizer", label: "Day Planner", icon: Gauge },
  { id: "rideopt", label: "Ride Optimizer", icon: Target },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "lanes", label: "Lightning Lanes", icon: Zap },
  { id: "calendar", label: "Park Calendar", icon: CalendarDays },
  { id: "crowds", label: "Crowd Estimator", icon: Users },
];


export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [simulatorPark, setSimulatorPark] = useState<string | undefined>(undefined);
  const [calendarPark, setCalendarPark] = useState<string | undefined>(undefined);
  const { session, isAdmin, signOut } = useAuth();


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header sticky top-0 z-50 shadow-sm border-b border-header-foreground/10">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src={bayLakeLogo.url}
              alt="Bay Lake Insights Co. logo"
              width={2000}
              height={2000}
              className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain shrink-0"
              loading="eager"
              decoding="async"
            />
            <h1 className="font-display text-base sm:text-xl md:text-2xl text-header-foreground font-semibold leading-tight">
              Bay Lake Insights Co.
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
                <Button variant="ghost"
                  onClick={signOut}
                  aria-label="Sign out"
                  className="text-header-foreground/80 hover:text-header-foreground inline-flex items-center gap-1.5 min-h-[44px] px-1"
                >
                  <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
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
        <nav className="hidden md:block bg-tab border-t border-header-foreground/10">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button variant="ghost"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-auto rounded-none font-body text-sm md:text-[15px] font-medium px-3 sm:px-4 py-3 transition-colors inline-flex items-center gap-2 border-b-2 -mb-px shrink-0 snap-start whitespace-nowrap ${
                    isActive
                      ? "bg-tab-active text-header-accent border-header-accent hover:bg-tab-active"
                      : "text-tab-foreground border-transparent hover:bg-tab-active/40 hover:text-tab-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {tab.label}
                </Button>
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
            onOpenCalendar={(park) => {
              setCalendarPark(park);
              setActiveTab("calendar");
            }}
          />
        )}
        {activeTab === "calendar" && <ParkCalendar initialPark={calendarPark} />}
        {activeTab === "simulator" && <DaySimulator initialPark={simulatorPark} />}

        {activeTab === "optimizer" && <DayOptimizer />}
        {activeTab === "rideopt" && <RideOptimizer />}
        {activeTab === "lanes" && <LightningLanes />}
        {activeTab === "rankings" && <Rankings />}
        {activeTab === "crowds" && <CrowdEstimator />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border text-muted-foreground text-center py-6 font-body text-sm mt-12 pb-bottom-nav md:pb-0">
        Bay Lake Insights Co. © 2026
      </footer>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Sections"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-tab border-t border-header-foreground/10 bottom-nav-safe"
      >
        <div className="grid grid-cols-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button variant="ghost"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`h-auto rounded-none flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 py-2 font-body text-[10px] font-medium transition-colors ${
                  isActive ? "bg-tab-active text-header-accent hover:bg-tab-active" : "text-tab-foreground hover:bg-tab-active/40"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                <span className="leading-none truncate max-w-full">
                  {tab.label.replace("Day ", "").replace("Lightning Lanes", "Lanes").replace("Park Calendar", "Calendar").replace("Ride Optimizer", "Rides")}
                </span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
