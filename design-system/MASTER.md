# Kitchen OS design system

Built by applying the vendored skills in `.claude/skills/`:
`frontend-design` (direction and anti-defaults), `taste-skill` (dials and bias corrections),
`ui-ux-pro-max` (design-system search, a11y checklist) and `motion-design` (timing, easing, choreography).
Charts follow the bundled `dataviz` method (validated categorical palette, one axis, hover layer).

## Design read
A multi-brand, delivery-only kitchen run by an ops manager standing at the pass with a laptop.
The primary job is "what needs me right now, and can the agent take it off my hands".
Audience is operational, not marketing: dense, scannable, calm under rush-hour load.

ui-ux-pro-max (`search.py "cloud kitchen restaurant operations dashboard SaaS" --design-system`)
recommended a light-first surface, an orange action accent, and warned against dark-by-default
and excessive animation. We keep those three findings and reject its glassmorphism and
Calistoga/Inter pairing, which read as generic for this subject.

## Dials (taste-skill)
`DESIGN_VARIANCE 5` · `MOTION_INTENSITY 5` · `VISUAL_DENSITY 7`.
Ops software: asymmetric where it helps scanning, never artsy. Density 7 means metrics sit in plain
layout separated by hairlines and space, not wrapped in identical cards.

## Materials, and where the palette comes from
A cloud kitchen is stainless steel, thermal ticket paper and a heat-lamp pass.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--steel` | `#E9EDF0` | `#0E1316` | page plane (brushed steel) |
| `--paper` | `#FFFFFF` | `#161C20` | working surfaces (ticket paper) |
| `--ink` | `#15212B` | `#ECF0F2` | primary text |
| `--ink-2` | `#4A5864` | `#A9B4BC` | secondary text |
| `--ink-3` | `#6E7B86` | `#7F8B94` | muted, axes |
| `--rule` | `#D3DAE0` | `#273038` | hairlines |
| `--heat` | `#C2410C` | `#F0743A` | the single accent: actions, focus, agent |
| `--heat-wash` | `#FCEBE1` | `#3A2015` | accent tint backgrounds |

Status colors (`good #0B8A3E`, `warn #B26B00`, `bad #C62828`) are reserved for state and always
ship with an icon and a label. Chart series use the dataviz reference categorical order
(blue, orange, aqua) capped at three per chart: three brands, three channels.

## Type
- **Bricolage Grotesque** for page titles and the few large figures: its slightly condensed,
  ink-trap character recalls menu boards and ticket printers without being a costume.
- **Geist** for UI and body text, with `tabular-nums` wherever numbers align in columns.
- **Geist Mono** only for printed artifacts: order ticket numbers, PO numbers, coupon codes.
  It is never used for generic small labels.

Sentence case everywhere. No all-caps eyebrows, no em-dashes in UI copy, no "→" on buttons.

## Shape rule (one documented system)
Panels 12px · controls and inputs 8px · status badges full pill · order tickets 4px with a
perforated top edge (the one decorative device, because it encodes "this is a printed order").

## Layout
```
┌────────┬──────────────────────────────────────────────┐
│ rail   │ top bar: kitchen name · live status · search  │
│ 232px  ├──────────────────────────────────────────────┤
│ nav    │ page title + one-line context        actions │
│        │ signature element (per page)                  │
│        │ supporting tables / charts, divided by rules  │
│ agent  │                                               │
│ dock ▲ │                                               │
└────────┴──────────────────────────────────────────────┘
```
Content is left-aligned, max width 1440px. Under 1024px the rail collapses to icons; under 768px
it becomes a bottom bar and the agent dock becomes a full-width sheet.

Each page leads with the element most characteristic of its job, not a row of stat cards:
Command Center → live ticket rail and "needs attention" list; Orders → KDS columns;
Inventory → par-level shelf bars; Finance → P&L waterfall; Marketing → campaign timeline.

## The one bold thing: the agent
Everything else stays quiet so the agent reads as the memorable element.
- Dock pinned bottom-left, in the rail's footprint, so it never covers the work area.
- Each step the agent takes prints into the dock as a ticket line (tool name in plain words).
- In "Show me" mode a heat-colored cursor labelled "Agent" travels to each control,
  a focus ring pulses, fields type in character by character, and the real submit button is pressed.

## Motion (motion-design)
Personality: **Corporate**. Signature easing `cubic-bezier(0.2, 0, 0, 1)` for ~80% of motion;
entrances `cubic-bezier(0.05, 0.7, 0.1, 1)`, exits `cubic-bezier(0.3, 0, 1, 1)`.
Duration palette: quick 140ms · standard 240ms · slow 520ms (agent cursor travel, distance-scaled).
Entrance pattern: 8px rise plus fade, micro-cascade 30ms, total stagger under 300ms, once per route.
Ambient layer: only the live-kitchen status dot pulses. Under `prefers-reduced-motion` the cursor
jumps, typing is instant, and entrances render in their final state.

## Accessibility checklist (ui-ux-pro-max)
AA contrast for text and controls · visible focus (2px heat ring, 2px offset) · labels above
inputs, errors below · keyboard reachable dock (`/` focuses it) · 375 / 768 / 1024 / 1440 checked ·
no color-only status · charts have a table view or direct labels.
