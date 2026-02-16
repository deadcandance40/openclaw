# CODEBASE_TOUR.md
## TL;DR
- `openclaw` is a TypeScript-first gateway/control-plane project with a CLI, multi-channel adapters, and a web control UI.
- Core runtime path is: `openclaw.mjs` or `scripts/run-node.mjs` -> `src/entry.ts` -> CLI router -> gateway/server modules.
- The gateway (`src/gateway/*`) is the central API surface: WebSocket + HTTP + auth + request dispatch + sidecar startup.
- Channel message routing resolves into agent/session identity using `src/routing/resolve-route.ts`.
- Safe beginner tinkering should target tests, CLI output/help text, and small feature-flagged debug behavior.

## How to run (commands + env/config)
### Key terms (quick)
- Entry point: first file executed when you run a command.
- Dev mode: source-driven local loop for quick iteration.
- Prod mode: compiled output in `dist/`.

### Toolchain and runtime
- Node: `>=22.12.0` (`package.json`)
- Package manager: `pnpm` (`package.json`, `pnpm-workspace.yaml`)
- Main language: TypeScript (`src/*`)
- UI package: Vite + Lit (`ui/package.json`)

### Common commands
- Install deps: `pnpm install`
- Build UI: `pnpm ui:build`
- Build project: `pnpm build`
- Run CLI in dev from source: `pnpm openclaw <command>`
- Start gateway in dev: `pnpm gateway:dev`
- Watch/reload gateway loop: `pnpm gateway:watch`
- Lint: `pnpm lint`
- Format check: `pnpm format:check`
- Run tests: `pnpm test`
- Gateway-only tests: `pnpm vitest run --config vitest.gateway.config.ts`
- Single test file: `pnpm vitest run src/channels/registry.test.ts`

### Config and env
- Default state dir: `~/.openclaw` (`src/config/paths.ts`)
- Default config file: `~/.openclaw/openclaw.json` (`src/config/paths.ts`)
- Override config path: `OPENCLAW_CONFIG_PATH`
- Override state dir: `OPENCLAW_STATE_DIR`
- Auth envs: `OPENCLAW_GATEWAY_TOKEN` or `OPENCLAW_GATEWAY_PASSWORD`
- Example envs and precedence: `.env.example`

### Bootstrap chain
- Compiled CLI bootstrap: `openclaw.mjs`
- Dev auto-build wrapper: `scripts/run-node.mjs`
- CLI startup/runtime normalization: `src/entry.ts` (`runCli`)

## Architecture map
### Component map
- CLI surface: `src/cli/*`
- Command implementations: `src/commands/*`
- Gateway runtime: `src/gateway/*`
- Channel adapters: `src/telegram/*`, `src/discord/*`, `src/slack/*`, `src/signal/*`, plus plugin channel layer in `src/channels/plugins/*`
- Routing/session identity: `src/routing/*`, `src/config/sessions*`
- Config/schema/path resolution: `src/config/*`
- Shared infra/logging utilities: `src/infra/*`, `src/logging/*`
- Control UI package: `ui/*`
- Plugins/extensions: `src/plugins/*`, `extensions/*`
- Adjacent native app (not core of this tour): `apps/macos/*`

### Boundary meanings
- API layer: where input enters (`src/cli`, `src/gateway/server-http.ts`, `src/gateway/server/ws-connection/*`)
- Domain layer: routing/policies/orchestration (`src/routing`, `src/gateway/server-methods/*`, `src/commands/agent.ts`)
- Persistence layer: config/session/pairing stores (`src/config/*`, `src/infra/*pairing*`)
- UI layer: control web UI (`ui/*`) served by gateway
- Shared utilities: env parsing, logging, validation helpers

### Dependency direction
- Inputs (CLI/HTTP/WS/channel events) call gateway/command handlers.
- Handlers call domain logic (routing, policy, agent orchestration).
- Domain logic calls persistence + outbound adapters.
- UI and external clients consume gateway methods/events.

## End-to-end flows
### Flow 1: CLI startup -> Gateway process
1. `openclaw ...` starts in `openclaw.mjs`.
2. Dev workflow often uses `scripts/run-node.mjs` to rebuild if stale.
3. `src/entry.ts` runs `runCli`.
4. Routing/registration in `src/cli/route.ts` and `src/cli/program/command-registry.ts`.
5. Gateway command registration in `src/cli/gateway-cli/register.ts`.
6. Gateway run option handling and guardrails in `src/cli/gateway-cli/run.ts`.
7. Runtime startup in `src/gateway/server.impl.ts` (`startGatewayServer`).

### Flow 2: WS connect/auth -> method dispatch
1. WS handlers attached in `src/gateway/server-ws-runtime.ts`.
2. Connection lifecycle in `src/gateway/server/ws-connection.ts`.
3. First-frame handshake and auth in `src/gateway/server/ws-connection/message-handler.ts`.
4. Auth policy in `src/gateway/auth.ts` (`authorizeGatewayConnect`).
5. Request authorization and dispatch in `src/gateway/server-methods.ts` (`handleGatewayRequest`).
6. Concrete handler execution in modules under `src/gateway/server-methods/*`.

### Flow 3: Telegram inbound message -> response
1. Provider loop starts in `src/telegram/monitor.ts` (`monitorTelegramProvider`).
2. Bot setup in `src/telegram/bot.ts` (`createTelegramBot`).
3. Update handlers in `src/telegram/bot-handlers.ts`.
4. Message processor wiring in `src/telegram/bot-message.ts`.
5. Response orchestration in `src/telegram/bot-message-dispatch.ts`.
6. Outbound delivery uses channel-specific send helpers and shared delivery logic (`src/infra/outbound/deliver.ts`).

## Key abstractions/invariants
1. `OpenClawConfig` (`src/config/*`)
- Invariant: config must parse/validate before runtime starts.
- Enforcement: startup validation in `src/gateway/server.impl.ts`.

2. Protocol validators (`src/gateway/protocol/index.ts`)
- Invariant: unvalidated frames should not reach business handlers.
- Enforcement: WS message handler + per-method validators.

3. Auth model (`src/gateway/auth.ts`)
- Invariant: unauthorized clients cannot connect/act.
- Enforcement: handshake auth and HTTP auth checks.

4. Method scope gating (`src/gateway/server-methods.ts`)
- Invariant: role/scopes must match method class.
- Enforcement: `authorizeGatewayMethod` before handler call.

5. Routing result (`src/routing/resolve-route.ts`)
- Invariant: each message resolves to deterministic `agentId` and `sessionKey`.
- Enforcement: ordered route matching and defaults.

6. Channel plugin adapter contract (`src/channels/plugins/*`)
- Invariant: outbound sends require adapter capabilities.
- Enforcement: runtime checks in `loadChannelOutboundAdapter` and `deliverOutboundPayloads`.

7. Send idempotency (`src/gateway/server-methods/send.ts`)
- Invariant: duplicate idempotency key should reuse cached/inflight result.
- Enforcement: dedupe store + inflight map.

8. Device identity/pairing (`src/gateway/server/ws-connection/message-handler.ts`, `src/infra/device-*`)
- Invariant: device signatures/pairing constraints must pass for device-auth flows.
- Enforcement: connect-time signature/nonce/pairing checks.

## Risks/gotchas
- Security/auth regressions are high risk: `src/gateway/auth.ts`, `src/gateway/server/ws-connection/message-handler.ts`, `src/gateway/origin-check.ts`.
- Startup side effects: `src/gateway/server-startup.ts` can start channels, hooks, plugin services, memory backend.
- Dynamic plugin loading can mask root causes: `src/plugins/loader.ts`.
- Channel-initiated config writes may happen unless disabled: `src/channels/plugins/config-writes.ts`.
- Generated artifacts are script-managed:
  - Protocol schema: `scripts/protocol-gen.ts` -> `dist/protocol.schema.json`
  - Swift protocol generation: `scripts/protocol-gen-swift.ts`
- Unit coverage excludes many integration surfaces (`vitest.config.ts`), so passing tests do not guarantee full runtime behavior.

## Suggested reading order
1. `README.md`  
High-level intent and run modes.

2. `package.json`  
Command surface and toolchain truth.

3. `openclaw.mjs`  
Compiled bootstrap path.

4. `scripts/run-node.mjs`  
Dev runner and stale-build logic.

5. `src/entry.ts`  
Main CLI startup.

6. `src/cli/route.ts`  
Fast route-first execution path.

7. `src/cli/program/command-registry.ts`  
How command tree is assembled.

8. `src/cli/gateway-cli/register.ts`  
Gateway command UX surface.

9. `src/cli/gateway-cli/run.ts`  
Gateway launch checks and safety rules.

10. `src/gateway/server.impl.ts`  
Core runtime composition.

11. `src/gateway/server/ws-connection/message-handler.ts`  
Handshake/auth/request ingestion.

12. `src/gateway/server-methods.ts`  
Method auth and dispatch.

13. `src/gateway/server-methods/send.ts`  
Representative handler with idempotency and outbound path.

14. `src/infra/outbound/deliver.ts`  
Shared delivery abstraction across channels.

15. `src/routing/resolve-route.ts`  
Agent/session route resolution logic.

16. `src/telegram/monitor.ts`  
Representative provider monitor loop.

17. `src/telegram/bot.ts`  
Middleware and policy wiring.

18. `src/telegram/bot-message-dispatch.ts`  
Reply orchestration and delivery integration.

19. `src/channels/plugins/index.ts`  
Runtime channel plugin lookup boundary.

20. `vitest.config.ts`  
Testing strategy and intentional gaps.

## Tinkering menu (low risk, reversible)
1. Add test for channel alias normalization
- Change: add/extend tests for `normalizeChatChannelId`.
- Where: `src/channels/registry.test.ts`.
- Validate: `pnpm vitest run src/channels/registry.test.ts`.
- Rollback: revert test file changes.

2. Clarify one CLI help string
- Change: update wording for one command description.
- Where: `src/cli/gateway-cli/register.ts` or `src/cli/program/register.maintenance.ts`.
- Validate: `pnpm openclaw --help` and subcommand help output.
- Rollback: revert that file.

3. Add send idempotency test case
- Change: test cached/inflight behavior for same `idempotencyKey`.
- Where: `src/gateway/server-methods/send.test.ts`.
- Validate: `pnpm vitest run --config vitest.gateway.config.ts src/gateway/server-methods/send.test.ts`.
- Rollback: revert test changes.

4. Add feature-flagged debug log for route-first CLI
- Change: gated log path in route match execution.
- Where: `src/cli/route.ts`.
- Validate: run once with env flag on/off, confirm behavior unchanged except logging.
- Rollback: remove flag + log code.

5. Tighten one validation error message in agent handler
- Change: improve one invalid-param branch message.
- Where: `src/gateway/server-methods/agent.ts`.
- Validate: add focused test for error response shape/message.
- Rollback: revert handler and associated test.

## Cursor navigation + beginner code-reading playbook
### Cursor navigation tips
- Use quick-open (`Cmd/Ctrl+P`) for direct file jumps.
- Use global search (`Cmd/Ctrl+Shift+F`) for symbols like `startGatewayServer`, `runCli`, `handleGatewayRequest`.
- Use Go to Definition (`F12`) to follow the forward call chain.
- Use Find References (`Shift+F12`) before edits to understand impact radius.
- Keep two panes: implementation left, test file right.
- Use file outline/breadcrumbs in long files like `src/gateway/server.impl.ts`.
- Keep a scratch note with columns: `input`, `decision`, `side effect`.

### Beginner reading strategy
- Read signatures and types first.
- Find guard clauses and validation branches before main logic.
- Mark side effects explicitly.
- Follow data transformation steps (normalize -> validate -> dispatch -> persist/deliver).
- Confirm assumptions with validators/tests, not intuition.
- Summarize each function in one line: “Given X, guarantees Y.”

### TypeScript-specific tips
- `type`/`interface` describe intended shape; runtime safety comes from explicit validators/checks.
- Watch `validate*` and `resolve*` functions to understand trust boundaries.
- Treat dynamic imports as boundary indicators (lazy command/plugin loading).
- Prefer understanding one narrow call path deeply instead of skimming many files.

## Open questions
- None required for this first pass.

## Notes
- This tour is read-only and based on static repository inspection.
- Runtime behavior can still differ due to environment, credentials, and enabled channels/plugins.
