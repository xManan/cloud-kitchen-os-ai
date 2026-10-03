import { NextResponse } from "next/server";
import { mockPlanner } from "@/lib/agent/mock";

export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";

/**
 * Thin proxy to OpenRouter. Tools run in the browser (where the app state and router live);
 * this route only forwards the conversation so the API key never ships to the client
 * unless the viewer pasted their own key in Settings.
 */
export async function POST(req: Request) {
  let body: { model?: string; messages?: unknown[]; tools?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) return NextResponse.json({ error: "messages is required" }, { status: 400 });

  const key = req.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
  if (!key || process.env.MOCK_LLM === "1") {
    return NextResponse.json({ message: mockPlanner(body.messages as never), mock: true });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": req.headers.get("origin") ?? "http://localhost:3000",
      "X-Title": "Kitchen OS demo",
    },
    body: JSON.stringify({
      model: body.model || DEFAULT_MODEL,
      messages: body.messages,
      tools: body.tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      temperature: 0.2,
      max_tokens: 2000,
    }),
  }).catch((e: unknown) => e as Error);

  if (res instanceof Error) return NextResponse.json({ error: `Could not reach OpenRouter: ${res.message}` }, { status: 502 });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const msg = data?.error?.message ?? `OpenRouter returned ${res.status}`;
    return NextResponse.json({ error: msg }, { status: res.status === 401 ? 401 : 502 });
  }
  const message = data.choices?.[0]?.message;
  if (!message) return NextResponse.json({ error: data.error?.message ?? "Empty response from model" }, { status: 502 });
  return NextResponse.json({ message: { content: message.content ?? null, tool_calls: message.tool_calls }, model: data.model });
}
