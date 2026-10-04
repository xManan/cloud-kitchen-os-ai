import { NextResponse } from "next/server";
import { mockJev } from "@/lib/agent/jev-mock";
import { normalise, type JevAnswer, type JevQuestions } from "@/lib/agent/jev-types";

export const runtime = "nodejs";

const SYSTEM_ONE_URL = "https://openrouter.ai/api/v1/systemone";
/** "jev" alone is not a model on OpenRouter, so treat it (and empty) as the latest release. */
const jevModel = (id?: string) => {
  const m = id?.trim();
  return !m || m === "jev" || m === "typesafe/jev" ? "jev-latest" : m;
};
const DEFAULT_JEV = jevModel(process.env.JEV_MODEL);

/**
 * Proxy to OpenRouter's System One API for Jev. Same key handling as /api/chat:
 * a key pasted in Settings (header) wins, otherwise OPENROUTER_API_KEY, otherwise the
 * keyword mock so the demo still works offline.
 */
export async function POST(req: Request) {
  let body: { state?: string; questions?: JevQuestions; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.state || !body.questions || !Object.keys(body.questions).length) {
    return NextResponse.json({ error: "state and questions are required" }, { status: 400 });
  }

  const started = Date.now();
  const key = req.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
  if (!key || process.env.MOCK_LLM === "1") {
    return NextResponse.json({ answers: mockJev(body.state, body.questions), model: "jev (demo heuristic)", mock: true, ms: Date.now() - started });
  }

  const res = await fetch(SYSTEM_ONE_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": req.headers.get("origin") ?? "http://localhost:3000",
      "X-Title": "Kitchen OS demo",
    },
    body: JSON.stringify({ model: body.model ? jevModel(body.model) : DEFAULT_JEV, state: body.state, questions: body.questions }),
  }).catch((e: unknown) => e as Error);

  if (res instanceof Error) return NextResponse.json({ error: `Could not reach Jev: ${res.message}` }, { status: 502 });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.answers) {
    return NextResponse.json({ error: data?.error?.message ?? `Jev returned ${res.status}` }, { status: res.status === 401 ? 401 : 502 });
  }
  const answers: Record<string, JevAnswer> = {};
  for (const [k, raw] of Object.entries(data.answers as Record<string, unknown>)) {
    const a = normalise(raw);
    if (a) answers[k] = a;
  }
  return NextResponse.json({ answers, model: data.model ?? body.model ?? DEFAULT_JEV, mock: false, ms: Date.now() - started });
}
