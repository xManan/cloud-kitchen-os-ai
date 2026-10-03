# Kitchen OS

Next.js 15 App Router demo of an AI agent operating a cloud-kitchen management app. See README.md for the architecture.

- Every user action has one zod schema in `lib/schemas.ts`, one store action in `lib/store.ts`, and one agent tool in `lib/agent/tools.ts`. Add all three together. If the action has a form, add it to `components/forms` with `FormSheet`, and give its opener `data-agent-open` so the agent can drive it.
- Buttons the agent should press carry `data-agent-target="<verb>:<id>"`. Rows it highlights carry `data-row-id`.
- Design rules: `design-system/MASTER.md`. Use tokens from `app/globals.css`, Phosphor icons only, sentence case, no em-dashes in UI copy.
- Checks: `npm run lint && npm run typecheck && npm test`. Run `npm run test:e2e` for agent flows; it uses the scripted mock LLM.
