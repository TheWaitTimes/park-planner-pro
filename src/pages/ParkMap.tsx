import { useMemo, useState } from "react";
import { MapPin, Footprints, Clock, Route as RouteIcon, ArrowLeftRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARK_MAPS,
  PARK_MAP_NAMES,
  findRoute,
  makeProjector,
  type MapPoi,
} from "@/lib/parkRouting";

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 640;

function poiLabel(poi: MapPoi) {
  return poi.kind === "entrance" ? `${poi.name} (entrance)` : poi.name;
}

export default function ParkMap() {
  const [park, setPark] = useState<string>(PARK_MAP_NAMES[0]);
  const data = PARK_MAPS[park];

  const entranceId = useMemo(() => {
    const entrance = data.pois.find((p) => p.kind === "entrance");
    return entrance ? entrance.name : data.pois[0]?.name;
  }, [data]);

  const [fromName, setFromName] = useState<string | undefined>(entranceId);
  const [toName, setToName] = useState<string | undefined>(undefined);

  const from = data.pois.find((p) => p.name === fromName);
  const to = data.pois.find((p) => p.name === toName);

  const route = useMemo(() => {
    if (!from || !to || from.name === to.name) return null;
    return findRoute(park, from.node, to.node);
  }, [park, from, to]);

  const project = useMemo(() => makeProjector(park, VIEW_WIDTH, VIEW_HEIGHT), [park]);

  const basePaths = useMemo(
    () =>
      data.edges.map((edge, index) => ({
        key: index,
        d: edge[3]
          .map(([lat, lon], i) => {
            const [x, y] = project(lat, lon);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" "),
      })),
    [data, project],
  );

  const routePath = useMemo(() => {
    if (!route || route.path.length < 2) return null;
    return route.path
      .map(([lat, lon], i) => {
        const [x, y] = project(lat, lon);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [route, project]);

  const handleParkChange = (next: string) => {
    setPark(next);
    const nextEntrance = PARK_MAPS[next].pois.find((p) => p.kind === "entrance");
    setFromName(nextEntrance?.name ?? PARK_MAPS[next].pois[0]?.name);
    setToName(undefined);
  };

  const swap = () => {
    setFromName(toName);
    setToName(fromName);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Park Map
        </h2>
        <p className="font-body text-muted-foreground text-sm sm:text-base max-w-2xl">
          Pick any two attractions or the park entrance and see the shortest walking path along the
          real guest walkways, with the distance and an estimated walking time.
        </p>
      </header>

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="font-body text-xs uppercase tracking-wide font-semibold text-muted-foreground">
            Park
          </label>
          <Select value={park} onValueChange={handleParkChange}>
            <SelectTrigger className="font-body min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARK_MAP_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-1.5">
            <label className="font-body text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Start
            </label>
            <Select value={fromName} onValueChange={setFromName}>
              <SelectTrigger className="font-body min-h-[44px]">
                <SelectValue placeholder="Choose a starting point" />
              </SelectTrigger>
              <SelectContent>
                {data.pois.map((poi) => (
                  <SelectItem key={poi.name} value={poi.name}>
                    {poiLabel(poi)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={swap}
            aria-label="Swap start and destination"
            className="font-body inline-flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="sm:hidden">Swap</span>
          </button>

          <div className="space-y-1.5">
            <label className="font-body text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Destination
            </label>
            <Select value={toName} onValueChange={setToName}>
              <SelectTrigger className="font-body min-h-[44px]">
                <SelectValue placeholder="Choose a destination" />
              </SelectTrigger>
              <SelectContent>
                {data.pois.map((poi) => (
                  <SelectItem key={poi.name} value={poi.name}>
                    {poiLabel(poi)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result */}
        {from && to && from.name !== to.name && (
          <div className="border-t border-border pt-4">
            {route ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-body">
                <span className="inline-flex items-center gap-2 text-foreground font-semibold">
                  <Clock className="w-4 h-4 text-primary" />
                  {route.minutes} min walk
                </span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Footprints className="w-4 h-4" />
                  {route.meters.toLocaleString()} m ({Math.round(route.meters * 3.281).toLocaleString()} ft)
                </span>
                <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                  <RouteIcon className="w-4 h-4" />
                  {from.name} → {to.name}
                </span>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">
                No connected walkway was found between those two points in the map data.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="bg-card border border-border rounded-lg p-2 sm:p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Walkway map of ${park}${route ? ` showing the route from ${from?.name} to ${to?.name}` : ""}`}
        >
          <g stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round">
            {basePaths.map((p) => (
              <path key={p.key} d={p.d} />
            ))}
          </g>
          {routePath && (
            <path
              d={routePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {[from, to].map((poi, index) => {
            if (!poi) return null;
            const [x, y] = project(poi.lat, poi.lon);
            return (
              <g key={`${poi.name}-${index}`}>
                <circle cx={x} cy={y} r={7} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2.5} />
                <text
                  x={x + 11}
                  y={y + 4}
                  className="font-body"
                  fontSize={13}
                  fontWeight={600}
                  fill="hsl(var(--foreground))"
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {poi.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="font-body text-sm text-muted-foreground space-y-2">
        <h3 className="font-display text-base font-semibold text-foreground inline-flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Data source
        </h3>
        <p>
          Walkways, attraction locations and park entrances come from{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            OpenStreetMap
          </a>{" "}
          — map data © OpenStreetMap contributors, available under the{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Open Database License
          </a>
          . Routes follow mapped guest pathways; walking times assume a steady pace of about 4 km/h
          and do not include queues, crowds or temporary path closures.
        </p>
      </div>
    </section>
  );
}
