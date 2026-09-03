// Live standby wait times from themeparks.wiki, used to calibrate the
// simulator's modelled wait ranges against what the parks are actually posting.

import { cachedFetch, TTL_30_MIN } from "@/lib/liveCache";

const PARK_IDS: Record<string, string> = {
  "Magic Kingdom": "75ea578a-adc8-4116-a54d-dccb60765ef9",
  EPCOT: "47f90d2c-e191-4239-a466-5892ef59a88b",
  "Hollywood Studios": "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
  "Animal Kingdom": "1c84a229-8862-4648-9c71-378ddd2c7693",
};

/** Strip punctuation/articles so "TRON Lightcycle / Run" matches "TRON Lightcycle Run". */
function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|a|an|of|and|with|starring)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type LiveWaitMap = Record<string, number>;

/** Live standby waits for one park, keyed by normalized attraction name. */
export async function fetchLiveWaits(parkName: string): Promise<LiveWaitMap> {
  const id = PARK_IDS[parkName];
  if (!id) return {};
  return cachedFetch(`waits:${parkName}`, TTL_30_MIN, async () => {
    const res = await fetch(`https://api.themeparks.wiki/v1/entity/${id}/live`);
    const json = await res.json();
    const map: LiveWaitMap = {};
    for (const entity of json.liveData ?? []) {
      if (entity.entityType !== "ATTRACTION") continue;
      const wait = entity.queue?.STANDBY?.waitTime;
      if (typeof wait === "number" && wait > 0) map[normalize(entity.name)] = wait;
    }
    return map;
  });
}

/** Best-effort lookup: exact normalized match, then substring match either way. */
export function findLiveWait(waits: LiveWaitMap, rideName: string): number | null {
  const key = normalize(rideName);
  if (waits[key] != null) return waits[key];
  for (const [liveKey, value] of Object.entries(waits)) {
    if (liveKey.includes(key) || key.includes(liveKey)) return value;
  }
  return null;
}
