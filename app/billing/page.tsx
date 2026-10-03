"use client";

import { Plus, WarningCircle } from "@phosphor-icons/react";
import { InvoiceForm } from "@/components/forms";
import { AgentButton, PageFrame, shortDate } from "@/components/shell/Page";
import { Badge, Button, Metric, PageHeader, Panel, PanelHeader, Table, Td, Th, cn, type Tone } from "@/components/ui";
import * as A from "@/lib/analytics";
import { CHANNELS } from "@/lib/data/seed";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import type { InvoiceStatus, PayoutStatus } from "@/lib/types";
import { useUI } from "@/lib/ui-store";

const INV_TONE: Record<InvoiceStatus, Tone> = { draft: "neutral", sent: "heat", paid: "good", overdue: "bad" };
const PAY_TONE: Record<PayoutStatus, Tone> = { pending: "warn", reconciled: "good", disputed: "bad" };

export default function BillingPage() {
  const d = useKitchen();
  const money = useMoney();
  const openForm = useUI((s) => s.openForm);

  const invTotal = (i: (typeof d.invoices)[number]) => i.lines.reduce((s, l) => s + l.qty * l.rate, 0) * (1 + i.taxPct / 100);
  const receivable = d.invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + invTotal(i), 0);
  const pending = d.payouts.filter((p) => p.status === "pending");
  const month = new Date().toISOString().slice(0, 7);
  const commissionMonth = d.payouts.filter((p) => p.periodEnd.startsWith(month)).reduce((s, p) => s + p.commission, 0);

  return (
    <PageFrame route="/billing">
      <PageHeader
        title="Billing"
        sub="Catering invoices you send, and the payouts aggregators send you."
        actions={
          <Button variant="primary" data-agent-open="invoice" onClick={() => openForm("invoice")}>
            <Plus size={16} weight="bold" /> New invoice
          </Button>
        }
      />

      <Panel>
        <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:grid-cols-3">
          <Metric label="Owed to you" value={money(receivable)} hint={`${d.invoices.filter((i) => i.status === "overdue").length} overdue`} />
          <Metric label="Payouts awaiting check" value={pending.length} hint={money(pending.reduce((s, p) => s + p.net, 0)) + " net"} />
          <Metric label="Commission this month" value={money(commissionMonth)} hint="DashBite 24%, FoodRun 21%" />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Aggregator payouts"
          sub="Weekly settlements. Check that commission and adjustments match the contract before reconciling."
          actions={<AgentButton prompt="Reconcile the pending aggregator payouts. Check each effective commission rate against the contract (DashBite 24%, FoodRun 21%) and look for unexplained adjustments. Reconcile the clean ones and dispute anything that's off, with a clear note.">Reconcile with the agent</AgentButton>}
        />
        <Table>
          <thead>
            <tr>
              <Th>Channel</Th>
              <Th>Week</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Gross</Th>
              <Th className="text-right">Commission</Th>
              <Th className="text-right">Adjustments</Th>
              <Th className="text-right">Net</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {[...d.payouts].reverse().map((p) => {
              const rate = p.commission / p.gross;
              const contract = CHANNELS.find((c) => c.id === p.channel)?.commission ?? 0;
              const suspicious = p.adjustments < -1000;
              return (
                <tr key={p.id} data-row-id={p.id}>
                  <Td className="font-medium">{A.channelName(p.channel)}</Td>
                  <Td className="whitespace-nowrap text-ink-2">
                    {shortDate(p.periodStart)} to {shortDate(p.periodEnd)}
                  </Td>
                  <Td className="num text-right text-ink-2">{p.orders}</Td>
                  <Td className="num text-right">{money(p.gross)}</Td>
                  <Td className="num text-right">
                    {money(p.commission)} <span className={cn("text-xs", Math.abs(rate - contract) > 0.005 ? "text-bad" : "text-ink-3")}>{(rate * 100).toFixed(1)}%</span>
                  </Td>
                  <Td className={cn("num text-right", suspicious ? "font-medium text-bad" : "text-ink-2")}>
                    <span className="inline-flex items-center gap-1" title={p.note}>
                      {suspicious && <WarningCircle size={14} weight="fill" />}
                      {p.adjustments ? money(p.adjustments) : "None"}
                    </span>
                  </Td>
                  <Td className="num text-right font-medium">{money(p.net)}</Td>
                  <Td>
                    <Badge tone={PAY_TONE[p.status]}>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {p.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => d.setPayoutStatus(p.id, "disputed", "Disputed from billing")}>
                          Dispute
                        </Button>
                        <Button size="sm" onClick={() => d.setPayoutStatus(p.id, "reconciled")}>
                          Reconcile
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>

      <Panel>
        <PanelHeader title="Invoices" sub="Corporate catering and bulk orders" />
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Client</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th className="text-right">Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {d.invoices.map((i) => (
              <tr key={i.id} data-row-id={i.id}>
                <Td className="font-mono text-[13px]">{i.number}</Td>
                <Td>
                  <div className="font-medium">{i.client}</div>
                  <div className="text-xs text-ink-3">{i.email}</div>
                </Td>
                <Td className="text-ink-2">{shortDate(i.issuedAt)}</Td>
                <Td className={cn(i.status === "overdue" ? "font-medium text-bad" : "text-ink-2")}>{shortDate(i.dueAt)}</Td>
                <Td className="num text-right">{money(invTotal(i))}</Td>
                <Td>
                  <Badge tone={INV_TONE[i.status]}>{i.status[0].toUpperCase() + i.status.slice(1)}</Badge>
                </Td>
                <Td className="text-right">
                  {(i.status === "sent" || i.status === "overdue") && (
                    <Button size="sm" data-agent-target={`paid:${i.id}`} onClick={() => d.markInvoicePaid(i.id)}>
                      Mark paid
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <InvoiceForm />
    </PageFrame>
  );
}
