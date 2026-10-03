"use client";

import { ArrowCounterClockwise, Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { PageFrame } from "@/components/shell/Page";
import { Badge, Button, Field, Input, PageHeader, Panel, PanelHeader, Segmented, Select } from "@/components/ui";
import { useAgent } from "@/lib/agent/agent-store";
import { TOOLS } from "@/lib/agent/tools";
import { DEFAULT_MODEL, useKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

const MODELS = [DEFAULT_MODEL, "anthropic/claude-opus-5.5", "anthropic/claude-haiku-4.5", "openai/gpt-5.6-luna", "google/gemini-3.8-flash"];

export default function SettingsPage() {
  const settings = useKitchen((s) => s.settings);
  const update = useKitchen((s) => s.updateSettings);
  const reset = useKitchen((s) => s.reset);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const webmcp = useAgent((s) => s.webmcp);
  const clearChat = useAgent((s) => s.clear);
  const [showKey, setShowKey] = useState(false);

  const groups = [
    { kind: "read", label: "Read data", sub: "Safe lookups the agent uses to answer questions and plan." },
    { kind: "write", label: "Take actions", sub: "Each can run on screen (fills the real form and presses the real button) or in the background." },
    { kind: "nav", label: "Navigate", sub: "Opens pages so you can see what the agent is talking about." },
  ] as const;

  return (
    <PageFrame route="/settings">
      <PageHeader title="Settings" sub="Kitchen profile, the AI model and how the agent behaves." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Kitchen" />
          <div className="grid grid-cols-1 gap-4 px-5 pb-5">
            <Field label="Kitchen name" htmlFor="kname">
              <Input id="kname" value={settings.kitchenName} onChange={(e) => update({ kitchenName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" htmlFor="currency">
                <Select
                  id="currency"
                  value={settings.currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    update({ currency: c, locale: c === "INR" ? "en-IN" : c === "EUR" ? "de-DE" : c === "GBP" ? "en-GB" : c === "AED" ? "en-AE" : "en-US" });
                  }}
                >
                  {["INR", "USD", "EUR", "GBP", "AED"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax on orders %" htmlFor="tax">
                <Input id="tax" inputMode="decimal" value={settings.taxPct} onChange={(e) => update({ taxPct: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Field label="Theme" htmlFor="theme">
              <Segmented
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="AI agent" sub="Runs on OpenRouter. Without a key it falls back to a scripted demo." />
          <div className="grid grid-cols-1 gap-4 px-5 pb-5">
            <Field label="Model" htmlFor="model" hint="Any OpenRouter model id that supports tool calling.">
              <Input id="model" list="models" value={settings.model} onChange={(e) => update({ model: e.target.value })} className="font-mono text-[13px]" />
              <datalist id="models">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="OpenRouter API key" htmlFor="orkey" hint="Optional. Stored only in this browser and sent with each request. A server key in OPENROUTER_API_KEY is used when this is empty.">
              <div className="relative">
                <Input id="orkey" type={showKey ? "text" : "password"} autoComplete="off" value={settings.openrouterKey} onChange={(e) => update({ openrouterKey: e.target.value.trim() })} placeholder="sk-or-..." className="pr-10 font-mono text-[13px]" />
                <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide key" : "Show key"} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1 text-ink-3 hover:text-ink">
                  {showKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default way of acting" htmlFor="mode">
                <Segmented
                  label="Default agent mode"
                  value={settings.agentMode}
                  onChange={(v) => update({ agentMode: v })}
                  options={[
                    { value: "ui", label: "Show me" },
                    { value: "background", label: "Background" },
                  ]}
                />
              </Field>
              <Field label="On-screen speed" htmlFor="speed">
                <Segmented
                  label="Agent speed"
                  value={settings.agentSpeed}
                  onChange={(v) => update({ agentSpeed: v })}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "fast", label: "Fast" },
                  ]}
                />
              </Field>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="What the agent can do"
          sub={`${TOOLS.length} tools, passed to the model on every turn with their JSON schemas. The same tools are offered to browser agents through WebMCP.`}
          actions={<Badge tone={webmcp ? "good" : "neutral"}>{webmcp ? `WebMCP on, ${webmcp} tools registered` : "WebMCP not available here"}</Badge>}
        />
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-rule px-5 py-5 lg:grid-cols-3">
          {groups.map((g) => (
            <section key={g.kind}>
              <h3 className="text-sm font-semibold text-ink">{g.label}</h3>
              <p className="mt-0.5 mb-3 text-xs text-ink-3">{g.sub}</p>
              <ul className="space-y-2.5">
                {TOOLS.filter((t) => t.kind === g.kind).map((t) => (
                  <li key={t.name}>
                    <code className="font-mono text-[12px] text-ink">{t.name}</code>
                    {t.confirm && (
                      <Badge tone="warn" className="ml-2 h-5 text-[11px]">
                        asks first
                      </Badge>
                    )}
                    <p className="text-xs leading-relaxed text-ink-3">{t.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Demo data" sub="Everything lives in this browser. Reset to start the demo from a clean kitchen." />
        <div className="px-5 pb-5">
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm("Reset all demo data? Orders, stock, invoices and settings go back to the starting state.")) return;
              reset();
              clearChat();
              toast.success("Demo data reset");
            }}
          >
            <ArrowCounterClockwise size={16} /> Reset demo data
          </Button>
        </div>
      </Panel>
    </PageFrame>
  );
}
