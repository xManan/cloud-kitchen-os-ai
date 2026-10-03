"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { AgentButton, PageFrame, relTime } from "@/components/shell/Page";
import { Badge, Input, Metric, PageHeader, Panel, Segmented, Table, Td, Th } from "@/components/ui";
import * as A from "@/lib/analytics";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";

export default function CustomersPage() {
  const customers = useKitchen((s) => s.customers);
  const money = useMoney();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"ltv" | "recent" | "lapsed">("ltv");

  const repeat = customers.filter((c) => c.orders > 1).length / Math.max(1, customers.length);
  const avgLtv = customers.reduce((s, c) => s + c.ltv, 0) / Math.max(1, customers.length);
  const lapsed = customers.filter((c) => c.orders >= 8 && Date.now() - new Date(c.lastOrderAt).getTime() > 21 * 86400000);
  const rows = customers
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.area.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "ltv" ? b.ltv - a.ltv : sort === "recent" ? b.lastOrderAt.localeCompare(a.lastOrderAt) : a.lastOrderAt.localeCompare(b.lastOrderAt)))
    .slice(0, 40);

  return (
    <PageFrame route="/customers">
      <PageHeader title="Customers" sub="Built from orders across all channels where the phone number matches." />

      <Panel>
        <div className="grid grid-cols-2 gap-6 px-5 py-5 md:grid-cols-4">
          <Metric label="Customers" value={A.fmtNum(customers.length)} />
          <Metric label="Repeat rate" value={A.fmtPct(repeat, 0)} />
          <Metric label="Avg. lifetime value" value={money(avgLtv)} />
          <div>
            <Metric label="Lapsed regulars" value={lapsed.length} hint="8+ orders, none in 3 weeks" />
            {lapsed.length > 0 && (
              <AgentButton className="mt-2" prompt="Find regulars who have ordered 8 or more times but not in the last 3 weeks, tag them 'Win-back', and draft a win-back coupon for them.">
                Win them back
              </AgentButton>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="relative w-full max-w-[280px]">
            <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <label htmlFor="cust-search" className="sr-only">
              Search customers
            </label>
            <Input id="cust-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or area" className="pl-9" />
          </div>
          <Segmented
            size="sm"
            label="Sort customers"
            value={sort}
            onChange={setSort}
            options={[
              { value: "ltv", label: "Top spenders" },
              { value: "recent", label: "Recent" },
              { value: "lapsed", label: "Least recent" },
            ]}
          />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Area</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Lifetime value</Th>
              <Th>Last order</Th>
              <Th>Tags</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} data-row-id={c.id}>
                <Td>
                  <div className="font-medium">{c.name}</div>
                  {c.notes[0] && <div className="max-w-[260px] truncate text-xs text-ink-3">{c.notes[0]}</div>}
                </Td>
                <Td className="text-ink-2">{c.area}</Td>
                <Td className="num text-right">{c.orders}</Td>
                <Td className="num text-right">{money(c.ltv)}</Td>
                <Td className="text-ink-2">{relTime(c.lastOrderAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Badge key={t} tone={t === "Regular" ? "good" : t === "Win-back" ? "heat" : "neutral"}>
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </PageFrame>
  );
}
