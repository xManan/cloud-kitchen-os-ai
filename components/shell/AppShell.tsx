"use client";

import { List, Moon, Sun, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AgentDock } from "@/components/agent/AgentDock";
import { GhostCursor } from "@/components/agent/GhostCursor";
import { IconButton, cn } from "@/components/ui";
import { useAgent } from "@/lib/agent/agent-store";
import { bindRouter, setCurrentPath } from "@/lib/agent/driver";
import { registerWebMCP } from "@/lib/agent/webmcp";
import { useKitchen } from "@/lib/store";
import { resolvedTheme, useUI } from "@/lib/ui-store";
import { NAV } from "./nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Data is seeded per browser, so render data only after mount to avoid SSR mismatches.
  const storeReady = useKitchen((s) => s.hydrated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hydrated = mounted && storeReady;
  const navOpen = useUI((s) => s.navOpen);
  const setNavOpen = useUI((s) => s.setNavOpen);

  useEffect(() => bindRouter(router), [router]);
  useEffect(() => {
    setCurrentPath(pathname);
    setNavOpen(false);
  }, [pathname, setNavOpen]);

  useEffect(() => {
    const { count, dispose } = registerWebMCP();
    if (count) console.info(`[webmcp] registered ${count} Kitchen OS tools with the browser`);
    useAgent.setState({ webmcp: count });
    return dispose;
  }, []);

  return (
    <div className="min-h-[100dvh]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-rule bg-paper transition-transform duration-300 ease-[var(--ease)] lg:translate-x-0",
          navOpen ? "translate-x-0 shadow-[var(--shadow)]" : "-translate-x-full",
        )}
      >
        <Sidebar pathname={pathname} ready={hydrated} />
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-[rgb(14_19_22/0.3)] lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}

      <div className="lg:pl-[232px]">
        <Topbar ready={hydrated} />
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-28 md:px-8 md:pt-8">{hydrated ? children : <PageSkeleton />}</main>
      </div>

      {hydrated && <AgentDock />}
      <GhostCursor />
      <Toaster position="top-right" toastOptions={{ className: "!bg-paper !text-ink !ring-1 !ring-rule !shadow-[var(--shadow)] !rounded-[10px] !border-0" }} />
    </div>
  );
}

function Sidebar({ pathname, ready }: { pathname: string; ready: boolean }) {
  const kitchenName = useKitchen((s) => s.settings.kitchenName);
  const setNavOpen = useUI((s) => s.setNavOpen);
  const groups = ["Run", "Grow", "Admin"] as const;
  return (
    <>
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[8px] bg-heat font-display text-[17px] font-bold text-heat-ink">K</span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Kitchen OS</span>
            <span className="block text-xs text-ink-3">{ready ? kitchenName : "\u00a0"}</span>
          </span>
        </Link>
        <IconButton label="Close menu" className="lg:hidden" onClick={() => setNavOpen(false)}>
          <X size={18} />
        </IconButton>
      </div>
      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-2 pb-24">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="px-2 pb-1.5 text-xs text-ink-3">{g}</div>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      data-agent-nav={n.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-[8px] px-2.5 text-sm transition-colors",
                        active ? "bg-heat-wash font-medium text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                      )}
                    >
                      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-heat" aria-hidden />}
                      <Icon size={18} weight={active ? "fill" : "regular"} className={active ? "text-heat" : "text-ink-3 group-hover:text-ink-2"} />
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

function Topbar({ ready }: { ready: boolean }) {
  const setNavOpen = useUI((s) => s.setNavOpen);
  const setTheme = useUI((s) => s.setTheme);
  const queue = useKitchen((s) => s.orders.filter((o) => o.status === "new" || o.status === "preparing").length);
  const [clock, setClock] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    tick();
    setDark(resolvedTheme() === "dark");
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);

  const busy = ready && queue > 8;
  return (
    <div className="sticky top-0 z-20 border-b border-rule bg-steel/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 md:px-8">
        <IconButton label="Open menu" className="lg:hidden" onClick={() => setNavOpen(true)}>
          <List size={20} />
        </IconButton>
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("live-dot size-2 rounded-full", busy ? "bg-warn" : "bg-good")} aria-hidden />
          <span className="font-medium text-ink">{busy ? "Busy" : "Open"}</span>
          {ready && (
            <span className="hidden text-ink-3 sm:inline">
              <span className="num">{queue}</span> tickets on the line
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="num mr-2 hidden text-sm text-ink-2 sm:inline">{clock}</span>
          <IconButton
            label={dark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => {
              setTheme(dark ? "light" : "dark");
              setDark(!dark);
            }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-[8px] bg-paper" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-40 rounded-[12px] bg-paper md:col-span-2" />
        <div className="h-40 rounded-[12px] bg-paper" />
      </div>
      <div className="h-72 rounded-[12px] bg-paper" />
    </div>
  );
}
