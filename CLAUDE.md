# Kitchen OS

Next.js 15 App Router demo of an AI agent operating a cloud-kitchen management app. See README.md for the architecture.

- Every user action has one zod schema in `lib/schemas.ts`, one store action in `lib/store.ts`, and one agent tool in `lib/agent/tools.ts`. Add all three together. If the action has a form, add it to `components/forms` with `FormSheet`, and give its opener `data-agent-open` so the agent can drive it.
- Buttons the agent should press carry `data-agent-target="<verb>:<id>"`. Rows it highlights carry `data-row-id`.
- Jev (System One, `lib/agent/jev.ts`) runs before the LLM. A new action that is a pure pick from existing entities can get a fast-path intent there. Write Jev criteria descriptions keyword-rich, because the offline heuristic in `jev-mock.ts` matches on words.
- Design rules: `design-system/MASTER.md`. Use tokens from `app/globals.css`, Phosphor icons only, sentence case, no em-dashes in UI copy.
- Checks: `npm run lint && npm run typecheck && npm test`. Run `npm run test:e2e` for agent flows; it uses the scripted mock LLM.
