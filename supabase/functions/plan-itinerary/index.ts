import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const MODEL = "openai/gpt-6-astra";

type RideInput = {
  name: string;
  area: string;
  rideMinutes: number;
  waits: { morning: [number, number]; afternoon: [number, number]; evening: [number, number] };
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json(500, { error: "AI is not configured for this app." });

  let body: {
    park?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    pace?: string;
    breaks?: string;
    priorities?: string[];
    notes?: string;
    rides?: RideInput[];
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const { park, date, startTime, endTime, pace, breaks, priorities = [], notes = "", rides = [] } = body;
  if (!park || !date || !startTime || !endTime || !Array.isArray(rides) || rides.length === 0) {
    return json(400, { error: "Please choose a park, date and time window." });
  }

  const rideTable = rides
    .slice(0, 80)
    .map(
      (r) =>
        `- ${String(r.name).slice(0, 80)} | ${String(r.area).slice(0, 40)} | ride ${Number(r.rideMinutes)} min | typical wait morning ${r.waits.morning[0]}-${r.waits.morning[1]}, afternoon ${r.waits.afternoon[0]}-${r.waits.afternoon[1]}, evening ${r.waits.evening[0]}-${r.waits.evening[1]} min`,
    )
    .join("\n");

  const system = `You are an expert Walt Disney World touring planner for "The Wait Times".
Build a realistic, time-stamped single-day itinerary for one park using ONLY the attractions listed.
Rules:
- Stay within the guest's arrival and departure times. Account for wait + ride time + 3-7 min walking between areas.
- Schedule must-do priorities first and at their lowest-wait times (rope drop or evening when waits drop).
- Group attractions by land to minimize walking.
- Respect the pacing preference: relaxed = fewer rides, longer breaks; balanced = moderate; intense = maximize rides, short breaks.
- Include meal/rest breaks per the guest's break preference.
- Do not invent prices, Lightning Lane return times, or attractions not listed. Do not use emojis.
Output Markdown only, in this structure:
## Overview
2-3 sentences summarizing the strategy.
## Itinerary
A bulleted list, one line per stop: "**9:00 AM - 9:45 AM** Attraction name (Land) - est. wait X min. Short tip."
## Tips
3-5 bullets.
## Estimated totals
Bullets: attractions, total wait minutes, total walking minutes.
Keep the whole answer under 600 words.`;

  const user = `Park: ${park}
Visit date: ${date}
In park: ${startTime} to ${endTime}
Pacing: ${pace ?? "balanced"}
Breaks: ${breaks ?? "lunch only"}
Must-do priorities (in order): ${priorities.length ? priorities.slice(0, 10).join(", ") : "none - pick the best mix"}
Other notes: ${String(notes).slice(0, 500) || "none"}

Attractions (name | land | ride length | typical modeled waits):
${rideTable}`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let upstreamError: { status: number; message: string } | null = null;
  const result = streamText({
    model: provider.responses(MODEL),
    system,
    messages: [{ role: "user", content: user }],
    abortSignal: req.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onError: ({ error }) => {
      const e = error as { statusCode?: number; message?: string };
      upstreamError = { status: e?.statusCode ?? 500, message: e?.message ?? "AI request failed" };
      console.error("plan-itinerary error", upstreamError);
    },
  });

  // Peek the first text chunk so upstream failures (402/429/403) surface as proper statuses.
  const reader = result.textStream[Symbol.asyncIterator]();
  let first: IteratorResult<string>;
  try {
    first = await reader.next();
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    upstreamError ??= { status: err?.statusCode ?? 500, message: err?.message ?? "AI request failed" };
    first = { done: true, value: undefined };
  }
  if (first.done && upstreamError) {
    const err = upstreamError as { status: number; message: string };
    const msg =
      err.status === 402
        ? "AI credits have run out for this app. Please add credits to continue."
        : err.status === 429
          ? "Too many requests right now. Please wait a moment and try again."
          : err.message;
    return json(err.status, { error: msg });
  }
  if (first.done) return json(502, { error: "The planner returned an empty itinerary. Please try again." });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(first.value));
      try {
        while (true) {
          const next = await reader.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n_The itinerary was interrupted. Please try again._"));
      }
      controller.close();
    },
  });

  return withLovableAiGatewayRunIdHeader(
    new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    runIdFetch,
    corsHeaders,
  );
});
