"use client";

import { useCallback } from "react";
import { fmtMoney } from "@/lib/analytics";
import { useKitchen } from "@/lib/store";

/** Money formatter bound to the kitchen's currency and locale. */
export function useMoney() {
  const currency = useKitchen((s) => s.settings.currency);
  const locale = useKitchen((s) => s.settings.locale);
  return useCallback((n: number, compact = false) => fmtMoney(n, currency, locale, compact), [currency, locale]);
}
