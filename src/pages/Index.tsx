import { useState } from "react";
import DaySimulator from "@/pages/DaySimulator";
import DayOptimizer from "@/pages/DayOptimizer";
import Rankings from "@/pages/Rankings";
import Blog from "@/pages/Blog";

type Tab = "simulator" | "optimizer" | "rankings" | "blog";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "simulator", label: "Day Simulator", icon: "🎡" },
  { id: "optimizer", label: "Day Optimizer", icon: "⚡" },
  { id: "rankings", label: "Rankings", icon: "🏆" },
  { id: "blog", label: "Blog", icon: "📝" },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("simulator");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header sticky top-0 z-50 shadow-lg">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-3xl md:text-4xl text-header-foreground tracking-wide">
            <span className="text-header-accent">Main Street</span> Insights
          </h1>
        </div>
        {/* Tab Navigation */}
        <nav className="border-t border-header-foreground/10">
          <div className="max-w-7xl mx-auto px-4 flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-display text-lg md:text-xl px-5 py-3 transition-all border-b-3 ${
                  activeTab === tab.id
                    ? "text-header-accent border-b-2 border-header-accent"
                    : "text-header-foreground/70 border-b-2 border-transparent hover:text-header-foreground hover:border-header-foreground/30"
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === "simulator" && <DaySimulator />}
        {activeTab === "rankings" && <Rankings />}
        {activeTab === "blog" && <Blog />}
      </main>

      {/* Footer */}
      <footer className="bg-header text-header-foreground/50 text-center py-4 font-body text-sm mt-8">
        Main Street Insights © 2026
      </footer>
    </div>
  );
}
