"use client";

import { Plus, X } from "@phosphor-icons/react";
import { ShiftForm } from "@/components/forms";
import { PageFrame } from "@/components/shell/Page";
import { Button, Metric, PageHeader, Panel, cn } from "@/components/ui";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

const hours = (s: string, e: string) => {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
};

export default function StaffPage() {
  const staff = useKitchen((s) => s.staff);
  const shifts = useKitchen((s) => s.shifts);
  const removeShift = useKitchen((s) => s.removeShift);
  const openForm = useUI((s) => s.openForm);
  const money = useMoney();

  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
  const inWeek = shifts.filter((s) => days.includes(s.date));
  const totalHours = inWeek.reduce((s, x) => s + hours(x.start, x.end), 0);
  const cost = inWeek.reduce((s, x) => s + hours(x.start, x.end) * (staff.find((p) => p.id === x.staffId)?.hourlyRate ?? 0), 0);

  return (
    <PageFrame route="/staff">
      <PageHeader
        title="Staff"
        sub="The next seven days. Morning shifts cover lunch prep; evening shifts cover the dinner rush."
        actions={
          <Button variant="primary" data-agent-open="shift" onClick={() => openForm("shift")}>
            <Plus size={16} weight="bold" /> Add shift
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Metric label="Team" value={staff.length} />
        <Metric label="Scheduled hours" value={Math.round(totalHours)} hint="next 7 days" />
        <Metric label="Labour cost" value={money(cost)} hint="next 7 days" />
      </div>

      <Panel className="overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th className="h-11 w-[200px] pl-5 text-left text-xs font-medium text-ink-3">Team member</th>
                {days.map((d, i) => (
                  <th key={d} className="h-11 px-1.5 text-left text-xs font-medium text-ink-3">
                    <span className={cn(i === 0 && "text-heat")}>{i === 0 ? "Today" : new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id} className="border-b border-rule last:border-0">
                  <td className="py-2.5 pl-5">
                    <div className="text-sm font-medium text-ink">{p.name}</div>
                    <div className="text-xs text-ink-3">{p.role}</div>
                  </td>
                  {days.map((d) => {
                    const s = shifts.filter((x) => x.staffId === p.id && x.date === d);
                    return (
                      <td key={d} className="px-1.5 py-2 align-top">
                        {s.length === 0 ? (
                          <span className="block px-2 py-1.5 text-xs text-ink-3">Off</span>
                        ) : (
                          s.map((x) => (
                            <div
                              key={x.id}
                              data-row-id={x.id}
                              className={cn("group mb-1 flex items-center justify-between rounded-[6px] px-2 py-1.5 text-xs ring-1 ring-inset", x.start < "12:00" ? "bg-paper-2 text-ink ring-rule" : "bg-heat-wash text-ink ring-heat/20")}
                            >
                              <span className="num">
                                {x.start} to {x.end}
                              </span>
                              <button
                                type="button"
                                aria-label={`Remove ${p.name}'s shift on ${d}`}
                                className="cursor-pointer text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-bad focus:opacity-100"
                                onClick={() => {
                                  if (window.confirm(`Remove ${p.name}'s shift on ${d}?`)) removeShift(x.id);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ShiftForm />
    </PageFrame>
  );
}
