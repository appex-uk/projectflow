# ProjectFlow: product-readiness analysis

This is based on reading the code, docs and build output, not on running the app with real users. I haven't changed anything.

## Where it stands

**Strengths to build on:**
- **Conversational interface:** the chat translator turns plain-English requests into actions. This is your main advantage over Jira-style tools for non-technical users.
- **MCP:** it exposes 11 tools and 3 resources.
- **Views and storage:** there are Kanban, Hierarchy and Timeline views, plus file or Postgres storage.
- **Operations:** health, metrics, a Dockerfile and graceful shutdown are in place.
- **Planning:** the BRD, PRDs and freemium plan are good.
- **UI hygiene:** task cards escape user text before rendering, so basic XSS handling is in place.

**The core issue:** the repo is a developer tool with product ambitions written down. The PRDs describe multi-tenancy, auth, RBAC and feature gating. In code, only the tenant storage layer and the `WithTenant` context helpers exist. Nothing in `cmd/server/main.go` or the handlers calls them, so none of it is wired in.

## Blockers (must fix before anyone else uses it)

1. **The build is red.**
   - `go test ./...` fails to build for the `storage`, `handlers`, `health` and `mcp` packages.
   - The cause is the `ctx context.Context` refactor: tests still call `CreateTask(task)` without a context.
   - You can't safely ship changes without a working test suite.
2. **There is no authentication or authorization.**
   - Every `/api/*` route is open, and `/metrics` and `/api/docs` are too.
   - There are no users, sessions or login.
   - `/api/docs/` sets `Access-Control-Allow-Origin: *`.
   - The server has no request-size limits and no read, write or header timeouts.
3. **There is no multi-user model.**
   - Tasks have no assignee, creator or owner. There are no users, teams or invitations.
   - A non-technical PM's first question is "who is doing this?", and the product can't answer it.
4. **Chat actions run before the user can confirm them.**
   - `requiresConfirmation` is only set for delete, and `chat.go` runs `executeMCPCommands` before returning that flag. So a mis-parsed delete has already happened by the time the UI could ask.
   - Conversations are held in memory only and are lost on restart.
   - The prompt and the code hard-code `"PF"` as the default project, and the MCP server defaults to `"ABC"`. A new user's first chat could create tasks in a project that doesn't exist or is the wrong one.
5. **Setup is a developer workflow.**
   - You need Go 1.24 and environment variables, and the chat needs Ollama or an API key.
   - There is no installer, hosted version, onboarding flow or empty-state guidance.
   - The UI opens on "No Project Selected", and project switching is buried in a hamburger menu.
6. **MCP only works over stdio.**
   - `cmd/mcp-server` is a local subprocess that talks straight to storage.
   - A non-technical person using Claude Desktop or Copilot can't connect to a hosted instance.
   - There is also no per-user identity, so an agent's actions can't be attributed or limited.

## Missing project-management features

Compared with what a PM expects (Asana, Monday, Trello), the task model has no:
- **Assignee** or multiple owners.
- **Comments** or @mentions.
- **Dependencies.** "Blocked" is a status with no reason or linked task.
- **Labels or tags.**
- **Estimates or effort.**
- **Attachments or links.**
- **Sprints, milestones or releases.**
- **Activity history** or audit trail.
- **Notifications** by email or Slack. There is a notification manager, but it is a UI toast.
- **Recurring tasks**, **templates**, **checklists** or **custom fields.**

Things that exist but aren't PM-grade:
- **Kanban:** the columns are fixed to todo, in progress, done and blocked, with no custom workflows.
- **Timeline:** it is a list of dated items, not a Gantt chart with dependencies.
- **Dashboard and reports:** there is no dashboard with workload, progress, overdue or burndown, and no export (CSV, PDF, status report).
- **Search:** it is client-side filtering only.
- **Terminology:** "Epic / Story / Subtask" is software jargon. A general PM thinks in "Project, Phase, Task, Checklist". Consider a plain-language mode.

## UX and language for non-technical users

- **Jargon:** display IDs like `PF-123`, "MCP", "LLM provider", "storage type" and "hierarchy view" shouldn't appear in the main flow.
- **Help content:** the docs are developer-oriented (`developer-guide`, `ollama-integration`, `llm-setup-guide`). They need task-based help like "Plan a launch in 5 minutes".
- **Chat quality:** the prompt is a single-shot JSON classifier at `MaxTokens: 500`.
  - There is no conversation context, so "make it high priority" can't work.
  - There are no bulk actions ("move all overdue tasks to next week").
  - It can't answer questions or summarise ("what's at risk?", "write my status update").
  - It has no update or reschedule handling beyond the basic intents.
  - Small local models will mis-parse often. Use tool calling instead of "respond with JSON only".
  - Show a preview such as "I'll create 3 tasks: [Apply] [Edit] [Cancel]" and add undo.
- **Missing UI states:** empty states, loading and error states, an undo toast, keyboard help and mobile layout. The mobile story is thin: it has `responsive.css` but no PWA or real mobile testing.
- **Accessibility:** the README claims it, but I haven't verified it. Check it with an audit before you market it.
- **Templates:** offer starter templates ("Event planning", "Product launch", "Onboarding") so users don't start from a blank board.

## Architecture and engineering debt

- **Server-rendered tasks plus a JS-rendered UI:** `index.html` renders cards in Go templates, and 20+ JS files also render them. Pick one approach. A single data-driven frontend (or htmx) would simplify the code and make it easier to test.
- **Dead and test code in the repo:** the repo contains:
  - `coverage.out`, `coverage.html` and a `handler_test.go.backup` file
  - four debug and test HTML files (`chat-test.html`, `debug-detailed.html`, `debug-project-selector.html`, `debug_filters.html`, `filter-test.html`) plus `web/test-sorting.html` and `css-debug.js`
  - `fix_context.sh` and the loose `image*.png` files in the repo root
  
  Remove these from git and add them to `.gitignore`.
- **Frontend assets:** they're served from the working directory (`http.Dir("web/static/")` and `NewDocsHandler("docs")`). Embed them with `go:embed` so a single binary works from anywhere.
- **Hand-rolled routing:** `main.go` splits URL paths by hand. Use Go 1.22+ pattern routing (`GET /api/tasks/{id}/children`).
- **Error handling:** it uses `http.Error` plain text. Switch to a consistent JSON error shape with codes.
- **Missing API features:** the API has no pagination, no `If-Match` or optimistic locking for tasks, and no OpenAPI spec. A spec would also make the MCP tools and a future SDK easier to generate.
- **Version string:** it's hard-coded as `"1.0.0"` in `main.go`.
- **Duplicate task logic:** the HTTP handlers, MCP tools and chat executor each implement it. Put a single service layer under all three so validation, display IDs, permissions and audit logging live in one place.
- **Postgres RLS:** the work exists as docs and migrations, but nothing sets the tenant on requests. Without auth middleware that does, it protects nothing.
- **Missing observability:** you have metrics but no tracing, and the LLM calls aren't instrumented for latency, cost or failure rates.
- **Supply chain and quality gates:** CI, linting, dependency scanning and a release process are absent. I saw no `.github/workflows`.

## What to prioritise

**Phase 0: make it shippable (1–2 weeks)**
1. Fix the tests and add CI (build, vet, test, lint). Clean the junk files out of the repo.
2. Embed assets and docs into the binary. Add server timeouts and body limits.
3. Add authentication (OIDC or email magic link) and a user model. Wire the tenant context from the authenticated user.
4. Make chat safe: show a preview and confirm before any write, persist conversations, drop the hard-coded `PF` and `ABC` defaults, and use the currently selected project.

**Phase 1: make it usable for a PM (3–6 weeks)**
5. Add assignees, comments, labels, dependencies, estimates and a task activity log.
6. Add a landing dashboard: overdue, due this week, blocked, workload per person.
7. Add onboarding: a guided first-project flow and templates.
8. Add a "generate status report" action (chat plus export).
9. Rename jargon and offer a simple-mode vocabulary.
10. Add email and Slack/Teams notifications.

**Phase 2: make MCP a differentiator (parallel)**
11. Add remote MCP over streamable HTTP with per-user tokens, so a PM can connect Claude or Copilot to their hosted workspace without installing anything.
12. Pick a few high-value tools: `summarise_project`, `plan_from_goal` (a goal produces an epic and tasks), `reschedule_overdue`, `weekly_status`, `bulk_update`. Make every action attributed to a user and agent, and reversible.
13. Pick hosted LLM defaults so non-technical users never see "provider" or "Ollama". Keep local models as an enterprise or privacy option.

**Phase 3: monetise**
14. Build the freemium tiers from your plan once auth and tenants work: limits, billing (Stripe), license checks and an admin console.
15. Add RBAC and audit logs for the enterprise tier.

## Suggested positioning

"Run your project by talking to it. Works with the AI tools you already use."

That sells the chat and MCP angle to non-technical PMs. Don't compete on Gantt charts or feature breadth, because you won't win those quickly.

## Next steps I can take

The highest-leverage starting point is the broken test suite, followed by repo cleanup and a safe confirm-before-write flow in chat. I can start with that. I can also draft a Phase 0 breakdown as issues, or a one-page spec for remote MCP with user tokens.