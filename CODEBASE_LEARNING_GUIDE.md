# OpenClaw Codebase Learning Guide

## Technical Overview

OpenClaw is a TypeScript monorepo that implements a local-first, multi-channel AI assistant runtime.

At a high level, the system has 5 major layers:

1. Entry and CLI boot layer
- Responsible for starting the process safely, normalizing environment, and dispatching commands.
- Core files: `openclaw.mjs`, `src/entry.ts`, `src/cli/run-main.ts`.

2. Gateway control-plane layer
- Long-running WebSocket/HTTP server that exposes methods (`agent`, `send`, `chat.send`, `health`, etc.) and emits events.
- Core files: `src/gateway/server.impl.ts`, `src/gateway/server-methods.ts`, `src/gateway/server-methods/agent.ts`.

3. Routing and session state layer
- Decides which agent and session key handle each inbound message.
- Persists session metadata/history pointers and delivery context.
- Core files: `src/routing/resolve-route.ts`, `src/config/sessions/store.ts`.

4. Agent execution and reply orchestration layer
- Prepares context, directives, tools, queueing, and runs the embedded agent runtime.
- Streams partial/final output in controlled order.
- Core files: `src/auto-reply/dispatch.ts`, `src/auto-reply/reply/reply-dispatcher.ts`, `src/auto-reply/reply/get-reply.ts`, `src/agents/pi-embedded-runner/run.ts`.

5. Outbound transport and plugin-extensibility layer
- Normalizes outbound payloads and delegates sending to channel adapters.
- Loads and validates plugins, channels, tools, and gateway method extensions.
- Core files: `src/infra/outbound/deliver.ts`, `src/infra/outbound/outbound-session.ts`, `src/channels/plugins/outbound/telegram.ts`, `src/channels/plugins/outbound/whatsapp.ts`, `src/plugins/loader.ts`, `src/plugins/registry.ts`.

---

Concept definitions you need early:

- Control plane: the central coordinator. Here, the Gateway is the control plane.
- Data plane: where actual message payloads and replies move (channel send/receive paths).
- Session key: stable ID used to map a message to a specific conversation context.
- Idempotency: repeated request with same key should not produce duplicate side effects.
- Adapter pattern: a common interface with per-channel implementations behind it.
- Backpressure/serialization: controlling concurrency so stateful operations do not race.


## Data Flows

### 1. CLI Startup and Command Dispatch Flow

1. Node starts `openclaw.mjs`.
2. It enables compile cache and tries to import built entry (`dist/entry.js` or `.mjs`).
3. `src/entry.ts` normalizes environment, handles respawn policy for warning flags, and imports `src/cli/run-main.ts`.
4. `runCli` in `src/cli/run-main.ts` loads env/config context, attempts fast routed commands, then builds the full Commander program and parses args.

Why this matters:
- Fast commands stay fast.
- Full CLI command graph only loads when needed.

### 2. Gateway Boot and Runtime Wiring Flow

1. `startGatewayServer` in `src/gateway/server.impl.ts` reads and validates config snapshot.
2. Legacy migration and plugin auto-enable may run.
3. Gateway runtime settings are resolved (bind host, auth, Control UI, tailscale, endpoints).
4. Plugin registry is loaded and merged with base gateway methods.
5. HTTP/WS runtime state is created and method handlers are attached.

Why this matters:
- Startup includes self-healing config migration and explicit runtime composition.

### 3. Inbound Message to Agent Route Flow

1. Channel monitor receives inbound message (example: WhatsApp monitor in `src/web/auto-reply/monitor/process-message.ts`).
2. `resolveAgentRoute` applies ordered binding tiers and outputs `(agentId, sessionKey, matchedBy)`.
3. Session metadata is written/updated in session store.
4. Dispatcher pipeline begins with finalized inbound context.

Why this matters:
- Routing is deterministic and debuggable because `matchedBy` records why route won.

### 4. Reply Orchestration and Agent Execution Flow

1. `dispatchInboundMessage` wraps execution with `withReplyDispatcher` to ensure cleanup.
2. `getReplyFromConfig` resolves model/provider/tooling/directives/session state.
3. `runEmbeddedPiAgent` executes inside serialized lanes (session lane + optional global lane).
4. Partial tool/block/final replies are emitted through reply dispatcher ordering.

Why this matters:
- Prevents race conditions between concurrent actions in same session.

### 5. Outbound Delivery Flow

1. Reply payloads are normalized into transport-ready objects.
2. `deliverOutboundPayloads` creates write-ahead queue entry for recoverability.
3. Channel handler uses plugin outbound adapter (`sendText`, `sendMedia`, optional `sendPayload`).
4. On success: queue ack. On failure: queue fail.

Why this matters:
- Delivery has durability semantics, not fire-and-forget.

### 6. Plugin Loading and Registry Flow

1. `loadOpenClawPlugins` discovers candidates and manifest data.
2. Plugins are validated, enabled/disabled by config state, and loaded lazily.
3. `createPluginRegistry` records channels/tools/hooks/gateway methods with conflict diagnostics.
4. Registry becomes active globally for channel/tool/method resolution.

Why this matters:
- Extensibility is first-class while preserving safety checks and conflict detection.


## Code Syntax

This section explains important code snippets with:
- syntax definitions
- behavior
- tangible example
- design reasoning
- junior takeaways

### Snippet 1 - Boot fallback import
**File:** `openclaw.mjs` (lines 50-56)

```js
if (await tryImport("./dist/entry.js")) {
  // OK
} else if (await tryImport("./dist/entry.mjs")) {
  // OK
} else {
  throw new Error("openclaw: missing dist/entry.(m)js (build output).");
}
```

Syntax and terms:
- `await`: pauses async execution until promise resolves.
- `if / else if / else`: conditional branching.
- `throw new Error(...)`: raises exception; process fails unless caught.

What it does:
- Tries two build artifact names and fails loudly if neither exists.

Tangible example:
- If you run global CLI before building `dist/`, this check tells you exactly what is missing.

Why designed this way:
- Supports build output variations (`.js` vs `.mjs`) without duplicate entry scripts.

Junior takeaway:
- Fail fast with explicit errors when boot prerequisites are missing.

---

### Snippet 2 - CLI startup pipeline
**File:** `src/cli/run-main.ts` (lines 64-77)

```ts
export async function runCli(argv: string[] = process.argv) {
  const normalizedArgv = normalizeWindowsArgv(argv);
  loadDotEnv({ quiet: true });
  normalizeEnv();
  if (shouldEnsureCliPath(normalizedArgv)) {
    ensureOpenClawCliOnPath();
  }

  assertSupportedRuntime();

  if (await tryRouteCli(normalizedArgv)) {
    return;
  }
```

Syntax and terms:
- `argv: string[] = process.argv`: typed parameter with default value.
- `const`: immutable variable binding.
- `return;`: exits function early.

What it does:
- Normalizes arguments/env/runtime and gives fast route handler first chance.

Tangible example:
- `openclaw status --json` can avoid full command graph load when route handler handles it.

Why designed this way:
- Keeps common operational commands responsive.

Junior takeaway:
- Early-return routing is a practical performance pattern in CLIs.

---

### Snippet 3 - Gateway startup composition
**File:** `src/gateway/server.impl.ts` (lines 241-260)

```ts
const baseMethods = listGatewayMethods();
const emptyPluginRegistry = createEmptyPluginRegistry();
const { pluginRegistry, gatewayMethods: baseGatewayMethods } = minimalTestGateway
  ? { pluginRegistry: emptyPluginRegistry, gatewayMethods: baseMethods }
  : loadGatewayPlugins({
      cfg: cfgAtStart,
      workspaceDir: defaultWorkspaceDir,
      log,
      coreGatewayHandlers,
      baseMethods,
    });
const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
const gatewayMethods = Array.from(new Set([...baseGatewayMethods, ...channelMethods]));
```

Syntax and terms:
- Ternary operator `condition ? a : b`.
- `flatMap`: map + flatten one level.
- `Set`: deduplicated collection.

What it does:
- Builds final method list from core + plugin + channel method contributions.

Tangible example:
- If Matrix extension adds `matrix.something`, method list includes it without editing core array.

Why designed this way:
- Open/closed principle: extend behavior by registration, not core edits.

Junior takeaway:
- Registry merge + dedupe patterns are key in plugin ecosystems.

---

### Snippet 4 - Gateway method authorization
**File:** `src/gateway/server-methods.ts` (lines 99-131)

```ts
function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  if (!client?.connect) {
    return null;
  }
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];
  if (NODE_ROLE_METHODS.has(method)) {
    if (role === "node") {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role === "node") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role !== "operator") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (scopes.includes(ADMIN_SCOPE)) {
    return null;
  }
```

Syntax and terms:
- Optional chaining `client?.connect`: safe property access.
- Nullish coalescing `??`: fallback only for null/undefined.
- `Set.has`: O(1)-style membership check.

What it does:
- Enforces role/scope-based access control before invoking handlers.

Tangible example:
- Node client can publish node events, but cannot invoke operator-only config mutation calls.

Why designed this way:
- Centralized auth policy avoids scattered inconsistent authorization logic.

Junior takeaway:
- Put authorization gates before business handlers.

---

### Snippet 5 - Route resolution tiers
**File:** `src/routing/resolve-route.ts` (lines 366-416)

```ts
const tiers: Array<{
  matchedBy: Exclude<ResolvedAgentRoute["matchedBy"], "default">;
  enabled: boolean;
  scopePeer: RoutePeer | null;
  predicate: (candidate: EvaluatedBinding) => boolean;
}> = [
  {
    matchedBy: "binding.peer",
    enabled: Boolean(peer),
    scopePeer: peer,
    predicate: (candidate) => candidate.match.peer.state === "valid",
  },
  {
    matchedBy: "binding.peer.parent",
    enabled: Boolean(parentPeer && parentPeer.id),
    scopePeer: parentPeer && parentPeer.id ? parentPeer : null,
    predicate: (candidate) => candidate.match.peer.state === "valid",
  },
  {
    matchedBy: "binding.guild+roles",
    enabled: Boolean(guildId && memberRoleIds.length > 0),
    scopePeer: peer,
    predicate: (candidate) =>
      hasGuildConstraint(candidate.match) && hasRolesConstraint(candidate.match),
  },
```

Syntax and terms:
- `Array<{ ... }>`: generic type for typed arrays.
- `Exclude<A, B>`: TypeScript utility type (removes union members).
- Arrow functions `(x) => ...`.

What it does:
- Declares ordered match strategy for choosing agent route.

Tangible example:
- Discord message in guild with certain role can route to specialist agent, while fallback channel binding catches others.

Why designed this way:
- Tiered declarative strategy is easier to test and reason about than large nested `if` trees.

Junior takeaway:
- For complex matching, encode policy as data (`tiers`) plus execution loop.

---

### Snippet 6 - Session store cache with TTL
**File:** `src/config/sessions/store.ts` (lines 147-160)

```ts
export function loadSessionStore(
  storePath: string,
  opts: LoadSessionStoreOptions = {},
): Record<string, SessionEntry> {
  if (!opts.skipCache && isSessionStoreCacheEnabled()) {
    const cached = SESSION_STORE_CACHE.get(storePath);
    if (cached && isSessionStoreCacheValid(cached)) {
      const currentMtimeMs = getFileMtimeMs(storePath);
      if (currentMtimeMs === cached.mtimeMs) {
        return structuredClone(cached.store);
      }
      invalidateSessionStoreCache(storePath);
    }
  }
```

Syntax and terms:
- `Record<string, SessionEntry>`: object type keyed by string.
- `structuredClone(...)`: deep clone built-in.
- `mtime`: file modified time.

What it does:
- Returns cached session data only if TTL valid and file unchanged on disk.

Tangible example:
- Frequent reads during high message traffic avoid disk parse every time.

Why designed this way:
- Performance optimization without stale-data corruption risk.

Junior takeaway:
- Cache invalidation must combine time and source-of-truth change checks.

---

### Snippet 7 - Dispatcher lifecycle safety
**File:** `src/auto-reply/dispatch.ts` (lines 17-31)

```ts
export async function withReplyDispatcher<T>(params: {
  dispatcher: ReplyDispatcher;
  run: () => Promise<T>;
  onSettled?: () => void | Promise<void>;
}): Promise<T> {
  try {
    return await params.run();
  } finally {
    params.dispatcher.markComplete();
    try {
      await params.dispatcher.waitForIdle();
    } finally {
      await params.onSettled?.();
    }
  }
}
```

Syntax and terms:
- Generic `<T>`: function works for any return type.
- `finally`: always runs, even on throw/return.

What it does:
- Guarantees dispatcher cleanup and drain wait regardless of success/failure.

Tangible example:
- If model run throws, system still waits for queued outbound chunks to flush.

Why designed this way:
- Prevents leaked pending-state that could block restarts or leave typing indicators stuck.

Junior takeaway:
- `try/finally` is essential for resource lifecycle correctness.

---

### Snippet 8 - Ordered reply queue
**File:** `src/auto-reply/reply/reply-dispatcher.ts` (lines 145-176)

```ts
sendChain = sendChain
  .then(async () => {
    if (shouldDelay) {
      const delayMs = getHumanDelay(options.humanDelay);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
    await options.deliver(normalized, { kind });
  })
  .catch((err) => {
    options.onError?.(err, { kind });
  })
  .finally(() => {
    pending -= 1;
    if (pending === 1 && completeCalled) {
      pending -= 1;
    }
    if (pending === 0) {
      unregister();
      options.onIdle?.();
    }
  });
```

Syntax and terms:
- Promise chain (`then/catch/finally`).
- Optional callback invocation `options.onError?.(...)`.

What it does:
- Serializes deliveries in strict order with robust cleanup counters.

Tangible example:
- Tool output chunk, block chunk, final chunk arrive in predictable order to Telegram.

Why designed this way:
- Simpler and safer than ad-hoc parallel sends that reorder messages.

Junior takeaway:
- Deterministic ordering often beats maximum throughput in conversational systems.

---

### Snippet 9 - Reply pipeline setup
**File:** `src/auto-reply/reply/get-reply.ts` (lines 53-70)

```ts
export async function getReplyFromConfig(
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: OpenClawConfig,
): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  const isFastTestEnv = process.env.OPENCLAW_TEST_FAST === "1";
  const cfg = configOverride ?? loadConfig();
  const targetSessionKey =
    ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
  const agentSessionKey = targetSessionKey || ctx.SessionKey;
  const agentId = resolveSessionAgentId({
    sessionKey: agentSessionKey,
    config: cfg,
  });
```

Syntax and terms:
- Union return type `A | B | undefined`.
- Environment flags via `process.env`.

What it does:
- Picks active config/session/agent context before any reply computation.

Tangible example:
- Native command can target a different session key than default inbound session.

Why designed this way:
- Early unification of context prevents downstream divergence.

Junior takeaway:
- Resolve identity/context first; compute behavior second.

---

### Snippet 10 - Serialized agent execution lanes
**File:** `src/agents/pi-embedded-runner/run.ts` (lines 165-183)

```ts
const sessionLane = resolveSessionLane(params.sessionKey?.trim() || params.sessionId);
const globalLane = resolveGlobalLane(params.lane);
const enqueueGlobal =
  params.enqueue ?? ((task, opts) => enqueueCommandInLane(globalLane, task, opts));
const enqueueSession =
  params.enqueue ?? ((task, opts) => enqueueCommandInLane(sessionLane, task, opts));

return enqueueSession(() =>
  enqueueGlobal(async () => {
    const started = Date.now();
```

Syntax and terms:
- Higher-order functions: passing tasks as function arguments.
- Closure: inner function uses outer vars (`sessionLane`, `globalLane`).

What it does:
- Forces run ordering inside session lane and optional global lane.

Tangible example:
- Two messages to same session cannot run tools simultaneously and corrupt transcript order.

Why designed this way:
- Queueing avoids race bugs in mutable session state.

Junior takeaway:
- Concurrency control is architecture, not just optimization.

---

### Snippet 11 - Outbound adapter delegation
**File:** `src/infra/outbound/deliver.ts` (lines 99-106)

```ts
async function createChannelHandler(params: ChannelHandlerParams): Promise<ChannelHandler> {
  const outbound = await loadChannelOutboundAdapter(params.channel);
  const handler = createPluginHandler({ ...params, outbound });
  if (!handler) {
    throw new Error(`Outbound not configured for channel: ${params.channel}`);
  }
  return handler;
}
```

Syntax and terms:
- Object spread `{ ...params, outbound }`.
- Adapter: interchangeable implementation behind shared contract.

What it does:
- Looks up outbound adapter for requested channel and validates minimum send contract.

Tangible example:
- Telegram and WhatsApp both satisfy `sendText/sendMedia`, but with channel-specific internals.

Why designed this way:
- Core deliverer stays channel-agnostic.

Junior takeaway:
- Adapter boundaries reduce copy/paste transport logic.

---

### Snippet 12 - Write-ahead delivery queue
**File:** `src/infra/outbound/deliver.ts` (lines 203-217)

```ts
const queueId = params.skipQueue
  ? null
  : await enqueueDelivery({
      channel,
      to,
      accountId: params.accountId,
      payloads,
      threadId: params.threadId,
      replyToId: params.replyToId,
      bestEffort: params.bestEffort,
      gifPlayback: params.gifPlayback,
      silent: params.silent,
      mirror: params.mirror,
    }).catch(() => null);
```

Syntax and terms:
- Ternary assignment with async call.
- Best-effort catch to avoid blocking send path.

What it does:
- Persists outbound intent before actual send.

Tangible example:
- If process crashes mid-send, recovery can replay unsent queued entries.

Why designed this way:
- Improves reliability of outbound messaging in unstable environments.

Junior takeaway:
- Durability should be explicit around external side effects.

---

### Snippet 13 - Telegram outbound adapter implementation
**File:** `src/channels/plugins/outbound/telegram.ts` (lines 9-25)

```ts
export const telegramOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: markdownToTelegramHtmlChunks,
  chunkerMode: "markdown",
  textChunkLimit: 4000,
  sendText: async ({ to, text, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendTelegram ?? sendMessageTelegram;
    const replyToMessageId = parseTelegramReplyToMessageId(replyToId);
    const messageThreadId = parseTelegramThreadId(threadId);
    const result = await send(to, text, {
      verbose: false,
      textMode: "html",
      messageThreadId,
      replyToMessageId,
      accountId: accountId ?? undefined,
    });
    return { channel: "telegram", ...result };
  },
```

Syntax and terms:
- Typed constant object implementing interface `ChannelOutboundAdapter`.
- Destructured function params in async lambda.

What it does:
- Declares Telegram-specific send behavior with markdown-to-HTML and thread/reply mapping.

Tangible example:
- A threaded group reply maps to Telegram `message_thread_id` correctly.

Why designed this way:
- Keeps transport constraints local to adapter.

Junior takeaway:
- Interface-driven adapters make platform quirks manageable.

---

### Snippet 14 - WhatsApp outbound adapter implementation
**File:** `src/channels/plugins/outbound/whatsapp.ts` (lines 7-24)

```ts
export const whatsappOutbound: ChannelOutboundAdapter = {
  deliveryMode: "gateway",
  chunker: chunkText,
  chunkerMode: "text",
  textChunkLimit: 4000,
  pollMaxOptions: 12,
  resolveTarget: ({ to, allowFrom, mode }) =>
    resolveWhatsAppOutboundTarget({ to, allowFrom, mode }),
  sendText: async ({ to, text, accountId, deps, gifPlayback }) => {
    const send =
      deps?.sendWhatsApp ?? (await import("../../../web/outbound.js")).sendMessageWhatsApp;
    const result = await send(to, text, {
      verbose: false,
      accountId: accountId ?? undefined,
      gifPlayback,
    });
    return { channel: "whatsapp", ...result };
  },
```

Syntax and terms:
- Dynamic import `await import(...)` for lazy loading.
- Nullish fallback to dependency-injected send function.

What it does:
- Encodes WhatsApp-specific target resolution and send behavior.

Tangible example:
- If caller passes raw number, `resolveTarget` normalizes to WhatsApp destination semantics.

Why designed this way:
- Supports both injected test deps and runtime lazy import.

Junior takeaway:
- Dependency injection + lazy import is powerful for testability and startup cost.

---

### Snippet 15 - Plugin loader cache + lazy Jiti
**File:** `src/plugins/loader.ts` (lines 192-197, 223-231)

```ts
if (cacheEnabled) {
  const cached = registryCache.get(cacheKey);
  if (cached) {
    setActivePluginRegistry(cached, cacheKey);
    return cached;
  }
}

let jitiLoader: ReturnType<typeof createJiti> | null = null;
const getJiti = () => {
  if (jitiLoader) {
    return jitiLoader;
  }
  jitiLoader = createJiti(import.meta.url, {
```

Syntax and terms:
- `Map.get` cache lookup.
- Lazy initialization (construct once on first use).

What it does:
- Reuses plugin registry when config unchanged and only allocates loader if needed.

Tangible example:
- Unit tests with plugins disabled avoid expensive loader creation.

Why designed this way:
- Performance + deterministic state for repeated loads.

Junior takeaway:
- Lazy init with cache keys is a common pattern in extension systems.

---

### Snippet 16 - Plugin registry type model
**File:** `src/plugins/registry.ts` (lines 124-138)

```ts
export type PluginRegistry = {
  plugins: PluginRecord[];
  tools: PluginToolRegistration[];
  hooks: PluginHookRegistration[];
  typedHooks: TypedPluginHookRegistration[];
  channels: PluginChannelRegistration[];
  providers: PluginProviderRegistration[];
  gatewayHandlers: GatewayRequestHandlers;
  httpHandlers: PluginHttpRegistration[];
  httpRoutes: PluginHttpRouteRegistration[];
  cliRegistrars: PluginCliRegistration[];
  services: PluginServiceRegistration[];
  commands: PluginCommandRegistration[];
  diagnostics: PluginDiagnostic[];
};
```

Syntax and terms:
- Type alias for structured contract.
- Arrays of registration records per plugin capability.

What it does:
- Defines the canonical in-memory schema for everything plugins can contribute.

Tangible example:
- A plugin may add both `gatewayHandlers` and `channels` entries and diagnostics on conflict.

Why designed this way:
- One normalized registry object simplifies runtime lookup and introspection.

Junior takeaway:
- In plugin platforms, a strong registry schema is foundational architecture.


## Study Guide

This program is designed to take you from junior to codebase-proficient contributor.

### Phase 0: Foundations (1-2 weeks)

You should understand these before deep feature work:

1. TypeScript essentials
- `type` vs `interface`
- unions, generics, utility types (`Omit`, `Exclude`, `Record`)
- async/await and promise lifecycle (`then/catch/finally`)

2. Node.js runtime basics
- module loading (ESM)
- process lifecycle and env vars
- filesystem IO and JSON persistence

3. Architectural patterns used heavily here
- adapter pattern
- dependency injection
- event-driven systems
- idempotency and dedupe
- queue-based concurrency control

Hands-on exercises:
- Read and annotate `src/cli/run-main.ts` and explain each early return path.
- Add a tiny isolated utility + tests to practice project conventions.

### Phase 1: Control Plane Core (2-3 weeks)

Focus files:
- `src/gateway/server.impl.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/server-methods/agent.ts`

What to learn:
- request validation flow
- scope authorization
- idempotency cache behavior
- separation between protocol handling and business logic

Hands-on improvements:
1. Add improved structured logging for one gateway method (include correlation IDs).
2. Add a test for an authorization edge case in `src/gateway/server-methods.ts`.
3. Add one new safe read-only gateway method and document its scope requirements.

### Phase 2: Routing and Session Integrity (2-3 weeks)

Focus files:
- `src/routing/resolve-route.ts`
- `src/config/sessions/store.ts`
- `src/sessions/send-policy.ts`

What to learn:
- routing precedence semantics
- session persistence guarantees
- cache invalidation + lock strategy
- delivery context normalization

Hands-on improvements:
1. Add tests for one new routing edge case (`matchedBy` expectation).
2. Add a diagnostic utility that reports suspicious session-store anomalies.
3. Add or improve comments around one non-obvious cache/lock section.

### Phase 3: Agent Loop and Reply Pipeline (3-4 weeks)

Focus files:
- `src/auto-reply/dispatch.ts`
- `src/auto-reply/reply/reply-dispatcher.ts`
- `src/auto-reply/reply/get-reply.ts`
- `src/agents/pi-embedded-runner/run.ts`

What to learn:
- directive processing pipeline
- stream ordering guarantees
- lane serialization model
- timeout/failover behavior

Hands-on improvements:
1. Add metrics counters for dispatcher queue depth and idle transitions.
2. Add tests covering one failover branch in `run.ts`.
3. Improve error message clarity for one common user-facing failure path.

### Phase 4: Outbound + Plugin Architecture (3-4 weeks)

Focus files:
- `src/infra/outbound/deliver.ts`
- `src/infra/outbound/outbound-session.ts`
- `src/channels/plugins/outbound/telegram.ts`
- `src/channels/plugins/outbound/whatsapp.ts`
- `src/plugins/loader.ts`
- `src/plugins/registry.ts`

What to learn:
- channel adapter contracts
- write-ahead delivery guarantees
- plugin discovery/validation/registration
- conflict diagnostics

Hands-on improvements:
1. Add contract tests for one outbound adapter edge case (thread/reply mapping).
2. Add plugin loader diagnostics when cache-key hit ratio is low.
3. Add docs for creating a minimal channel plugin in a local extension.

### Phase 5: Become Expert-Level in this repo

Habits to build:
1. Always trace end-to-end flow before changing a subsystem.
2. Use tests to lock behavior before refactoring.
3. Keep changes scoped to one layer when possible.
4. Add observability (logs/metrics) for asynchronous flows.
5. Review routing/session side effects for every channel-related change.

Suggested capstone tasks:
1. Implement a small new gateway method + tests + docs.
2. Add a new reply dispatcher option safely (with backward compatibility).
3. Add a plugin health diagnostic endpoint contribution and verify it appears in registry/method lists.

### Daily Practice Loop

1. Pick one function.
2. Write a short input -> transform -> output note.
3. Run or write one test that proves your understanding.
4. Make one tiny improvement (naming, guardrail, log, test).
5. Repeat.

If you do this for 4-6 weeks, you will develop strong local intuition for OpenClaw's architecture and constraints.
