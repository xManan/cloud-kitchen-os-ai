import type { JevAnswer, JevQuestions } from "./jev-types";

/**
 * Keyword stand-in for Jev, used when no OpenRouter key is configured (and in e2e tests).
 * It scores each choice criterion by word overlap with the state, so it only works because
 * our criteria descriptions are written to be keyword-rich. Real Jev does far better.
 */

const STOP = new Set(["the", "a", "an", "to", "of", "and", "or", "for", "is", "it", "on", "in", "my", "me", "this", "that", "please", "can", "you", "with", "be", "as", "at", "all", "any", "how", "are", "we", "what", "do", "does", "our", "want", "should", "would", "us", "was", "were", "not", "no", "but", "than", "out", "star", "stars", "bit", "very", "so", "too", "just", "really", "felt", "time", "last", "by", "from", "get", "got"]);

function words(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""));
}

function overlap(state: string[], text: string) {
  const t = new Set(words(text));
  if (!t.size) return 0;
  let hit = 0;
  for (const w of state) if (t.has(w)) hit++;
  return hit;
}

export function mockJev(state: string, questions: JevQuestions): Record<string, JevAnswer> {
  // Only the user's words matter for keyword matching; context lines would bias every pick.
  const request = state.includes("User request:") ? state.split("User request:").pop()! : state;
  state = request;
  const sw = words(state);
  const out: Record<string, JevAnswer> = {};
  for (const [key, q] of Object.entries(questions)) {
    if (q.type === "choice") {
      const scored = Object.entries(q.criteria).map(([k, desc]) => [k, overlap(sw, `${k.replace(/[-_]/g, " ")} ${desc}`)] as const);
      scored.sort((a, b) => b[1] - a[1]);
      // Nothing matched: prefer an explicit catch-all option over whichever came first.
      if (scored[0][1] === 0) {
        const fallback = scored.find(([k]) => k === "other" || k === "complex");
        if (fallback) {
          out[key] = { type: "choice", pick: fallback[0], p: 0.5 };
          continue;
        }
      }
      const [best, second] = scored;
      const margin = best[1] - (second?.[1] ?? 0);
      // Confident only when one option clearly wins.
      const p = best[1] === 0 ? 0.2 : Math.min(0.97, 0.55 + 0.2 * margin + 0.05 * best[1]);
      out[key] = { type: "choice", pick: best[0], p };
    } else {
      const hits = overlap(sw, q.instructions);
      const negated = /\b(not|no|don't|isn't|un|restore|back)\b/i.test(state);
      let p = Math.min(0.95, 0.15 + 0.25 * hits);
      // The availability question is phrased positively ("should the item be available?").
      if (/available/i.test(q.instructions)) p = /sold out|86|out of stock|unavailable|disable/i.test(state) ? 0.05 : negated ? 0.9 : 0.5;
      out[key] = { type: "noul", p };
    }
  }
  return out;
}
