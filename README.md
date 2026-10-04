# Kitchen OS: an AI-agent cloud kitchen demo

A management app for a three-brand, delivery-only cloud kitchen. It covers orders/KDS, sales, menu, inventory and purchasing, billing and aggregator payouts, marketing, finance, customers and staff. An agent sits in the bottom-left corner. It can do anything a person can do in the app:

- **Answer** questions from live data ("Why did food cost go up last week?").
- **Show me** mode: it navigates, moves a visible cursor, types into the real form fields and presses the real submit button.
- **Background** mode: the same actions run silently through the same validated store actions, without moving the screen.

The agent runs on any tool-calling model via [OpenRouter](https://openrouter.ai).

## Run it

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY (optional)
npm run dev                  # http://localhost:3000
```

With no key, the agent runs in **demo mode**: a scripted planner that speaks the same tool-calling format, so the real loop, tools and UI driver all still run. You can also paste a key in **Settings**; it is stored only in your browser.

To change the model, type an OpenRouter model id in **Settings → AI agent → Model**; it takes effect on the next message. Leave it empty to use `OPENROUTER_MODEL` from `.env.local` (default `anthropic/claude-sonnet-5.5`). A model set in Settings wins over the env value.

To serve the app under a path such as `your-domain/cloud-kitchen-os`, set `NEXT_PUBLIC_BASE_PATH=/cloud-kitchen-os` (in `.env.local` or your host's environment variables) and rebuild. The bare domain then redirects to the prefix.

Demo data is seeded per browser and kept in localStorage. Use **Settings → Reset demo data** to start fresh.

## Things to try

- "Restock everything that's low from the cheapest suppliers", then "send them".
- "Create a phone order: 2 butter chicken and 4 naan for Rhea".
- "Reply to every unanswered review under 3 stars".
- "Is any aggregator payout short? Dispute it if so." This asks you for confirmation first.
- "Launch a 2-week Instagram campaign for Crust Lab with a 15k budget, but let me review before submitting." This uses `submit=false`.
- Toggle **Show me / Background** in the dock and repeat a request.
- Every "Needs attention" item on the Command center has a **Let the agent handle it** button.

## How the agent works

```
user ─▶ AgentDock ─▶ agent loop (browser) ──POST /api/chat──▶ OpenRouter
                         │  ▲                    (key stays server-side)
                 tool_calls │  │ results
                         ▼  │
                    executeTool ── zod validation ── confirm? ──┬─ background: store action
                                                                └─ show me: UI driver
                                                                   (navigate, cursor, type, click)
```

| File | Role |
| --- | --- |
| `lib/schemas.ts` | One zod schema per action, shared by the on-screen form, the store action and the tool's JSON schema. |
| `lib/agent/tools.ts` | The capability catalogue: 45 read, write and navigate tools, plus `PAGES`. |
| `lib/agent/capabilities.ts` | Builds the system prompt: the app, pages and tools, plus live context (current page, open forms, user preference). |
| `lib/agent/agent-store.ts` | The client-side tool-calling loop, step timeline and confirmations. |
| `lib/agent/driver.ts` | The UI driver: ghost cursor, navigation, typing, clicking. |
| `lib/agent/forms.ts` | Registry of live forms (react-hook-form) so the agent can fill and submit them. |
| `lib/agent/webmcp.ts` | WebMCP bridge (see below). |
| `app/api/chat/route.ts` | OpenRouter proxy; falls back to `lib/agent/mock.ts`. |

Tools run in the browser because that is where the state, router and DOM live. The server only proxies the model call.

## Jev fast path (System One)

Not every request needs a big reasoning model. [Jev](https://openrouter.ai/docs/guides/community/typesafe-sdk) is TypeSafe's "System One" model. It doesn't write text: it answers yes/no and pick-one questions in a single pass, with a confidence score, in milliseconds. Kitchen OS calls it through OpenRouter's System One API (`POST /api/v1/systemone`, proxied by `app/api/jev/route.ts`), using the same `OPENROUTER_API_KEY`.

Every chat message goes to Jev first (`lib/agent/jev.ts`):

- **Fast path.** If the request is fully described by picks from things that exist (a page, a menu item, a campaign, a coupon, an unpaid invoice, a theme, or "today's status") and Jev is confident, the tool runs straight away. No big model is involved. The reply is tagged "Jev fast path, 140 ms".
- **Tool shortlist.** Otherwise Jev flags which areas the request touches, and the big model gets only those tools (for example, "Jev picked 10 of 45 tools").
- **Reviews.** On Marketing, each review is tagged with a topic and an urgency score, with a "Reply today" filter.
- **Expenses.** The expense form suggests a category from the vendor and note as you type.

Settings has a switch for this and a confidence threshold (default 80%). Below the threshold, requests go to the big model. Without a key, a keyword heuristic stands in for Jev so the demo still works.

## WebMCP

[WebMCP](https://webmachinelearning.github.io/webmcp/) is a W3C Community Group draft. It lets a page register tools with `document.modelContext.registerTool()`; older Chrome builds used `navigator.modelContext`. Agents built into the browser can then call those tools. Support today: a Chrome origin trial, Edge behind a flag, nothing in Firefox or Safari.

Kitchen OS registers its whole tool catalogue there when the API exists. A browser-level agent then gets the same tools, validation and confirmations as the built-in chat. The dock footer and the Settings page show whether it is active. The in-app chat does not depend on WebMCP and works in every browser.

## Design

Design decisions are in `design-system/MASTER.md`. They were made with the skills vendored in `.claude/skills/`: `frontend-design`, `taste-skill`, `ui-ux-pro-max` and `motion-design`.

## Scripts

```bash
npm run lint && npm run typecheck && npm test   # unit tests (vitest)
npm run test:e2e                                 # Playwright, uses MOCK_LLM=1
```

The demo uses fictional aggregators ("DashBite", "FoodRun"), fictional suppliers and seeded sample data.
