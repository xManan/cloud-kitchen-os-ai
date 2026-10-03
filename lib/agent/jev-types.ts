/**
 * Types for TypeSafe's Jev "System One" model, called through OpenRouter's System One API
 * (POST https://openrouter.ai/api/v1/systemone). Jev doesn't generate text: it answers typed
 * questions about a piece of state in one pass, each with a calibrated score.
 */

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevQuestions = Record<string, JevQuestion>;

/** Normalised answer: a yes-probability for noul, the picked key plus its score for choice. */
export type JevAnswer = { type: "noul"; p: number } | { type: "choice"; pick: string; p: number };

export interface JevResult {
  answers: Record<string, JevAnswer>;
  ms: number;
  model: string;
  mock: boolean;
}

/**
 * Noul answers are documented as { type: "noul", noul: 0.98 }. The choice shape is only
 * described as "selected criterion with confidence", so accept the plausible encodings.
 */
export function normalise(raw: unknown): JevAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  if (r.type === "noul" || typeof r.noul === "number") {
    const p = num(r.noul) ?? num(r.probability) ?? num(r.confidence) ?? num(r.p);
    return p === undefined ? null : { type: "noul", p };
  }
  const conf = num(r.confidence) ?? num(r.probability) ?? num(r.score) ?? num(r.p);
  for (const field of ["choice", "selected", "pick", "label", "answer", "value"]) {
    const v = r[field];
    if (typeof v === "string") return { type: "choice", pick: v, p: conf ?? 1 };
    if (v && typeof v === "object") {
      // A distribution over criteria, e.g. { billing: 0.91, technical: 0.09 }.
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "number") as [string, number][];
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        return { type: "choice", pick: entries[0][0], p: entries[0][1] };
      }
    }
  }
  return null;
}
