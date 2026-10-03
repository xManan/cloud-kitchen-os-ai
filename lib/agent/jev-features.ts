"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpenseCategory, ReviewTopic } from "@/lib/types";
import { getKitchen, useKitchen } from "@/lib/store";
import { askJev } from "./jev";

/** Small, always-on uses of Jev inside the app itself, outside the chat. */

const TOPICS: Record<ReviewTopic, string> = {
  late: "late delivery, long wait, delayed order",
  cold: "food arrived cold, lukewarm, warm, chilled",
  missing_item: "missing item, wrong order, not delivered what was paid for",
  portion: "portion size, small quantity, not enough food",
  taste: "taste, salty, bland, spicy, quality of the food",
  packaging: "packaging, crushed box, spilled, leaking, soggy",
  praise: "positive, compliment, loved it, great, best, perfect, perfectly, lovely, delicious, amazing, rich, smoky, charred, favourite, go-to",
  other: "anything else",
};

export const TOPIC_LABEL: Record<ReviewTopic, string> = {
  late: "Late",
  cold: "Arrived cold",
  missing_item: "Missing item",
  portion: "Portion",
  taste: "Taste",
  packaging: "Packaging",
  praise: "Praise",
  other: "Other",
};

const inflight = new Set<string>();
/** Reviews Jev failed on this session; not retried until reload, so errors cannot loop. */
const failed = new Set<string>();

/** Tag every untagged review with a topic and urgency. One parallel Jev call per review. */
export function useReviewTagging() {
  const enabled = useKitchen((s) => s.settings.jevEnabled);
  const reviews = useKitchen((s) => s.reviews);
  const [status, setStatus] = useState<{ ms: number; mock: boolean } | null>(null);
  const untagged = reviews.filter((r) => !r.topic && !inflight.has(r.id) && !failed.has(r.id));
  const key = untagged.map((r) => r.id).join(",");

  useEffect(() => {
    if (!enabled || !key) return;
    const todo = getKitchen().reviews.filter((r) => key.split(",").includes(r.id));
    todo.forEach((r) => inflight.add(r.id));
    const t0 = performance.now();
    let mock = false;
    Promise.all(
      todo.map((r) =>
        askJev(`${r.rating} out of 5 stars. "${r.text}"`, {
          topic: { type: "choice", instructions: "What is this restaurant review mainly about?", criteria: TOPICS },
          urgent: { type: "noul", instructions: "Does this review need a reply today: angry, refund risk, missing or wrong food, food safety?" },
        })
          .then((res) => {
            mock ||= res.mock;
            const topic = res.answers.topic?.type === "choice" ? (res.answers.topic.pick as ReviewTopic) : "other";
            const urgency = res.answers.urgent?.type === "noul" ? res.answers.urgent.p : 0;
            // Low star ratings are urgent no matter what; keeps the demo heuristic honest.
            getKitchen().tagReview(r.id, TOPICS[topic] ? topic : "other", r.rating <= 2 ? Math.max(urgency, 0.75) : urgency);
          })
          .catch((e) => {
            failed.add(r.id);
            console.warn("[jev] review tagging failed", e);
          })
          .finally(() => inflight.delete(r.id)),
      ),
    ).then(() => setStatus({ ms: Math.round(performance.now() - t0), mock }));
  }, [enabled, key]);

  return status;
}

const CATEGORIES: Record<ExpenseCategory, string> = {
  Rent: "rent, lease, landlord, property",
  Utilities: "electricity, power, gas, water, internet, BESCOM",
  Salaries: "payroll, wages, salary, staff pay",
  Marketing: "ads, advertising, instagram, promotion, flyers, campaign",
  Packaging: "boxes, containers, bags, packaging supplies",
  Maintenance: "repair, service, HVAC, chiller, plumber, electrician, equipment fix",
  Software: "software, POS, subscription, app, tools",
  Other: "anything else",
};

/** Debounced category suggestion for the expense form, from vendor and note text. */
export function useExpenseCategorySuggestion(vendor: string, note: string) {
  const enabled = useKitchen((s) => s.settings.jevEnabled);
  const [suggestion, setSuggestion] = useState<{ category: ExpenseCategory; p: number; ms: number } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const text = `${vendor ?? ""} ${note ?? ""}`.trim();
    if (!enabled || text.length < 3) {
      setSuggestion(null);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      askJev(`Expense paid to: ${vendor}. Note: ${note || "none"}`, {
        category: { type: "choice", instructions: "Which expense category does this belong to?", criteria: CATEGORIES },
      })
        .then((res) => {
          if (mine !== seq.current) return;
          const a = res.answers.category;
          if (a?.type === "choice" && a.pick !== "Other" && a.p >= 0.6 && a.pick in CATEGORIES) setSuggestion({ category: a.pick as ExpenseCategory, p: a.p, ms: res.ms });
          else setSuggestion(null);
        })
        .catch(() => mine === seq.current && setSuggestion(null));
    }, 350);
    return () => clearTimeout(t);
  }, [vendor, note, enabled]);

  return suggestion;
}
