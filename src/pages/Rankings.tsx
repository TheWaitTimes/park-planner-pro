import { useState, useMemo, useCallback } from "react";
import { RIDES, RESORTS, SNACKS, type RankingItem } from "@/data/rankings";

type RankingCategory = "rides" | "resorts" | "snacks";

function eloCalc(ratingA: number, ratingB: number, winsA: number, k: number) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  return {
    newA: ratingA + k * (winsA - expectedA),
    newB: ratingB + k * ((1 - winsA) - expectedB),
  };
}

function getDynamicK(numComparisons: number): number {
  if (numComparisons < 10) return 32;
  if (numComparisons < 30) return 16;
  return 8;
}

function norm(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function generatePairs(n: number, maxPairs: number): [number, number][] {
  const all: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      all.push([i, j]);
    }
  }
  // Shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.min(maxPairs, all.length));
}

const CATEGORY_DATA: Record<RankingCategory, { items: RankingItem[]; nameKey: string; label: string; icon: string }> = {
  rides: { items: RIDES, nameKey: "name", label: "Ride Rankings", icon: "🎢" },
  resorts: { items: RESORTS, nameKey: "name", label: "Resort Rankings", icon: "🏨" },
  snacks: { items: SNACKS, nameKey: "name", label: "Snack Rankings", icon: "🍦" },
};

const PARK_LOCATIONS = ["All Parks", ...new Set([...RIDES, ...RESORTS, ...SNACKS].map((i) => i.parkLocation))];

export default function Rankings() {
  const [category, setCategory] = useState<RankingCategory>("rides");
  const [parkFilter, setParkFilter] = useState("All Parks");
  const [ratings, setRatings] = useState<number[]>([]);
  const [numComparisons, setNumComparisons] = useState<number[]>([]);
  const [pairs, setPairs] = useState<[number, number][]>([]);
  const [comparedPairs, setComparedPairs] = useState<Set<string>>(new Set());
  const [pairIdx, setPairIdx] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);

  const { items, label, icon } = CATEGORY_DATA[category];

  const filteredItems = useMemo(() => {
    if (parkFilter === "All Parks") return items;
    return items.filter((i) => i.parkLocation === parkFilter);
  }, [items, parkFilter]);

  const startQuiz = useCallback(() => {
    const n = filteredItems.length;
    if (n < 2) return;
    const newPairs = generatePairs(n, 80);
    setRatings(Array(n).fill(1500));
    setNumComparisons(Array(n).fill(0));
    setPairs(newPairs);
    setComparedPairs(new Set());
    setPairIdx(0);
    setQuizStarted(true);
  }, [filteredItems]);

  const isFinished = quizStarted && pairIdx >= pairs.length;

  const handleChoice = useCallback(
    (side: "left" | "right") => {
      if (pairIdx >= pairs.length) return;
      const [i, j] = pairs[pairIdx];
      const winsA = side === "left" ? 1 : 0;
      const kI = getDynamicK(numComparisons[i]);
      const kJ = getDynamicK(numComparisons[j]);
      const k = (kI + kJ) / 2;
      const { newA, newB } = eloCalc(ratings[i], ratings[j], winsA, k);

      const newRatings = [...ratings];
      newRatings[i] = newA;
      newRatings[j] = newB;

      const newNC = [...numComparisons];
      newNC[i]++;
      newNC[j]++;

      const newCompared = new Set(comparedPairs);
      newCompared.add(`${i}-${j}`);

      // Find next best pair (closest Elo among remaining)
      const remaining = pairs.filter(
        (_, idx) => idx > pairIdx && !newCompared.has(`${pairs[idx]?.[0]}-${pairs[idx]?.[1]}`)
      );

      if (remaining.length > 0) {
        // Sort by Elo difference to prioritize close matchups
        remaining.sort((a, b) => {
          const diffA = Math.abs(newRatings[a[0]] - newRatings[a[1]]);
          const diffB = Math.abs(newRatings[b[0]] - newRatings[b[1]]);
          return diffA - diffB;
        });
      }

      setRatings(newRatings);
      setNumComparisons(newNC);
      setComparedPairs(newCompared);
      setPairIdx(pairIdx + 1);
    },
    [pairIdx, pairs, ratings, numComparisons, comparedPairs]
  );

  const rankingTable = useMemo(() => {
    if (!isFinished) return [];
    const normalized = norm(ratings);
    return filteredItems
      .map((item, i) => ({
        name: item.name,
        parkLocation: item.parkLocation,
        parkArea: item.parkArea,
        rating: Math.round(normalized[i] * 10) / 10,
      }))
      .sort((a, b) => b.rating - a.rating)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }, [isFinished, ratings, filteredItems]);

  const currentPair = !isFinished && quizStarted && pairIdx < pairs.length ? pairs[pairIdx] : null;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-5xl text-foreground mb-6">{icon} {label}</h1>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(CATEGORY_DATA) as RankingCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setQuizStarted(false); }}
            className={`font-display text-xl px-5 py-2 rounded-lg transition ${
              category === cat
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {CATEGORY_DATA[cat].icon} {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Park Filter (rides only) */}
      {category === "rides" && (
        <div className="mb-6">
          <label className="text-sm font-body font-semibold text-foreground block mb-2">Filter by Park</label>
          <div className="flex flex-wrap gap-2">
            {PARK_LOCATIONS.filter((p) => items.some((i) => i.parkLocation === p) || p === "All Parks").map((park) => (
              <button
                key={park}
                onClick={() => { setParkFilter(park); setQuizStarted(false); }}
                className={`text-sm font-body px-3 py-1 rounded-full transition ${
                  parkFilter === park
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {park}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start Button */}
      {!quizStarted && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-body mb-6 text-lg">
            Choose your favorite in each matchup. We'll use an Elo ranking system to build your personalized list!
          </p>
          <button
            onClick={startQuiz}
            disabled={filteredItems.length < 2}
            className="bg-secondary text-secondary-foreground font-display text-2xl px-10 py-4 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            Start Rankings ({filteredItems.length} items)
          </button>
        </div>
      )}

      {/* Quiz UI */}
      {quizStarted && currentPair && (
        <div className="mb-8">
          <div className="text-center text-muted-foreground font-body mb-4">
            Matchup {pairIdx + 1} of {pairs.length}
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-6">
            <div
              className="bg-secondary h-2 rounded-full transition-all"
              style={{ width: `${((pairIdx + 1) / pairs.length) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
            <button
              onClick={() => handleChoice("left")}
              className="bg-card border-2 border-border hover:border-secondary rounded-xl p-6 text-center transition-all hover:shadow-lg cursor-pointer"
            >
              <h3 className="font-display text-2xl text-foreground mb-2">{filteredItems[currentPair[0]].name}</h3>
              <p className="text-sm text-muted-foreground font-body">{filteredItems[currentPair[0]].parkLocation}</p>
              <p className="text-sm text-muted-foreground font-body">{filteredItems[currentPair[0]].parkArea}</p>
            </button>
            <div className="flex items-center justify-center">
              <span className="font-display text-3xl text-muted-foreground">VS</span>
            </div>
            <button
              onClick={() => handleChoice("right")}
              className="bg-card border-2 border-border hover:border-secondary rounded-xl p-6 text-center transition-all hover:shadow-lg cursor-pointer"
            >
              <h3 className="font-display text-2xl text-foreground mb-2">{filteredItems[currentPair[1]].name}</h3>
              <p className="text-sm text-muted-foreground font-body">{filteredItems[currentPair[1]].parkLocation}</p>
              <p className="text-sm text-muted-foreground font-body">{filteredItems[currentPair[1]].parkArea}</p>
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {isFinished && (
        <div>
          <h2 className="text-3xl text-foreground mb-4">Your Rankings</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-display text-lg text-foreground">#</th>
                  <th className="text-left px-4 py-3 font-display text-lg text-foreground">Name</th>
                  <th className="text-right px-4 py-3 font-display text-lg text-foreground">Rating</th>
                </tr>
              </thead>
              <tbody>
                {rankingTable.map((item) => (
                  <tr key={item.name} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-display text-xl text-secondary">{item.rank}</td>
                    <td className="px-4 py-3">
                      <div className="font-body font-semibold text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.parkLocation} · {item.parkArea}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div className="bg-secondary h-2 rounded-full" style={{ width: `${item.rating}%` }} />
                        </div>
                        <span className="text-sm font-body text-muted-foreground w-12 text-right">{item.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={startQuiz}
            className="mt-6 bg-secondary text-secondary-foreground font-display text-xl px-8 py-3 rounded-lg hover:opacity-90 transition"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
