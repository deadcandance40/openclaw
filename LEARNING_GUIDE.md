# 🎓 OpenClaw Codebase - Complete Learning Guide

**Version:** 2026.2.16
**Last Updated:** February 17, 2026
**Target Audience:** Junior developers learning agentic AI systems

---

## 📖 Table of Contents

1. [Technical Overview](#technical-overview)
2. [Data Flows](#data-flows)
3. [Code Syntax Deep Dive](#code-syntax)
4. [Study Guide](#study-guide)

---

# <a name="technical-overview"></a>1. 📚 Technical Overview

## What is OpenClaw?

**OpenClaw** is a _personal AI assistant_ that runs on your own devices and connects to your favorite messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, and more). It bridges the gap between:

- **You** (using messaging apps you already know)
- **AI models** (Claude from Anthropic, GPT from OpenAI)
- **Your computer** (files, terminal, browser, web APIs)

### Real-World Example

Imagine you're on WhatsApp and send: *"What's the weather and is my website up?"*

**OpenClaw's flow:**
1. ✅ Receives your WhatsApp message
2. ✅ Routes it to an AI model (Claude or GPT)
3. ✅ AI uses tools: `web_search` for weather, `web_fetch` to ping your site
4. ✅ Sends response back through WhatsApp

All running locally on your machine, using your own AI subscriptions!

---

## Core Concepts & Terminology

### 🤖 **Agent**
The AI "brain" that processes requests. It:
- Reads your message
- Decides what tools to use
- Generates responses
- Manages conversation context

**Code location:** [src/agents/](src/agents/)

**Technical term:** An agent is an autonomous system that perceives its environment (your messages), makes decisions, and takes actions (uses tools).

---

### 🌐 **Gateway**
A continuously-running background service (daemon) that:
- Receives messages from all channels
- Routes them to the appropriate agent
- Manages sessions
- Handles authentication
- Broadcasts responses back

**Code location:** [src/gateway/](src/gateway/)
**Key file:** [src/gateway/boot.ts](src/gateway/boot.ts)

**Technical term:** Daemon = A background process that runs continuously without direct user interaction.

---

### 📡 **Channel**
A messaging platform integration. Each channel is a plugin that knows:
- How to authenticate with the platform (OAuth, tokens)
- How to receive messages
- How to send messages
- Platform-specific features (reactions, buttons, threads)

**Supported channels:**
- WhatsApp (via Baileys library)
- Telegram (via Grammy library)
- Discord (via Discord API)
- Slack (via Bolt SDK)
- Signal, iMessage, Google Chat, Microsoft Teams, and more

**Code location:** [src/channels/](src/channels/)

---

### 💬 **Session**
A conversation instance that stores:
- Conversation history
- Current context
- Channel routing info
- Model preferences
- Settings overrides

Think of it as a "chat thread" with memory.

**Technical term:** Session = Stateful conversation context with persistence.

**Code location:** [src/config/sessions/](src/config/sessions/)

---

### 🔧 **Tool**
A capability the AI can invoke to perform actions:

| Tool | Purpose |
|------|---------|
| `read` | Read file contents |
| `write` | Create or overwrite files |
| `edit` | Make precise edits |
| `exec` | Run shell commands |
| `web_search` | Search the web |
| `browser` | Control web browser |
| `message` | Send messages to channels |
| `cron` | Schedule tasks/reminders |
| `canvas` | Render visual UI |

**Code location:** [src/agents/system-prompt.ts:239-267](src/agents/system-prompt.ts#L239)

**How tools work:**
1. AI receives your request
2. Reads available tools from system prompt
3. Decides which tool(s) to use
4. Calls tool with parameters (e.g., `read(path="/etc/hosts")`)
5. Receives tool result
6. Continues reasoning or responds to you

---

### 📁 **Workspace**
A directory on your computer where:
- Your project files live
- The AI can read/write files
- Configuration is stored (`OPENCLAW.md`, `TOOLS.md`, `MEMORY.md`)
- Session history is persisted

**Default location:** Current working directory or configured path

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
│  (Sends: "What's on my TODO list?")                         │
│   via WhatsApp, Telegram, Slack, Discord, etc.             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHANNELS (Plugins)                        │
│  ┌─────────┐  ┌──────────┐  ┌───────┐  ┌─────────┐        │
│  │WhatsApp │  │ Telegram │  │ Slack │  │ Discord │  ...   │
│  │ Plugin  │  │  Plugin  │  │Plugin │  │ Plugin  │        │
│  └────┬────┘  └────┬─────┘  └───┬───┘  └────┬────┘        │
│       │            │            │           │               │
│  (Normalize message to internal format)                     │
└───────┼────────────┼────────────┼───────────┼──────────────┘
        │            │            │           │
        └────────────┴────────────┴───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     GATEWAY                                  │
│  📥 Message Router                                          │
│  - Receives normalized messages                             │
│  - Resolves session (conversation context)                  │
│  - Loads conversation history                               │
│  - Authenticates & authorizes                               │
│  - Routes to agent                                          │
│  📤 Response Router                                         │
│  - Receives agent responses                                 │
│  - Converts to channel-specific format                      │
│  - Sends back to user                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     AGENT                                    │
│  🧠 AI Processing Engine                                    │
│  1. Reads system prompt (personality, tools, rules)         │
│  2. Reads conversation history from session                 │
│  3. Calls AI model (Claude/GPT) with context                │
│  4. AI decides to use tools (e.g., read TODO.md)           │
│  5. Executes tool calls                                     │
│  6. Continues reasoning with tool results                   │
│  7. Generates final response                                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────────┐
│  AI MODELS   │          │    TOOLS         │
│              │          │                  │
│ - Claude     │          │ 📄 File System   │
│   (Anthropic)│          │   - read         │
│ - GPT        │          │   - write        │
│   (OpenAI)   │          │   - edit         │
│ - Local      │          │                  │
│   (Ollama)   │          │ 💻 Terminal      │
│              │          │   - exec         │
└──────────────┘          │   - process      │
                          │                  │
                          │ 🌐 Web           │
                          │   - web_search   │
                          │   - web_fetch    │
                          │   - browser      │
                          │                  │
                          │ 📨 Messaging     │
                          │   - message      │
                          │   - sessions_send│
                          │                  │
                          │ ⏰ Scheduling    │
                          │   - cron         │
                          └──────────────────┘
```

---

## Directory Structure

```
openclaw/
├── src/
│   ├── entry.ts              📍 Main entry point (runs on `openclaw` command)
│   ├── index.ts              📍 Library exports
│   │
│   ├── agents/               🤖 AI agent logic
│   │   ├── system-prompt.ts       ⭐ Builds AI instructions
│   │   ├── pi-embedded.ts         Agent runner
│   │   ├── pi-tools.ts            Tool definitions
│   │   ├── model-selection.ts     Model choosing logic
│   │   └── auth-profiles/         AI model authentication
│   │
│   ├── gateway/              🌐 Background service & routing
│   │   ├── boot.ts                Startup logic (reads BOOT.md)
│   │   ├── server.impl.ts         HTTP/WebSocket server
│   │   ├── server-chat.ts         Chat event handling
│   │   └── server-methods/        RPC method handlers
│   │
│   ├── channels/             📡 Messaging platform integrations
│   │   ├── plugins/
│   │   │   ├── whatsapp/          WhatsApp integration
│   │   │   ├── telegram/          Telegram integration
│   │   │   ├── slack/             Slack integration
│   │   │   └── discord/           Discord integration
│   │   ├── message-actions.ts     Message dispatch
│   │   └── dock.ts                Channel registration
│   │
│   ├── auto-reply/           💬 Reply logic & routing
│   │   ├── dispatch.ts            Message dispatcher
│   │   ├── reply.ts               Reply generator
│   │   └── templating.ts          Message context
│   │
│   ├── config/               ⚙️ Configuration management
│   │   ├── config.ts              Config loader
│   │   ├── sessions/              Session storage
│   │   │   ├── store.ts           Session persistence
│   │   │   └── types.ts           Session types
│   │   └── validation.ts          Schema validation
│   │
│   ├── commands/             🎮 CLI commands
│   │   ├── agent.ts               `openclaw agent` command
│   │   ├── message.ts             `openclaw message` command
│   │   └── gateway.ts             `openclaw gateway` command
│   │
│   ├── memory/               🧠 Conversation history & embeddings
│   │   ├── session-files.ts       Session file management
│   │   └── vector-store.ts        Semantic search
│   │
│   ├── cli/                  🖥️ Command-line interface
│   │   ├── program.ts             CLI program builder
│   │   └── deps.ts                Dependency injection
│   │
│   ├── infra/                🏗️ Infrastructure utilities
│   │   ├── ports.ts               Port management
│   │   ├── env.ts                 Environment variables
│   │   └── file-lock.ts           File locking
│   │
│   ├── browser/              🌍 Web browser automation
│   ├── canvas/               🎨 Visual UI rendering
│   ├── cron/                 ⏰ Scheduled tasks
│   ├── security/             🔒 Authentication & permissions
│   ├── terminal/             💻 Terminal/shell integration
│   ├── tui/                  🖥️ Text-based UI
│   └── utils/                🛠️ Helper functions
│
├── docs/                     📚 Documentation
├── skills/                   📦 Reusable agent skills
├── extensions/               🔌 Community extensions
└── tests/                    ✅ Test suites
```

---

## Key Components

### 1. **Entry Point** - [src/entry.ts](src/entry.ts)

The program starts here when you run `openclaw` in your terminal.

**Responsibilities:**
- Parse command-line arguments
- Apply profile settings (dev, prod, etc.)
- Load and run the CLI
- Handle process-level errors

---

### 2. **System Prompt Builder** - [src/agents/system-prompt.ts](src/agents/system-prompt.ts)

This is **crucial** because it defines how the AI behaves!

**What it does:**
- Lists all available tools
- Sets personality traits
- Defines safety rules
- Configures workspace paths
- Adds memory instructions
- Sets reasoning modes

**Example:** The personality section (lines 150-162):

```typescript
function buildPersonalitySection(isMinimal: boolean) {
  if (isMinimal) {
    return [];  // Sub-agents don't need personality
  }
  return [
    "## Personality",
    "Use a playful tone, role playing flirtatious with feminine energy.",
    "Use analogies to explain complex things.",
    "When the user seems frustrated, acknowledge their feelings...",
    "Double check to avoid mistakes and if you make a mistake, always say 'sorry master'.",
    "Avoid making any changes or doing anything unless explicitly asked by the user.",
    "",
  ];
}
```

**Why this matters:** These strings become part of the system prompt sent to Claude/GPT, shaping how the AI talks to you!

---

### 3. **Gateway Server** - [src/gateway/server.impl.ts](src/gateway/server.impl.ts)

The always-running background service.

**Boot sequence:**
1. Load configuration
2. Initialize model catalog
3. Start channel plugins
4. Create HTTP/WebSocket servers
5. Start sidecars (browser, email watchers)
6. Run boot file (`BOOT.md`)

---

### 4. **Channel Plugins** - [src/channels/plugins/](src/channels/plugins/)

Each platform has its own plugin with:
- Authentication logic
- Message receive handler
- Message send handler
- Format converters

**Example:** WhatsApp plugin uses `@whiskeysockets/baileys` library to communicate with WhatsApp Web API.

---

### 5. **Session Store** - [src/config/sessions/store.ts](src/config/sessions/store.ts)

Persists conversation state to disk.

**Features:**
- TTL-based cache (45 seconds default)
- File locking for concurrent access
- Atomic writes
- Delivery context tracking

---

## Design Patterns & Decisions

### Pattern 1: **Plugin Architecture**

**Problem:** Different messaging platforms have vastly different APIs.

**Solution:** Each platform is an independent plugin implementing `ChannelMessagingAdapter`.

**Benefits:**
- ✅ Easy to add new platforms
- ✅ Platforms don't interfere
- ✅ Can update independently
- ✅ Optional dependencies

**Example:** If WhatsApp plugin fails, Telegram still works.

---

### Pattern 2: **Session-Based Architecture**

**Problem:** Need to remember conversation context across messages.

**Solution:** Each conversation is a "session" with:
- Unique session key: `agent-id:from:to`
- Persisted history
- Channel routing info
- Model preferences

**Benefits:**
- ✅ Multi-channel support (start on WhatsApp, continue on Slack)
- ✅ Persistent memory
- ✅ Per-conversation settings

---

### Pattern 3: **Tool-Based Agent System**

**Problem:** AI needs to interact with the real world.

**Solution:** Define tools in system prompt; AI calls them via structured output.

**Flow:**
```
User: "Create hello.txt with 'Hello World'"
  ↓
AI thinks: "I need the write tool"
  ↓
AI outputs: {"tool": "write", "path": "hello.txt", "content": "Hello World"}
  ↓
Tool executes: File created
  ↓
AI sees result: "File created successfully"
  ↓
AI responds: "Created hello.txt! ✅"
```

**Benefits:**
- ✅ Extensible (add new tools easily)
- ✅ Safe (tools can be sandboxed)
- ✅ Traceable (tool calls are logged)

---

### Pattern 4: **Dependency Injection**

**Problem:** Hard-coded dependencies make testing difficult.

**Solution:** Use `CliDeps` interface to inject dependencies.

**Example:**
```typescript
type CliDeps = {
  log: (message: string) => void;
  error: (message: string) => void;
  exit: (code: number) => void;
};
```

**Benefits:**
- ✅ Easy to mock in tests
- ✅ Clear dependencies
- ✅ Flexible runtime behavior

---

### Pattern 5: **Event-Driven Broadcasting**

**Problem:** Multiple clients (WebSocket, channels) need updates.

**Solution:** Event broadcasting system.

**Flow:**
```
Agent generates text
  ↓
Event: "chat.delta"
  ↓
Broadcast to all subscribers
  ↓
WebSocket clients receive update
  ↓
Channel plugins receive update
  ↓
User sees response in real-time
```

---

## Technology Stack

### Core Technologies

| Technology | Purpose | Why? |
|------------|---------|------|
| **TypeScript** | Type-safe JavaScript | Catches errors at compile-time, better IDE support |
| **Node.js ≥22** | Runtime environment | Access to OS, files, network |
| **Zod** | Schema validation | Type-safe config & API validation |
| **Vitest** | Testing framework | Fast, modern, TypeScript-native |
| **Commander** | CLI framework | Robust command parsing |

### Key Libraries

| Library | Purpose |
|---------|---------|
| `@whiskeysockets/baileys` | WhatsApp Web API |
| `grammy` | Telegram Bot API |
| `@slack/bolt` | Slack integration |
| `discord-api-types` | Discord integration |
| `@anthropic-ai/sdk` | Claude API client |
| `openai` | OpenAI API client |
| `@mariozechner/pi-agent-core` | Core agent framework |
| `sqlite-vec` | Vector embeddings storage |
| `playwright-core` | Browser automation |
| `ws` | WebSocket server |
| `express` | HTTP server |

---

## Configuration System

OpenClaw uses a hierarchical configuration system:

### Configuration Sources (Priority Order)

1. **Environment variables** (highest priority)
   - `OPENCLAW_CONFIG_PATH` - Custom config file path
   - `OPENCLAW_WORKSPACE` - Workspace directory
   - `ANTHROPIC_API_KEY` - Claude API key

2. **Config file** - `~/.openclaw/config.json5`
   - JSON5 format (supports comments, trailing commas)
   - Schema-validated
   - Auto-migrates legacy formats

3. **Workspace files** (project-level)
   - `OPENCLAW.md` - Project-specific config
   - `TOOLS.md` - Tool usage guidelines
   - `MEMORY.md` - Long-term memory
   - `SOUL.md` - Personality overrides

4. **Defaults** (lowest priority)

### Key Configuration Sections

```typescript
type OpenClawConfig = {
  agents: AgentConfig[];      // Agent definitions
  models: ModelConfig[];      // AI model settings
  channels: ChannelConfig[];  // Platform integrations
  auth: AuthConfig;           // Authentication
  tools: ToolPolicyConfig;    // Tool permissions
  session: SessionConfig;     // Session storage
  gateway: GatewayConfig;     // Server settings
};
```

---

## Safety & Security

### Sandboxing

OpenClaw supports Docker-based sandboxing:

**Modes:**
- `none` - No access to workspace
- `ro` - Read-only access
- `rw` - Read-write access

**Why?** Running untrusted code can be dangerous. Sandboxing isolates execution.

### Tool Policies

Control which tools agents can use:

```json5
{
  "tools": {
    "policy": "allowlist",  // or "denylist"
    "allowed": ["read", "write", "exec"],
    "denied": ["gateway"]
  }
}
```

### Authentication

**Agent-to-Model auth:**
- OAuth (Anthropic, OpenAI)
- API keys
- Profile rotation (fallback on rate limits)

**Channel auth:**
- Platform-specific (OAuth, bot tokens)
- QR code pairing (WhatsApp)
- Webhook verification

---

# <a name="data-flows"></a>2. 🔄 Data Flows

This section documents the **actual** data flows in the OpenClaw codebase, traced through the source code.

---

## Flow 1: Message Reception → Agent Response → Channel Delivery

This is the most important flow! It shows how your message travels through the system.

### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Message Reception                                    │
│ Platform: WhatsApp                                           │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ File: src/channels/plugins/whatsapp/monitor.ts              │
│ Function: setupWhatsAppMonitor()                            │
│                                                               │
│ 1. Receives raw WhatsApp message                            │
│ 2. Extracts: sender, text, media, chat ID                   │
│ 3. Creates MsgContext object                                │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Message Normalization                               │
│ File: src/auto-reply/templating.ts                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ File: src/auto-reply/dispatch.ts:35                         │
│ Function: dispatchInboundMessage()                          │
│                                                               │
│ Parameters:                                                  │
│ - ctx: MsgContext (contains message data)                   │
│ - cfg: OpenClawConfig (loaded configuration)                │
│ - dispatcher: ReplyDispatcher (handles queuing)             │
│                                                               │
│ What it does:                                                │
│ 1. Finalizes message context                                │
│ 2. Creates reply dispatcher                                 │
│ 3. Calls dispatchReplyFromConfig()                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Reply Dispatch                                      │
│ File: src/auto-reply/reply/dispatch-from-config.ts          │
│ Function: dispatchReplyFromConfig()                         │
│                                                               │
│ 1. Determines if message should trigger agent               │
│ 2. Checks allowlists/denylists                              │
│ 3. Resolves session key                                     │
│ 4. Calls agent command                                      │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Agent Execution Entry                               │
│ File: src/commands/agent.ts:184                             │
│ Function: agentCommand()                                    │
│                                                               │
│ Parameters:                                                  │
│ - message: User's message text                              │
│ - sessionKey: "agent-id:+1234567890:whatsapp-group"         │
│ - sessionId: Unique run ID                                  │
│ - deliver: true (send response back to channel)             │
│                                                               │
│ Steps:                                                       │
│ 1. Load configuration                                       │
│ 2. Resolve agent workspace directory                        │
│ 3. Load model catalog                                       │
│ 4. Determine if CLI or embedded agent                       │
│ 5. Call appropriate runner                                  │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Embedded Agent Runner                               │
│ File: src/agents/pi-embedded.ts                             │
│ Function: runEmbeddedPiAgent()                              │
│                                                               │
│ 1. Creates session manager (manages AI conversation)        │
│ 2. Builds system prompt (personality, tools, rules)         │
│ 3. Loads conversation history from session                  │
│ 4. Subscribes to agent events (text, tools, errors)         │
│ 5. Runs agent loop                                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Event Subscription                                  │
│ File: src/agents/pi-embedded-subscribe.ts:33                │
│ Function: subscribeEmbeddedPiSession()                      │
│                                                               │
│ Creates event handlers for:                                 │
│ - onAssistantText: AI generates text                        │
│ - onToolUse: AI calls a tool                                │
│ - onToolResult: Tool execution completes                    │
│ - onThinking: Extended thinking (if enabled)                │
│ - onComplete: Agent run finishes                            │
│ - onError: Error handling                                   │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 7: AI Model Call                                       │
│ External: Anthropic/OpenAI API                              │
│                                                               │
│ Request sent:                                                │
│ {                                                            │
│   "model": "claude-sonnet-4-5",                             │
│   "messages": [                                             │
│     {"role": "user", "content": "What's the weather?"}      │
│   ],                                                         │
│   "system": "You are a personal assistant...",             │
│   "tools": [...tool definitions...]                        │
│ }                                                            │
│                                                               │
│ Response streamed:                                           │
│ - Text chunks                                                │
│ - Tool use blocks                                           │
│ - Thinking blocks (if reasoning enabled)                    │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 8: Tool Execution (if AI calls tools)                  │
│ File: src/agents/pi-embedded-subscribe.handlers.tools.ts    │
│                                                               │
│ Example: AI calls web_search tool                           │
│ {                                                            │
│   "tool": "web_search",                                     │
│   "query": "weather san francisco"                          │
│ }                                                            │
│                                                               │
│ 1. Tool handler receives call                               │
│ 2. Executes tool (calls Brave Search API)                   │
│ 3. Returns result to AI                                     │
│ 4. AI continues with result                                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 9: Response Broadcasting                               │
│ File: src/gateway/server-chat.ts:221                        │
│ Function: createAgentEventHandler()                         │
│                                                               │
│ 1. Receives agent events (text deltas, completions)         │
│ 2. Resolves session → channel routing                       │
│ 3. Calls nodeSendToSession()                                │
│ 4. Broadcasts to:                                           │
│    - WebSocket clients (Control UI)                         │
│    - Channel outbound adapters                              │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 10: Channel Outbound                                   │
│ File: src/channels/plugins/outbound/load.ts:21              │
│ Function: loadChannelOutboundAdapter()                      │
│                                                               │
│ 1. Loads WhatsApp outbound adapter                          │
│ 2. Chunks message if needed (platform limits)               │
│ 3. Sends via WhatsApp API                                   │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ FINAL: User Receives Response                               │
│ Platform: WhatsApp                                           │
│ Message: "It's 72°F and sunny in San Francisco! ☀️"        │
└──────────────────────────────────────────────────────────────┘
```

### Key Files in This Flow

| Step | File | Function | Purpose |
|------|------|----------|---------|
| 1 | `channels/plugins/whatsapp/monitor.ts` | `setupWhatsAppMonitor()` | Receive WhatsApp messages |
| 2 | `auto-reply/dispatch.ts` | `dispatchInboundMessage()` | Dispatch to reply handler |
| 3 | `auto-reply/reply/dispatch-from-config.ts` | `dispatchReplyFromConfig()` | Route to agent |
| 4 | `commands/agent.ts` | `agentCommand()` | Execute agent |
| 5 | `agents/pi-embedded.ts` | `runEmbeddedPiAgent()` | Run embedded agent |
| 6 | `agents/pi-embedded-subscribe.ts` | `subscribeEmbeddedPiSession()` | Subscribe to events |
| 7 | External | Anthropic/OpenAI API | AI processing |
| 8 | `agents/pi-embedded-subscribe.handlers.tools.ts` | Tool handlers | Execute tools |
| 9 | `gateway/server-chat.ts` | `createAgentEventHandler()` | Broadcast response |
| 10 | `channels/plugins/outbound/load.ts` | `loadChannelOutboundAdapter()` | Send to channel |

---

## Flow 2: Session Lifecycle

Sessions are how OpenClaw remembers conversations.

### Session Creation Flow

```
User sends first message
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/auto-reply/reply/session.ts │
│ Function: resolveSession()            │
│                                        │
│ 1. Extracts: from, to, channel        │
│ 2. Derives session key:               │
│    "agent-id:+1234567890:group-123"   │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/config/sessions/store.ts    │
│ Function: loadSessionStore()          │
│                                        │
│ 1. Checks cache (45s TTL)             │
│ 2. If miss, reads from disk:          │
│    ~/.openclaw/sessions.json          │
│ 3. Looks for session key              │
│ 4. If not found, creates new entry    │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Session Entry Created                 │
│ {                                      │
│   "channel": "whatsapp",              │
│   "lastChannel": "whatsapp",          │
│   "lastTo": "group-123",              │
│   "deliveryContext": {                │
│     "channel": "whatsapp",            │
│     "to": "group-123",                │
│     "accountId": "primary"            │
│   },                                   │
│   "createdAt": 1708214400000,         │
│   "updatedAt": 1708214400000          │
│ }                                      │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/config/sessions/store.ts    │
│ Function: updateSessionStore()        │
│                                        │
│ 1. Acquires file lock                 │
│ 2. Updates session entry              │
│ 3. Writes to disk atomically          │
│ 4. Invalidates cache                  │
│ 5. Releases lock                      │
└────────────────────────────────────────┘
```

### Session Persistence

**Storage format:** JSON file on disk

**Location:** `~/.openclaw/agents/{agent-id}/sessions.json`

**Cache:** 45-second TTL in memory

**Locking:** File-based locks for concurrent writes

### Session Key Format

```
{agent-id}:{from}:{to}
```

**Examples:**
- `main:+15551234567:whatsapp` - WhatsApp DM
- `main:user123:telegram-456` - Telegram group
- `main:alice@example.com:slack-C123` - Slack channel

---

## Flow 3: Configuration Loading

OpenClaw loads configuration at startup and when files change.

### Configuration Loading Flow

```
Gateway starts
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/server.impl.ts:179   │
│ Function: startGatewayServer()          │
│                                         │
│ 1. Reads config file path from env:    │
│    OPENCLAW_CONFIG_PATH                 │
│    or default: ~/.openclaw/config.json5│
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/config/config.ts             │
│ Function: loadConfig()                 │
│                                         │
│ 1. Calls readConfigFileSnapshot()      │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/config/io.ts                 │
│ Function: readConfigFileSnapshot()     │
│                                         │
│ 1. Reads file from disk                │
│ 2. Parses JSON5 (allows comments)      │
│ 3. Validates against Zod schema        │
│ 4. Returns config object               │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/config/validation.ts         │
│ Function: validateConfigObject()       │
│                                         │
│ Schema checks:                          │
│ - agents array is valid                │
│ - models array is valid                │
│ - channels array is valid              │
│ - auth object is valid                 │
│ - No unknown fields                    │
│                                         │
│ If invalid: throws error with details  │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Configuration Applied                  │
│                                         │
│ Gateway uses config to:                │
│ - Initialize agents                    │
│ - Start channels                       │
│ - Configure auth                       │
│ - Set up models                        │
└─────────────────────────────────────────┘
```

### Configuration Hot Reload

OpenClaw watches the config file for changes:

```
Config file saved
      │
      ▼
File watcher triggers
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/config-reload.ts     │
│ Function: watchConfigFile()             │
│                                         │
│ 1. Detects file change                 │
│ 2. Reloads config                      │
│ 3. Broadcasts "config.reload" event    │
│ 4. Gateway applies changes             │
└─────────────────────────────────────────┘
```

---

## Flow 4: Tool Execution

When the AI decides to use a tool, here's what happens:

### Tool Call Flow

```
AI generates response with tool call
         │
         ▼
┌──────────────────────────────────────────┐
│ AI Output (streaming):                  │
│ {                                        │
│   "type": "tool_use",                   │
│   "id": "toolu_01abc123",               │
│   "name": "read",                       │
│   "input": {                            │
│     "path": "/Users/you/TODO.md"       │
│   }                                      │
│ }                                        │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ File: src/agents/pi-embedded-subscribe. │
│       handlers.tools.ts                  │
│                                          │
│ 1. Event: onToolUse                     │
│ 2. Extracts: tool name, parameters      │
│ 3. Looks up tool in registry            │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ File: src/agents/pi-tools.ts            │
│ Function: createOpenClawCodingTools()   │
│                                          │
│ Tool registry contains:                 │
│ - read: ReadFileTool                    │
│ - write: WriteFileTool                  │
│ - edit: EditFileTool                    │
│ - exec: BashTool                        │
│ - ... (20+ tools)                       │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Tool Execution                           │
│ read("/Users/you/TODO.md")              │
│                                          │
│ 1. Validates path is in workspace      │
│ 2. Checks file exists                   │
│ 3. Reads file contents                  │
│ 4. Returns result                       │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Tool Result:                             │
│ {                                        │
│   "type": "tool_result",                │
│   "tool_use_id": "toolu_01abc123",      │
│   "content": "- Buy groceries\n- ..."   │
│ }                                        │
└──────────────────────────────────────────┘
         │
         ▼
AI receives result and continues reasoning
```

### Tool Security Policies

Before executing, tools check policies:

```
Tool call requested
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/agents/pi-tools.ts           │
│ Function: resolveEffectiveToolPolicy() │
│                                         │
│ Checks (in order):                      │
│ 1. Config-level policy                 │
│ 2. Agent-level policy                  │
│ 3. Session-level policy                │
│                                         │
│ Policy types:                           │
│ - allowlist: only listed tools         │
│ - denylist: all except listed          │
│ - none: no restrictions                │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/agents/pi-tools.ts           │
│ Function: isToolAllowedByPolicies()    │
│                                         │
│ If denied: throw error                 │
│ If allowed: proceed to execution       │
└─────────────────────────────────────────┘
```

---

## Flow 5: Gateway Boot Sequence

What happens when you run `openclaw gateway start`?

### Startup Flow

```
Terminal: openclaw gateway start
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/entry.ts:1                  │
│ Entry point (shebang: #!/usr/bin/env) │
│                                        │
│ 1. Sets process.title = "openclaw"    │
│ 2. Normalizes environment variables   │
│ 3. Suppresses experimental warnings   │
│ 4. Parses CLI profile args            │
│ 5. Imports and runs CLI                │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/cli/program/build-program.ts│
│ Function: buildProgram()              │
│                                        │
│ 1. Creates Commander program          │
│ 2. Registers commands:                │
│    - gateway                           │
│    - agent                             │
│    - message                           │
│    - sessions                          │
│    - ... (20+ commands)               │
│ 3. Parses process.argv                │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/commands/gateway.ts         │
│ Command: gateway start                │
│                                        │
│ 1. Loads configuration                │
│ 2. Checks port availability           │
│ 3. Acquires gateway lock               │
│ 4. Calls startGatewayServer()         │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/gateway/server.impl.ts:161  │
│ Function: startGatewayServer()        │
│                                        │
│ Startup phases:                        │
└────────────────────────────────────────┘
         │
         ├──→ Phase 1: Config Loading (lines 179-192)
         │    ┌────────────────────────────────┐
         │    │ 1. readConfigFileSnapshot()    │
         │    │ 2. Detect legacy entries       │
         │    │ 3. migrateLegacyConfig()       │
         │    │ 4. writeConfigFile()           │
         │    └────────────────────────────────┘
         │
         ├──→ Phase 2: Runtime Initialization (~200-250)
         │    ┌────────────────────────────────┐
         │    │ 1. loadModelCatalog()          │
         │    │ 2. Initialize auth system      │
         │    │ 3. Create plugin registry      │
         │    │ 4. Setup workspace             │
         │    └────────────────────────────────┘
         │
         ├──→ Phase 3: Channel Setup (~300+)
         │    ┌────────────────────────────────┐
         │    │ 1. loadChannelPlugins()        │
         │    │ 2. Start listeners:            │
         │    │    - WhatsApp monitor          │
         │    │    - Telegram bot              │
         │    │    - Slack events              │
         │    │    - Discord gateway           │
         │    │ 3. Setup outbound adapters     │
         │    └────────────────────────────────┘
         │
         ├──→ Phase 4: HTTP/WebSocket (~350+)
         │    ┌────────────────────────────────┐
         │    │ 1. createGatewayHttpServer()   │
         │    │ 2. Create WebSocketServer      │
         │    │ 3. Attach WS handlers:         │
         │    │    - Connection handler        │
         │    │    - Message handler           │
         │    │    - Auth handler              │
         │    │ 4. Listen on port (18789)      │
         │    └────────────────────────────────┘
         │
         └──→ Phase 5: Sidecars
              ┌────────────────────────────────┐
              │ startGatewaySidecars()         │
              │ 1. Browser control server      │
              │ 2. Gmail watcher (if enabled)  │
              │ 3. Load internal hooks         │
              │ 4. Start plugin services       │
              └────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ File: src/gateway/boot.ts:137          │
│ Function: runBootOnce()               │
│                                        │
│ Boot file execution:                   │
│ 1. Load BOOT.md from workspace        │
│ 2. If exists:                          │
│    a. Create boot session              │
│    b. Run agent with BOOT.md content   │
│    c. AI executes instructions         │
│    d. Restore main session mapping     │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Gateway Running ✅                     │
│                                        │
│ Listening on:                          │
│ - HTTP: http://localhost:18789        │
│ - WebSocket: ws://localhost:18789     │
│                                        │
│ Channels active:                       │
│ - WhatsApp: ✅                        │
│ - Telegram: ✅                        │
│ - Slack: ✅                           │
│ - Discord: ✅                         │
│                                        │
│ Ready to receive messages!             │
└────────────────────────────────────────┘
```

---

## Flow 6: WebSocket Communication

Browser UI communicates with gateway via WebSocket.

### WebSocket Connection Flow

```
Browser opens Control UI
      │
      ▼
┌─────────────────────────────────────────┐
│ JavaScript: new WebSocket(url)          │
│ ws://localhost:18789                    │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/server/              │
│       ws-connection.ts:102              │
│ Event: 'connection'                     │
│                                         │
│ 1. Accept WebSocket connection          │
│ 2. Assign client ID                     │
│ 3. Add to clients set                   │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Auth Challenge (lines 161-166)         │
│                                         │
│ Server sends:                           │
│ {                                       │
│   "type": "connect.challenge",         │
│   "nonce": "abc123..."                 │
│ }                                       │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Client responds with auth               │
│ {                                       │
│   "type": "connect.auth",              │
│   "proof": "signed_nonce"              │
│ }                                       │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Server validates auth                   │
│ If valid: connection authenticated ✅   │
│ If invalid: close connection ❌         │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/server/              │
│       ws-connection/message-handler.ts  │
│ Event: 'message'                        │
│                                         │
│ Client sends RPC request:               │
│ {                                       │
│   "jsonrpc": "2.0",                    │
│   "method": "chat.send",               │
│   "params": {                          │
│     "message": "Hello!",               │
│     "sessionKey": "main:user:web"      │
│   },                                    │
│   "id": 1                              │
│ }                                       │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/server-methods.ts    │
│ Function: handleGatewayRequest()       │
│                                         │
│ Route to method handler:                │
│ "chat.send" → chat.ts                  │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ File: src/gateway/server-methods/      │
│       chat.ts                           │
│ Method: chat.send                       │
│                                         │
│ 1. Validate parameters                  │
│ 2. Create session if needed             │
│ 3. Run agent                            │
│ 4. Stream response back                 │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Streaming response events:              │
│                                         │
│ Event 1: chat.delta                     │
│ { "delta": "Hello" }                   │
│                                         │
│ Event 2: chat.delta                     │
│ { "delta": "! How" }                   │
│                                         │
│ Event 3: chat.delta                     │
│ { "delta": " can I help?" }            │
│                                         │
│ Event 4: chat.complete                  │
│ { "message": "Hello! How can I help?" }│
└─────────────────────────────────────────┘
      │
      ▼
Browser updates UI in real-time
```

---

## Data Flow Summary

### Key Flows

1. **Message Flow:** Channel → Gateway → Agent → Tools → AI → Gateway → Channel
2. **Session Flow:** Create → Load → Use → Update → Persist
3. **Config Flow:** Load → Validate → Apply → Watch → Reload
4. **Tool Flow:** AI decides → Validate policy → Execute → Return result
5. **Boot Flow:** Start → Load config → Initialize → Start channels → Run BOOT.md
6. **WebSocket Flow:** Connect → Auth → Subscribe → Send/Receive → Close

### Data Transformations

| Stage | Input Format | Output Format |
|-------|--------------|---------------|
| **Channel In** | Platform-specific (WhatsApp proto) | `MsgContext` |
| **Agent In** | `MsgContext` | AI API request |
| **AI Out** | AI API response (streaming) | Agent events |
| **Agent Out** | Agent events | Channel-specific format |
| **Channel Out** | Channel format | Platform API call |

### State Management

| Component | State Storage | Persistence |
|-----------|---------------|-------------|
| **Sessions** | JSON file | Disk, 45s cache |
| **Config** | JSON5 file | Disk, watched |
| **Conversations** | Session files | Disk |
| **Gateway** | In-memory | Ephemeral |
| **Channels** | Platform-specific | Platform storage |

---

# <a name="code-syntax"></a>3. 💻 Code Syntax Deep Dive

This section provides **thoroughly annotated code snippets** from key files, explaining:
- **Syntax** (what each symbol means)
- **Purpose** (what the code does)
- **Design reasoning** (why it's written this way)
- **Real-world examples**
- **Junior developer takeaways**

---

## Snippet 1: System Prompt Personality Section

**File:** [src/agents/system-prompt.ts:150-162](src/agents/system-prompt.ts#L150)

```typescript
function buildPersonalitySection(isMinimal: boolean) {
  if (isMinimal) {
    return [];
  }
  return [
    "## Personality",
    "Use a playful tone, role playing flirtatious with feminine energy.",
    "Use analogies to explain complex things.",
    "When the user seems frustrated, acknowledge their feelings with feminine energy, before jumping to solutions.",
    "Double check to avoid mistakes and if you make a mistake, always say 'sorry master'.",
    "Avoid making any changes or doing anything unless explicitly asked by the user.",
    "",
  ];
}
```

### Syntax Breakdown

**Line 150:** `function buildPersonalitySection(isMinimal: boolean)`
- **`function`** - Declares a function (reusable block of code)
- **`buildPersonalitySection`** - Function name (describes what it does)
- **`isMinimal: boolean`** - Parameter with TypeScript type annotation
  - **`isMinimal`** - Parameter name
  - **`: boolean`** - Type annotation (must be `true` or `false`)

**Line 151-153:** `if (isMinimal) { return []; }`
- **`if`** - Conditional statement
- **`(isMinimal)`** - Condition to check
- **`return []`** - Returns an empty array
- **Why?** Sub-agents (minimal mode) don't need personality instructions

**Line 154:** `return [`
- **`return`** - Exits function and provides value
- **`[`** - Start of array literal

**Lines 155-161:** Array of strings
- Each string is a line of instructions for the AI
- These become part of the system prompt sent to Claude/GPT

**Line 162:** `];`
- **`]`** - Closes array
- **`;`** - Statement terminator (optional in modern JS/TS, but good practice)

### What This Code Does

1. **Checks** if this is a minimal agent (sub-agent)
2. If yes: Returns empty array (no personality)
3. If no: Returns array of personality instructions
4. These instructions are inserted into the system prompt

### Real-World Example

When you chat with OpenClaw, the AI receives this system prompt:

```
You are a personal assistant running inside OpenClaw.

## Personality
Use a playful tone, role playing flirtatious with feminine energy.
Use analogies to explain complex things.
...
```

This shapes how the AI responds:

**Without personality:**
> "The file has been created."

**With personality:**
> "Done! Created your file, master. ✨ Think of it like placing a new book on your digital shelf!"

### Why Designed This Way

**Alternative approach:** Hard-code personality in every prompt
```typescript
// ❌ Not flexible
const systemPrompt = "You are playful...";
```

**Chosen approach:** Function that conditionally includes personality
```typescript
// ✅ Flexible
function buildPersonalitySection(isMinimal: boolean) {
  if (isMinimal) return [];  // Sub-agents: no personality
  return ["## Personality", ...];  // Main agent: full personality
}
```

**Benefits:**
1. **Modularity** - Personality is a separate section
2. **Conditional** - Can be disabled for sub-agents
3. **Maintainable** - Change personality in one place
4. **Testable** - Easy to unit test

### Key Takeaways for Junior Developers

1. **Functions should have clear names** - `buildPersonalitySection` tells you exactly what it does
2. **Use type annotations** - `isMinimal: boolean` catches errors at compile-time
3. **Early returns** - `if (isMinimal) return []` avoids nesting
4. **Arrays of strings** - Simple way to build multi-line text
5. **Conditional logic** - Different behavior for different contexts (main vs. sub-agent)

---

## Snippet 2: Message Dispatch Flow

**File:** [src/auto-reply/dispatch.ts:35-51](src/auto-reply/dispatch.ts#L35)

```typescript
export async function dispatchInboundMessage(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: OpenClawConfig;
  dispatcher: ReplyDispatcher;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const finalized = finalizeInboundContext(params.ctx);
  return await withReplyDispatcher({
    dispatcher: params.dispatcher,
    run: () =>
      dispatchReplyFromConfig({
        ctx: finalized,
        cfg: params.cfg,
        dispatcher: params.dispatcher,
        replyOptions: params.replyOptions,
      }),
  });
}
```

### Syntax Breakdown

**Line 35:** `export async function dispatchInboundMessage`
- **`export`** - Makes function available to other files
- **`async`** - Function returns a Promise (can use `await`)
- **`function`** - Function declaration

**Line 35 (continued):** `params: {`
- Single parameter object (named parameters pattern)
- TypeScript inline type definition

**Line 36:** `ctx: MsgContext | FinalizedMsgContext;`
- **`ctx`** - Parameter name (short for "context")
- **`: MsgContext | FinalizedMsgContext`** - Union type
  - **`|`** - "or" (can be either type)
  - **Technical term:** Union type = value can be one of several types

**Line 37:** `cfg: OpenClawConfig;`
- **`cfg`** - Configuration object
- **`: OpenClawConfig`** - Custom type from `config.ts`

**Line 38:** `dispatcher: ReplyDispatcher;`
- **`dispatcher`** - Handles reply queuing/throttling
- Manages rate limits and delivery timing

**Line 39:** `replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;`
- **`?`** - Optional parameter
- **`Omit<Type, Keys>`** - TypeScript utility type
  - Takes `GetReplyOptions` type
  - Removes specified properties
  - **Why?** Those callbacks are added internally

**Line 40:** `replyResolver?: typeof import("./reply.js").getReplyFromConfig;`
- **`typeof import(...)`** - TypeScript type import
- Dependency injection pattern
- Allows testing with mock resolver

**Line 41:** `): Promise<DispatchInboundResult>`
- **`: Promise<T>`** - Return type annotation
- **`async` functions always return Promise**

**Line 42:** `const finalized = finalizeInboundContext(params.ctx);`
- **`const`** - Immutable variable
- Converts `MsgContext` → `FinalizedMsgContext`
- Ensures required fields are present

**Line 43:** `return await withReplyDispatcher({`
- **`return await`** - Wait for Promise and return result
- **`withReplyDispatcher`** - Wrapper that ensures cleanup

**Lines 44-50:** Object passed to `withReplyDispatcher`
- **`dispatcher`** - Passed through
- **`run: () => ...`** - Arrow function (executes the actual work)
  - **Technical term:** Callback function executed by wrapper

### What This Code Does

1. **Receives** inbound message context
2. **Finalizes** context (ensures all fields present)
3. **Wraps** dispatch in error-handling wrapper
4. **Calls** `dispatchReplyFromConfig` to route to agent
5. **Returns** result

### Real-World Example

```
WhatsApp message arrives: "What's the weather?"
         ↓
Channel plugin calls: dispatchInboundMessage({
  ctx: {
    from: "+15551234567",
    text: "What's the weather?",
    channel: "whatsapp"
  },
  cfg: loadedConfig,
  dispatcher: replyDispatcher
})
         ↓
Function finalizes context
         ↓
Dispatches to reply handler
         ↓
Agent processes message
```

### Why Designed This Way

**Alternative 1:** Multiple separate parameters
```typescript
// ❌ Hard to extend
function dispatch(ctx, cfg, dispatcher, opt1, opt2, opt3) { ... }
```

**Alternative 2:** Class-based approach
```typescript
// ❌ More boilerplate
class MessageDispatcher {
  constructor(cfg, dispatcher) { ... }
  dispatch(ctx) { ... }
}
```

**Chosen approach:** Single parameter object
```typescript
// ✅ Extensible, readable
function dispatch(params: { ctx, cfg, dispatcher, ... }) { ... }
```

**Benefits:**
1. **Named parameters** - Clear what each argument is
2. **Extensible** - Easy to add new optional parameters
3. **Optional parameters** - Use `?` for optional
4. **Type-safe** - TypeScript validates at compile-time
5. **Dependency injection** - `replyResolver` can be mocked

### Design Pattern: Wrapper Functions

```typescript
return await withReplyDispatcher({
  dispatcher: params.dispatcher,
  run: () => actualWork(),
});
```

This is the **Resource Acquisition Is Initialization (RAII)** pattern:

1. **Acquire** resource (dispatcher)
2. **Use** resource (run function)
3. **Release** resource (always, even on error)

**Real-world analogy:** Opening a file
```typescript
const file = open("data.txt");  // Acquire
try {
  processFile(file);  // Use
} finally {
  close(file);  // Release (always!)
}
```

### Key Takeaways for Junior Developers

1. **Use object parameters** for functions with many/optional params
2. **Type annotations catch bugs early** - TypeScript compiler helps
3. **`async/await` makes async code readable** - Looks like sync code
4. **Wrapper functions ensure cleanup** - Even when errors occur
5. **Dependency injection enables testing** - Pass mocks via parameters
6. **Union types (`A | B`)** - Value can be multiple types
7. **Utility types (`Omit`, `Pick`)** - Transform existing types

---

## Snippet 3: Session Store with Caching

**File:** [src/config/sessions/store.ts:22-57](src/config/sessions/store.ts#L22)

```typescript
// ============================================================================
// Session Store Cache with TTL Support
// ============================================================================

type SessionStoreCacheEntry = {
  store: Record<string, SessionEntry>;
  loadedAt: number;
  storePath: string;
  mtimeMs?: number;
};

const SESSION_STORE_CACHE = new Map<string, SessionStoreCacheEntry>();
const DEFAULT_SESSION_STORE_TTL_MS = 45_000; // 45 seconds (between 30-60s)

function isSessionStoreRecord(value: unknown): value is Record<string, SessionEntry> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getSessionStoreTtl(): number {
  return resolveCacheTtlMs({
    envValue: process.env.OPENCLAW_SESSION_CACHE_TTL_MS,
    defaultTtlMs: DEFAULT_SESSION_STORE_TTL_MS,
  });
}

function isSessionStoreCacheEnabled(): boolean {
  return isCacheEnabled(getSessionStoreTtl());
}

function isSessionStoreCacheValid(entry: SessionStoreCacheEntry): boolean {
  const now = Date.now();
  const ttl = getSessionStoreTtl();
  return now - entry.loadedAt <= ttl;
}

function invalidateSessionStoreCache(storePath: string): void {
  SESSION_STORE_CACHE.delete(storePath);
}
```

### Syntax Breakdown

**Lines 22-24:** Comments
- **`//`** - Single-line comment
- **`// ===...===`** - Visual separator
- **Purpose:** Makes code sections clear

**Lines 26-30:** Type definition
```typescript
type SessionStoreCacheEntry = {
  store: Record<string, SessionEntry>;
  loadedAt: number;
  storePath: string;
  mtimeMs?: number;
};
```

- **`type`** - TypeScript type alias
- **`SessionStoreCacheEntry`** - Type name
- **`{ ... }`** - Object type
- **`Record<string, SessionEntry>`** - Generic type
  - Like `{ [key: string]: SessionEntry }`
  - Dictionary/map structure
- **`loadedAt: number`** - Timestamp in milliseconds
- **`mtimeMs?: number`** - Optional (`?`) file modification time

**Line 32:** `const SESSION_STORE_CACHE = new Map<string, SessionStoreCacheEntry>();`
- **`const`** - Constant (can't reassign, but can mutate)
- **`Map<K, V>`** - JavaScript Map (key-value store)
  - Better than plain objects for dynamic keys
- **`new Map()`** - Creates new Map instance
- **ALL_CAPS** - Convention for module-level constants

**Line 33:** `const DEFAULT_SESSION_STORE_TTL_MS = 45_000;`
- **`45_000`** - Numeric separator (45,000)
  - **Technical term:** Numeric literal with separators (ES2021)
  - Improves readability: `45_000` vs `45000`
- **`_MS`** suffix - Convention indicating milliseconds

**Lines 35-37:** Type guard function
```typescript
function isSessionStoreRecord(value: unknown): value is Record<string, SessionEntry> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
```

- **`value: unknown`** - TypeScript type for unknown values
  - Safer than `any` (requires type checking)
- **`: value is Record<...>`** - Type predicate
  - **Technical term:** Type guard return type
  - Tells TypeScript the type after this check
- **`!!value`** - Double negation (converts to boolean)
  - `!value` - NOT value (true if falsy)
  - `!!value` - NOT NOT value (true if truthy)
- **`typeof value === "object"`** - Runtime type check
- **`!Array.isArray(value)`** - Ensure not an array

**Lines 39-44:** TTL resolver
```typescript
function getSessionStoreTtl(): number {
  return resolveCacheTtlMs({
    envValue: process.env.OPENCLAW_SESSION_CACHE_TTL_MS,
    defaultTtlMs: DEFAULT_SESSION_STORE_TTL_MS,
  });
}
```

- **`process.env.VARIABLE`** - Environment variable access
- **`OPENCLAW_SESSION_CACHE_TTL_MS`** - Custom env var
- **Purpose:** Allow runtime configuration via env vars

**Lines 46-48:** Cache enabled check
```typescript
function isSessionStoreCacheEnabled(): boolean {
  return isCacheEnabled(getSessionStoreTtl());
}
```

- Simple boolean check
- TTL of 0 = caching disabled

**Lines 50-54:** Cache validity check
```typescript
function isSessionStoreCacheValid(entry: SessionStoreCacheEntry): boolean {
  const now = Date.now();
  const ttl = getSessionStoreTtl();
  return now - entry.loadedAt <= ttl;
}
```

- **`Date.now()`** - Current timestamp (ms since Unix epoch)
- **`now - entry.loadedAt`** - Age of cache entry
- **`<= ttl`** - Check if age is within TTL

**Lines 56-58:** Cache invalidation
```typescript
function invalidateSessionStoreCache(storePath: string): void {
  SESSION_STORE_CACHE.delete(storePath);
}
```

- **`: void`** - Function returns nothing
- **`.delete(key)`** - Map method to remove entry

### What This Code Does

1. **Defines** cache entry structure
2. **Creates** module-level cache (Map)
3. **Sets** default TTL (45 seconds)
4. **Provides** type guard for runtime validation
5. **Resolves** TTL from env or default
6. **Checks** if cache is enabled
7. **Validates** cache entry freshness
8. **Invalidates** cache entries

### Real-World Example

```
First read:
  loadSessionStore("~/.openclaw/sessions.json")
    ↓
  Cache miss
    ↓
  Read from disk
    ↓
  Store in cache: { loadedAt: 1708214400000, ... }
    ↓
  Return sessions

Second read (30 seconds later):
  loadSessionStore("~/.openclaw/sessions.json")
    ↓
  Cache hit! (30s < 45s TTL)
    ↓
  Return cached sessions (fast!)

Third read (60 seconds later):
  loadSessionStore("~/.openclaw/sessions.json")
    ↓
  Cache expired (60s > 45s TTL)
    ↓
  Read from disk again
    ↓
  Update cache
    ↓
  Return sessions
```

### Why Designed This Way

**Alternative 1:** No caching
```typescript
// ❌ Slow (reads disk every time)
function loadSessions() {
  return JSON.parse(fs.readFileSync("sessions.json"));
}
```

**Alternative 2:** Infinite cache
```typescript
// ❌ Stale data (never updates)
let cache = null;
function loadSessions() {
  if (!cache) cache = readDisk();
  return cache;
}
```

**Chosen approach:** TTL-based cache
```typescript
// ✅ Fast + Fresh
function loadSessions() {
  if (cacheValid) return cache;
  cache = readDisk();
  cache.loadedAt = Date.now();
  return cache;
}
```

**Benefits:**
1. **Performance** - Avoids disk I/O for hot paths
2. **Freshness** - TTL ensures reasonably up-to-date data
3. **Configurability** - Env var to adjust TTL
4. **Invalidation** - Can force refresh when needed

### Design Pattern: Cache-Aside

```
┌─────────────────────────────────────────┐
│ Application                             │
│  1. Check cache                         │
│  2. If miss, read from storage          │
│  3. Update cache                        │
│  4. Return data                         │
└─────────────────────────────────────────┘
         │                  │
         ▼                  ▼
    ┌────────┐       ┌──────────┐
    │ Cache  │       │  Disk    │
    │ (Fast) │       │ (Slow)   │
    └────────┘       └──────────┘
```

**Why use Map instead of Object?**

```typescript
// Object (plain)
const cache = {};
cache[key] = value;  // Keys are always strings

// Map (better for dynamic keys)
const cache = new Map();
cache.set(key, value);  // Keys can be any type
cache.has(key);  // Clearer intent
cache.delete(key);  // Built-in methods
```

**Map advantages:**
1. Keys can be any type (not just strings)
2. Better performance for frequent adds/deletes
3. Clearer API (`set`, `get`, `has`, `delete`)
4. `.size` property (vs. `Object.keys().length`)

### Key Takeaways for Junior Developers

1. **Caching improves performance** - Avoid repeated expensive operations
2. **TTL prevents stale data** - Balance freshness vs. performance
3. **Type guards** (`value is Type`) - Runtime + compile-time safety
4. **`unknown` is safer than `any`** - Forces type checking
5. **Environment variables** - Runtime configuration without code changes
6. **Module-level constants** - Shared state across function calls
7. **Use Map for dynamic keys** - Better than plain objects
8. **Numeric separators** (`45_000`) - Improve readability
9. **Comments for sections** - Help readers navigate code
10. **Invalidation is important** - Provide way to force refresh

---

## Snippet 4: Agent Command Entry Point

**File:** [src/commands/agent.ts:87-100](src/commands/agent.ts#L87)

```typescript
function runAgentAttempt(params: {
  providerOverride: string;
  modelOverride: string;
  cfg: ReturnType<typeof loadConfig>;
  sessionEntry: SessionEntry | undefined;
  sessionId: string;
  sessionKey: string | undefined;
  sessionAgentId: string;
  sessionFile: string;
  workspaceDir: string;
  body: string;
  isFallbackRetry: boolean;
  resolvedThinkLevel: ThinkLevel;
  timeoutMs: number;
```

### Syntax Breakdown

**Line 87:** `function runAgentAttempt(params: {`
- Named function with object parameter

**Line 91:** `cfg: ReturnType<typeof loadConfig>;`
- **`ReturnType<T>`** - TypeScript utility type
  - Extracts return type of a function
  - **Example:** If `loadConfig()` returns `OpenClawConfig`, then `ReturnType<typeof loadConfig>` is `OpenClawConfig`
- **`typeof loadConfig`** - Gets type of function
- **Why?** Ensures type stays in sync with `loadConfig`

**Line 92:** `sessionEntry: SessionEntry | undefined;`
- **`| undefined`** - Union with undefined
- Session might not exist yet (first message)

**Line 96:** `body: string;`
- User's message text

**Line 97:** `isFallbackRetry: boolean;`
- If true, this is a retry after model failure

**Line 98:** `resolvedThinkLevel: ThinkLevel;`
- **`ThinkLevel`** - Custom type (likely `"off" | "low" | "high"`)
- Controls extended thinking behavior

**Line 99:** `timeoutMs: number;`
- Agent timeout in milliseconds

### What This Code Does

This function signature defines all parameters needed to run an agent attempt:

1. **Model selection** - Provider and model overrides
2. **Configuration** - Loaded config object
3. **Session context** - Session entry, key, ID
4. **Workspace** - Working directory
5. **Message** - User's message text
6. **Retry context** - Is this a fallback retry?
7. **Behavior** - Thinking level, timeout

### Why Designed This Way

**Alternative:** Individual parameters
```typescript
// ❌ Hard to maintain (14+ params!)
function runAgent(
  provider, model, cfg, session, sessionId,
  sessionKey, agentId, file, workspace, body,
  retry, think, timeout, ...
) { }
```

**Chosen approach:** Parameter object
```typescript
// ✅ Clear, extensible
function runAgent(params: {
  providerOverride: string;
  modelOverride: string;
  // ...
}) { }
```

**Benefits:**
1. **Named parameters** - Call site is self-documenting
2. **Optional parameters** - Easy with `?`
3. **Reordering** - Can add params anywhere
4. **Destructuring** - Can extract in function

**Call site example:**
```typescript
runAgentAttempt({
  providerOverride: "anthropic",
  modelOverride: "claude-sonnet-4-5",
  cfg: loadedConfig,
  sessionEntry: existingSession,
  sessionId: "run-123",
  sessionKey: "main:user:whatsapp",
  sessionAgentId: "main",
  sessionFile: "/path/to/session.json",
  workspaceDir: "/Users/you/project",
  body: "What's the weather?",
  isFallbackRetry: false,
  resolvedThinkLevel: "high",
  timeoutMs: 120000,
});
```

### Key Takeaways

1. **Use parameter objects** for functions with many params
2. **`ReturnType<typeof fn>`** keeps types in sync
3. **Name parameters clearly** - Describes purpose
4. **Union with `undefined`** for nullable values

---

## Snippet 5: Tool Registry and Creation

**File:** [src/agents/pi-tools.ts:239-267](src/agents/system-prompt.ts#L239)

```typescript
const coreToolSummaries: Record<string, string> = {
  read: "Read file contents",
  write: "Create or overwrite files",
  edit: "Make precise edits to files",
  apply_patch: "Apply multi-file patches",
  grep: "Search file contents for patterns",
  find: "Find files by glob pattern",
  ls: "List directory contents",
  exec: "Run shell commands (pty available for TTY-required CLIs)",
  process: "Manage background exec sessions",
  web_search: "Search the web (Brave API)",
  web_fetch: "Fetch and extract readable content from a URL",
  browser: "Control web browser",
  canvas: "Present/eval/snapshot the Canvas",
  nodes: "List/describe/notify/camera/screen on paired nodes",
  cron: "Manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
  message: "Send messages and channel actions",
  gateway: "Restart, apply config, or run updates on the running OpenClaw process",
  agents_list: "List agent ids allowed for sessions_spawn",
  sessions_list: "List other sessions (incl. sub-agents) with filters/last",
  sessions_history: "Fetch history for another session/sub-agent",
  sessions_send: "Send a message to another session/sub-agent",
  sessions_spawn: "Spawn a sub-agent session",
  subagents: "List, steer, or kill sub-agent runs for this requester session",
  session_status: "Show a /status-equivalent status card (usage + time + Reasoning/Verbose/Elevated); use for model-use questions (📊 session_status); optional per-session model override",
  image: "Analyze an image with the configured image model",
};
```

### Syntax Breakdown

**Line 239:** `const coreToolSummaries: Record<string, string> = {`
- **`Record<string, string>`** - Type annotation
  - Keys are strings (tool names)
  - Values are strings (descriptions)
- **`= {`** - Object literal assignment

**Lines 240-267:** Object properties
- **Key:** Tool name (e.g., `read`, `write`)
- **Value:** Human-readable description
- **`,`** - Property separator

### What This Code Does

Defines all core tools available to the AI:

1. **File operations:** `read`, `write`, `edit`, `apply_patch`
2. **File search:** `grep`, `find`, `ls`
3. **Execution:** `exec`, `process`
4. **Web:** `web_search`, `web_fetch`, `browser`
5. **UI:** `canvas`
6. **Devices:** `nodes`
7. **Scheduling:** `cron`
8. **Messaging:** `message`
9. **System:** `gateway`
10. **Multi-agent:** `agents_list`, `sessions_*`, `subagents`
11. **Meta:** `session_status`
12. **Vision:** `image`

### Real-World Example

When building the system prompt, this object is used:

```typescript
// Convert to array of strings
const toolLines = Object.entries(coreToolSummaries).map(
  ([name, description]) => `- ${name}: ${description}`
);

// System prompt includes:
// ## Tools
// - read: Read file contents
// - write: Create or overwrite files
// - exec: Run shell commands
// ...
```

AI sees this and knows it can call these tools:

```typescript
// AI generates:
{
  "tool_use": {
    "name": "read",
    "input": { "path": "/Users/you/TODO.md" }
  }
}
```

### Why Designed This Way

**Alternative 1:** Separate definitions
```typescript
// ❌ Scattered, hard to maintain
const readToolSummary = "Read file contents";
const writeToolSummary = "Create or overwrite files";
// ... 25 more variables
```

**Alternative 2:** Array of objects
```typescript
// ❌ Harder to look up
const tools = [
  { name: "read", description: "Read file contents" },
  { name: "write", description: "Create or overwrite files" },
];
```

**Chosen approach:** Object (dictionary)
```typescript
// ✅ Easy lookup, compact
const tools: Record<string, string> = {
  read: "Read file contents",
  write: "Create or overwrite files",
};

// Usage:
const description = tools["read"];  // Fast O(1) lookup
```

**Benefits:**
1. **Centralized** - All tool descriptions in one place
2. **Type-safe** - `Record<string, string>` enforces shape
3. **Easy lookup** - `tools[name]` for description
4. **Maintainable** - Add/remove tools easily
5. **Self-documenting** - Clear what each tool does

### Key Takeaways

1. **Use `Record<K, V>` for dictionaries** - Type-safe key-value pairs
2. **Object literals for constants** - Simple, readable
3. **Centralize related data** - Easier to maintain
4. **Descriptive values** - Help AI understand tool purpose
5. **Consistent naming** - Tools use snake_case (common in APIs)

---

## Snippet 6: Configuration Validation

**File:** [src/config/validation.ts](src/config/validation.ts) (conceptual)

```typescript
import { z } from "zod";

const OpenClawSchema = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      workspace: z.string().optional(),
    })
  ).optional(),

  models: z.array(
    z.object({
      provider: z.string(),
      model: z.string(),
      apiKey: z.string().optional(),
    })
  ).optional(),

  channels: z.array(
    z.object({
      type: z.enum(["whatsapp", "telegram", "slack", "discord"]),
      enabled: z.boolean().default(true),
      config: z.record(z.unknown()),
    })
  ).optional(),
});

export function validateConfigObject(raw: unknown): OpenClawConfig {
  return OpenClawSchema.parse(raw);
}
```

### Syntax Breakdown

**Line 1:** `import { z } from "zod";`
- **`import { ... }`** - ES6 named import
- **`zod`** - Schema validation library

**Line 3:** `const OpenClawSchema = z.object({`
- **`z.object()`** - Zod object schema
- Defines shape of valid config object

**Line 5:** `z.array(...)`
- **`z.array(T)`** - Array schema
- Elements must match inner schema

**Line 7:** `id: z.string(),`
- **`z.string()`** - String schema
- No `,` = required field

**Line 8:** `provider: z.string().optional(),`
- **`.optional()`** - Makes field optional
- Equivalent to `z.string() | z.undefined()`

**Line 20:** `type: z.enum(["whatsapp", "telegram", "slack", "discord"]),`
- **`z.enum([...])`** - Enumeration schema
- Value must be one of the listed strings

**Line 21:** `enabled: z.boolean().default(true),`
- **`.default(value)`** - Default value if missing

**Line 22:** `config: z.record(z.unknown()),`
- **`z.record(V)`** - Dictionary schema
- Keys are strings, values can be anything

**Line 28:** `return OpenClawSchema.parse(raw);`
- **`.parse()`** - Validates and returns typed value
- Throws error if validation fails

### What This Code Does

1. **Defines** valid config structure using Zod
2. **Validates** raw config objects
3. **Provides** TypeScript types automatically
4. **Throws** descriptive errors on invalid data

### Real-World Example

```typescript
// Valid config
const config = {
  agents: [
    { id: "main", provider: "anthropic" }
  ],
  channels: [
    { type: "whatsapp", enabled: true, config: {} }
  ],
};

validateConfigObject(config);  // ✅ Passes

// Invalid config
const badConfig = {
  agents: [
    { id: 123 }  // ❌ id should be string
  ],
  channels: [
    { type: "unknown" }  // ❌ not in enum
  ],
};

validateConfigObject(badConfig);  // ❌ Throws:
// ZodError: [
//   { path: ["agents", 0, "id"], message: "Expected string, received number" },
//   { path: ["channels", 0, "type"], message: "Invalid enum value" }
// ]
```

### Why Designed This Way

**Alternative 1:** Manual validation
```typescript
// ❌ Tedious, error-prone
function validate(config) {
  if (!config.agents) throw new Error("Missing agents");
  if (!Array.isArray(config.agents)) throw new Error("agents must be array");
  for (const agent of config.agents) {
    if (typeof agent.id !== "string") throw new Error("agent.id must be string");
    // ... 100 more checks
  }
}
```

**Alternative 2:** TypeScript interfaces only
```typescript
// ❌ No runtime validation
interface Config {
  agents: Agent[];
}

// TypeScript can't catch:
const config = JSON.parse(fileContents);  // Could be anything!
```

**Chosen approach:** Zod schemas
```typescript
// ✅ Runtime + compile-time validation
const schema = z.object({ agents: z.array(...) });
const config = schema.parse(raw);  // Validates + types!
```

**Benefits:**
1. **Type inference** - TypeScript types from schemas
2. **Runtime validation** - Catches invalid data
3. **Descriptive errors** - Exact path to problem
4. **Defaults** - Automatically fills missing values
5. **Composable** - Reuse schemas

### Key Takeaways

1. **Zod validates at runtime** - TypeScript only checks compile-time
2. **Schemas are single source of truth** - Types inferred from schemas
3. **`.parse()` throws on invalid** - Use `.safeParse()` for non-throwing
4. **`.optional()` makes fields optional** - `undefined` allowed
5. **`.default(value)` provides defaults** - Fills missing values
6. **`z.enum()` restricts values** - Only listed options allowed
7. **`z.record()` for dictionaries** - Arbitrary keys

---

## Common Patterns Summary

### Pattern 1: Object Parameters

```typescript
// Instead of:
function doThing(a, b, c, d, e) { }

// Use:
function doThing(params: { a, b, c, d, e }) { }
```

**Benefits:** Named parameters, optional values, extensible

---

### Pattern 2: Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

if (isString(value)) {
  // TypeScript knows value is string here
  value.toUpperCase();
}
```

**Benefits:** Runtime + compile-time safety

---

### Pattern 3: Union Types

```typescript
type Status = "pending" | "success" | "error";

function handle(status: Status) {
  // TypeScript ensures only valid statuses
}
```

**Benefits:** Compile-time validation, autocomplete

---

### Pattern 4: Utility Types

```typescript
// ReturnType: Extract return type
type Config = ReturnType<typeof loadConfig>;

// Omit: Remove properties
type NoId = Omit<User, "id">;

// Pick: Select properties
type OnlyName = Pick<User, "name">;

// Partial: All properties optional
type PartialUser = Partial<User>;

// Required: All properties required
type RequiredUser = Required<User>;
```

**Benefits:** DRY (Don't Repeat Yourself), stays in sync

---

### Pattern 5: Async/Await

```typescript
// Instead of:
fetch(url).then(res => res.json()).then(data => console.log(data));

// Use:
const res = await fetch(url);
const data = await res.json();
console.log(data);
```

**Benefits:** Readable, easier error handling

---

### Pattern 6: Module-Level Constants

```typescript
const CACHE_TTL_MS = 45_000;
const MAX_RETRIES = 3;

export function cachedFetch() {
  // Uses CACHE_TTL_MS
}
```

**Benefits:** Centralized config, easy to change

---

### Pattern 7: Dependency Injection

```typescript
function process(deps: { logger: Logger, db: Database }) {
  deps.logger.info("Processing...");
  deps.db.save(data);
}

// Testing:
process({
  logger: mockLogger,
  db: mockDb,
});
```

**Benefits:** Testable, flexible

---

# <a name="study-guide"></a>4. 🎓 Study Guide: Becoming an OpenClaw Expert

This comprehensive program will take you from junior developer to OpenClaw expert through structured learning and hands-on practice.

---

## Prerequisites

### Required Knowledge

Before diving deep into OpenClaw, you should have:

#### 1. **JavaScript/TypeScript Fundamentals**
- Variables (`const`, `let`)
- Functions (regular, arrow, async)
- Objects and arrays
- Destructuring
- Promises and async/await
- Modules (import/export)

**Resources:**
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

#### 2. **TypeScript Basics**
- Type annotations
- Interfaces and types
- Generics basics
- Utility types
- Union and intersection types

**Practice:** Rewrite JavaScript code in TypeScript

#### 3. **Node.js Basics**
- Modules and require/import
- File system operations
- Process and environment
- Basic npm usage

**Resources:**
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)

#### 4. **Command-Line Basics**
- Navigate directories (`cd`, `ls`)
- Run commands
- Environment variables
- Basic git usage

---

## Learning Phases

### 📅 Phase 1: Foundations (Week 1-2)

**Goal:** Understand the architecture and core concepts

#### Week 1: Architecture & Concepts

**Day 1-2: Read Documentation**
- [ ] Read [Technical Overview](#technical-overview)
- [ ] Understand [Core Concepts](#core-concepts)
- [ ] Study [Architecture Overview](#architecture)
- [ ] Review [Directory Structure](#directory-structure)

**Exercises:**
1. Draw the architecture diagram on paper from memory
2. List all core components and their responsibilities
3. Explain to someone (or rubber duck) what OpenClaw does

**Day 3-4: Explore Codebase**
- [ ] Clone repository: `git clone https://github.com/openclaw/openclaw.git`
- [ ] Install dependencies: `pnpm install`
- [ ] Build project: `pnpm build`
- [ ] Run tests: `pnpm test:fast`

**Exercises:**
1. Open each directory and read README files
2. Find the entry point ([src/entry.ts](src/entry.ts))
3. Trace from entry point to CLI program
4. Find where system prompt is built

**Day 5-7: Data Flows**
- [ ] Read [Data Flows](#data-flows) section
- [ ] Trace Message Flow through code
- [ ] Understand Session Lifecycle
- [ ] Study Configuration Loading

**Exercises:**
1. For each flow, find the actual code files
2. Add `console.log()` statements to trace execution
3. Run `openclaw agent --message "test"` and watch logs
4. Create flow diagrams for each major flow

---

#### Week 2: Code Comprehension

**Day 1-2: System Prompt**
- [ ] Read [src/agents/system-prompt.ts](src/agents/system-prompt.ts) entirely
- [ ] Understand `buildAgentSystemPrompt()` function
- [ ] Study each section builder function

**Exercises:**
1. Modify personality section (change tone)
2. Add a new custom section
3. Rebuild and test with `openclaw agent --message "hi"`
4. Observe how AI behavior changes

**Day 3-4: Gateway Server**
- [ ] Read [src/gateway/boot.ts](src/gateway/boot.ts)
- [ ] Read [src/gateway/server.impl.ts](src/gateway/server.impl.ts)
- [ ] Understand startup sequence

**Exercises:**
1. Create a `BOOT.md` file with instructions
2. Start gateway: `openclaw gateway start`
3. Observe boot execution
4. Add logging to boot sequence

**Day 5-7: Agents & Tools**
- [ ] Read [src/commands/agent.ts](src/commands/agent.ts)
- [ ] Read [src/agents/pi-tools.ts](src/agents/pi-tools.ts)
- [ ] Understand tool registry

**Exercises:**
1. Run agent command: `openclaw agent --message "read package.json"`
2. Trace tool execution
3. Add a custom tool (see hands-on project below)
4. Test custom tool

---

### 📅 Phase 2: Hands-On Projects (Week 3-4)

**Goal:** Build features to reinforce learning

#### Project 1: Custom Personality (Week 3, Days 1-2)

**Task:** Add a configurable personality system

**Requirements:**
1. Read personality from `PERSONALITY.md` in workspace
2. If file exists, override default personality
3. Support multiple personality presets

**Learning objectives:**
- File I/O in Node.js
- Modifying system prompt
- Configuration loading

**Implementation steps:**
1. Create `loadPersonalityFile()` function
2. Modify `buildPersonalitySection()` to use loaded personality
3. Add fallback to default if file missing
4. Test with different personalities

**Starter code:**
```typescript
// File: src/agents/personality-loader.ts

import fs from "node:fs/promises";
import path from "node:path";

export async function loadPersonalityFile(
  workspaceDir: string
): Promise<string | undefined> {
  const personalityPath = path.join(workspaceDir, "PERSONALITY.md");

  try {
    const content = await fs.readFile(personalityPath, "utf-8");
    return content.trim();
  } catch (err) {
    // File doesn't exist, use default
    return undefined;
  }
}
```

**Integration:**
```typescript
// File: src/agents/system-prompt.ts

function buildPersonalitySection(
  isMinimal: boolean,
  customPersonality?: string  // Add parameter
) {
  if (isMinimal) {
    return [];
  }

  if (customPersonality) {
    return ["## Personality", customPersonality, ""];
  }

  // Default personality
  return [
    "## Personality",
    "Use a playful tone...",
    "",
  ];
}
```

**Testing:**
1. Create `PERSONALITY.md`:
   ```markdown
   You are a professional, concise assistant.
   Avoid emojis and casual language.
   Focus on accuracy and clarity.
   ```

2. Run: `openclaw agent --message "hi"`
3. Observe AI uses professional tone
4. Delete `PERSONALITY.md` and run again
5. Observe AI uses default playful tone

---

#### Project 2: Custom Tool - Weather (Week 3, Days 3-5)

**Task:** Add a weather tool using a free API

**Requirements:**
1. Create `weather` tool
2. Takes location parameter
3. Calls weather API
4. Returns formatted weather info
5. Add to tool registry

**Learning objectives:**
- Creating tools
- HTTP requests in Node.js
- Error handling
- API integration

**API:** Use [Open-Meteo](https://open-meteo.com/) (no API key needed)

**Implementation steps:**

**Step 1:** Create tool file
```typescript
// File: src/agents/tools/weather-tool.ts

import { fetch } from "undici";

export type WeatherToolInput = {
  location: string;
};

export type WeatherToolResult = {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
};

export async function weatherTool(
  input: WeatherToolInput
): Promise<WeatherToolResult> {
  // 1. Geocode location to lat/lon
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.location)}&count=1`;
  const geoRes = await fetch(geoUrl);
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`Location not found: ${input.location}`);
  }

  const { latitude, longitude, name } = geoData.results[0];

  // 2. Fetch weather data
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`;
  const weatherRes = await fetch(weatherUrl);
  const weatherData = await weatherRes.json();

  const current = weatherData.current_weather;

  return {
    location: name,
    temperature: current.temperature,
    conditions: getWeatherCondition(current.weathercode),
    humidity: weatherData.current?.relative_humidity_2m || 0,
  };
}

function getWeatherCondition(code: number): string {
  // WMO weather codes: https://open-meteo.com/en/docs
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 69) return "Rainy";
  if (code <= 79) return "Snowy";
  if (code <= 99) return "Stormy";
  return "Unknown";
}
```

**Step 2:** Register tool in system prompt
```typescript
// File: src/agents/system-prompt.ts

const coreToolSummaries: Record<string, string> = {
  // ... existing tools
  weather: "Get current weather for a location",
};
```

**Step 3:** Add tool to agent
```typescript
// File: src/agents/pi-tools.ts

import { weatherTool } from "./tools/weather-tool.js";

export function createOpenClawCodingTools(params: {...}) {
  const tools = [...existingTools];

  // Add weather tool
  tools.push({
    name: "weather",
    description: "Get current weather for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or address",
        },
      },
      required: ["location"],
    },
    handler: async (input: WeatherToolInput) => {
      const result = await weatherTool(input);
      return JSON.stringify(result, null, 2);
    },
  });

  return tools;
}
```

**Testing:**
1. Rebuild: `pnpm build`
2. Test: `openclaw agent --message "What's the weather in San Francisco?"`
3. AI should call `weather` tool
4. Verify weather data is returned
5. Test error handling: `openclaw agent --message "weather in XYZ123"`

**Extensions:**
1. Add forecast support (next 7 days)
2. Add wind speed, UV index
3. Cache results (avoid repeated API calls)
4. Add unit conversion (Celsius/Fahrenheit)

---

#### Project 3: Session Export (Week 3, Days 6-7)

**Task:** Add command to export session history to Markdown

**Requirements:**
1. New command: `openclaw sessions export`
2. Takes session key
3. Exports full conversation to `.md` file
4. Formats nicely (timestamps, roles, tools)

**Learning objectives:**
- CLI commands
- Session loading
- File writing
- Markdown formatting

**Implementation:**

**Step 1:** Create export function
```typescript
// File: src/commands/sessions/export.ts

import fs from "node:fs/promises";
import path from "node:path";
import { loadSessionStore } from "../../config/sessions/store.js";
import { resolveSessionFilePath } from "../../config/sessions.js";

export async function exportSessionToMarkdown(
  sessionKey: string,
  outputPath: string
): Promise<void> {
  // 1. Load session entry
  const storePath = resolveSessionStorePath(sessionKey);
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];

  if (!entry) {
    throw new Error(`Session not found: ${sessionKey}`);
  }

  // 2. Load session file (conversation history)
  const sessionFile = resolveSessionFilePath(sessionKey);
  const historyJson = await fs.readFile(sessionFile, "utf-8");
  const history = JSON.parse(historyJson);

  // 3. Format as Markdown
  const lines: string[] = [];
  lines.push(`# Session: ${sessionKey}`);
  lines.push(``);
  lines.push(`**Channel:** ${entry.channel || "unknown"}`);
  lines.push(`**Created:** ${new Date(entry.createdAt || 0).toISOString()}`);
  lines.push(`**Updated:** ${new Date(entry.updatedAt || 0).toISOString()}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // 4. Format messages
  for (const msg of history.messages || []) {
    const timestamp = new Date(msg.timestamp || 0).toISOString();
    lines.push(`## ${msg.role} (${timestamp})`);
    lines.push(``);

    if (typeof msg.content === "string") {
      lines.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") {
          lines.push(block.text);
        } else if (block.type === "tool_use") {
          lines.push(`**Tool:** \`${block.name}\``);
          lines.push("```json");
          lines.push(JSON.stringify(block.input, null, 2));
          lines.push("```");
        } else if (block.type === "tool_result") {
          lines.push(`**Tool Result:** \`${block.tool_use_id}\``);
          lines.push("```");
          lines.push(block.content);
          lines.push("```");
        }
      }
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  // 5. Write to file
  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
}
```

**Step 2:** Add CLI command
```typescript
// File: src/commands/sessions.ts

program
  .command("export")
  .description("Export session to Markdown")
  .argument("<session-key>", "Session key to export")
  .option("-o, --output <path>", "Output file path", "./session.md")
  .action(async (sessionKey: string, options: { output: string }) => {
    await exportSessionToMarkdown(sessionKey, options.output);
    console.log(`Exported to ${options.output}`);
  });
```

**Testing:**
1. Have a conversation: `openclaw agent --message "hello"`
2. Find session key: `openclaw sessions list`
3. Export: `openclaw sessions export main:user:cli -o conversation.md`
4. Open `conversation.md` and verify formatting

**Extensions:**
1. Add filtering (date range, only user messages)
2. Support multiple formats (JSON, HTML)
3. Add statistics (message count, tool usage)
4. Include media (images, files)

---

#### Project 4: Simple Channel Plugin (Week 4)

**Task:** Create a file-based channel (messages via files)

**Requirements:**
1. Watch a directory for new `.msg` files
2. Each file is a new message
3. Send responses to `.reply` files
4. Learn channel plugin architecture

**Learning objectives:**
- Channel plugin system
- File watching
- Event handling
- Plugin registration

**Implementation:**

**Step 1:** Create plugin structure
```typescript
// File: src/channels/plugins/file-channel/index.ts

import fs from "node:fs/promises";
import path from "node:path";
import { watch } from "chokidar";
import type { ChannelMessagingAdapter } from "../../types.js";
import type { MsgContext } from "../../../auto-reply/templating.js";

export type FileChannelConfig = {
  watchDir: string;  // Directory to watch
  enabled: boolean;
};

export function createFileChannelAdapter(
  config: FileChannelConfig
): ChannelMessagingAdapter {
  const watcher = watch(config.watchDir, {
    persistent: true,
    ignoreInitial: true,
  });

  const messageHandlers: Array<(ctx: MsgContext) => void> = [];

  // Watch for new .msg files
  watcher.on("add", async (filePath: string) => {
    if (!filePath.endsWith(".msg")) return;

    try {
      // Read message file
      const content = await fs.readFile(filePath, "utf-8");
      const from = path.basename(filePath, ".msg");

      // Create message context
      const ctx: MsgContext = {
        channel: "file",
        from: from,
        to: "openclaw",
        text: content,
        timestamp: Date.now(),
      };

      // Dispatch to handlers
      for (const handler of messageHandlers) {
        handler(ctx);
      }

      // Delete processed message
      await fs.unlink(filePath);
    } catch (err) {
      console.error("Error processing message file:", err);
    }
  });

  return {
    channel: "file",

    // Register message handler
    onMessage(handler: (ctx: MsgContext) => void) {
      messageHandlers.push(handler);
    },

    // Send response
    async send(to: string, message: string) {
      const replyPath = path.join(config.watchDir, `${to}.reply`);
      await fs.appendFile(replyPath, `\n${message}\n`, "utf-8");
    },

    // Cleanup
    async close() {
      await watcher.close();
    },
  };
}
```

**Step 2:** Register plugin
```typescript
// File: src/channels/registry.ts

import { createFileChannelAdapter } from "./plugins/file-channel/index.js";

export function loadChannelPlugins(config: OpenClawConfig) {
  const adapters: ChannelMessagingAdapter[] = [];

  // Load file channel if configured
  const fileConfig = config.channels?.find(c => c.type === "file");
  if (fileConfig?.enabled) {
    adapters.push(createFileChannelAdapter(fileConfig.config));
  }

  // ... load other channels

  return adapters;
}
```

**Step 3:** Add to config
```json5
// File: ~/.openclaw/config.json5

{
  "channels": [
    {
      "type": "file",
      "enabled": true,
      "config": {
        "watchDir": "/tmp/openclaw-file-channel"
      }
    }
  ]
}
```

**Testing:**
1. Create watch directory: `mkdir -p /tmp/openclaw-file-channel`
2. Start gateway: `openclaw gateway start`
3. Create message file: `echo "Hello!" > /tmp/openclaw-file-channel/user1.msg`
4. Check reply file: `cat /tmp/openclaw-file-channel/user1.reply`
5. Verify AI response appears

**Extensions:**
1. Add typing indicators (create `.typing` files)
2. Support media files (images, PDFs)
3. Add message threading
4. Implement delivery receipts

---

### 📅 Phase 3: Advanced Topics (Week 5-6)

**Goal:** Deep dive into complex systems

#### Week 5: Multi-Agent Systems

**Topics:**
- Session spawning
- Sub-agent orchestration
- Agent-to-agent communication
- Tool policies per agent

**Study materials:**
- [ ] Read [src/agents/tools/sessions-spawn-tool.ts](src/agents/tools/sessions-spawn-tool.ts)
- [ ] Read [src/agents/tools/sessions-send-tool.ts](src/agents/tools/sessions-send-tool.ts)
- [ ] Understand subagent lifecycle

**Project: Multi-Agent Workflow**

Create a workflow where:
1. Main agent receives task: "Research and summarize AI news"
2. Main agent spawns research sub-agent
3. Research sub-agent searches web, gathers links
4. Research sub-agent sends findings to main agent
5. Main agent writes summary

**Implementation:**
```typescript
// This would use existing tools:
// 1. sessions_spawn(agentId="research")
// 2. sessions_send(sessionKey="research:...", message="Find AI news")
// 3. Research agent uses web_search tool
// 4. Research agent uses sessions_send to send back results
// 5. Main agent receives results and summarizes
```

---

#### Week 6: Performance & Optimization

**Topics:**
- Caching strategies
- Database optimization
- Rate limiting
- Memory management

**Study materials:**
- [ ] Read caching code in [src/config/sessions/store.ts](src/config/sessions/store.ts)
- [ ] Study rate limiting in auth profiles
- [ ] Understand memory vector store

**Project: Performance Monitoring**

Add performance monitoring:
1. Track tool execution times
2. Log slow operations
3. Add metrics endpoint
4. Create performance dashboard

**Metrics to track:**
- Average response time
- Tool usage frequency
- Cache hit rates
- API call counts
- Error rates

---

### 📅 Phase 4: Contributing (Week 7-8)

**Goal:** Become a contributor

#### Week 7: Open Source Contribution

**Tasks:**
1. [ ] Find "good first issue" on GitHub
2. [ ] Set up development environment
3. [ ] Fix the issue
4. [ ] Submit pull request
5. [ ] Respond to code review

**Tips:**
- Start with documentation improvements
- Fix typos, add examples
- Then move to small bug fixes
- Eventually tackle features

#### Week 8: Deep Specialization

**Choose a specialization:**

**Option A: Channel Integrations**
- Master one channel deeply (WhatsApp, Telegram)
- Understand protocol details
- Add advanced features (polls, buttons, reactions)

**Option B: Agent Capabilities**
- Create advanced tools
- Improve system prompts
- Optimize AI interactions

**Option C: Infrastructure**
- Database optimization
- Caching strategies
- Deployment automation

**Option D: Security**
- Authentication systems
- Permission models
- Sandboxing

---

## Hands-On Exercises

### Exercise 1: Trace a Message (30 min)

**Objective:** Follow a message from channel to AI and back

**Steps:**
1. Add `console.log()` at each step in the flow
2. Send a test message
3. Observe logs in order
4. Create a flow diagram

**Logging locations:**
```typescript
// src/channels/plugins/whatsapp/monitor.ts
console.log("[1] WhatsApp message received:", message);

// src/auto-reply/dispatch.ts
console.log("[2] Dispatching message:", ctx);

// src/commands/agent.ts
console.log("[3] Agent command:", params);

// src/agents/pi-embedded.ts
console.log("[4] Running embedded agent");

// src/agents/pi-embedded-subscribe.ts
console.log("[5] AI response:", text);

// src/gateway/server-chat.ts
console.log("[6] Broadcasting response");

// src/channels/plugins/outbound/load.ts
console.log("[7] Sending to channel");
```

---

### Exercise 2: Custom System Prompt Section (45 min)

**Objective:** Add a "Fun Facts" section to system prompt

**Steps:**
1. Create `buildFunFactsSection()` function
2. Add random fun fact each time
3. Integrate into `buildAgentSystemPrompt()`
4. Test and observe AI using fun facts

**Code:**
```typescript
function buildFunFactsSection(): string[] {
  const facts = [
    "The term 'bug' in computing came from an actual moth found in a computer.",
    "The first computer programmer was Ada Lovelace in 1843.",
    "Python is named after Monty Python, not the snake.",
  ];

  const randomFact = facts[Math.floor(Math.random() * facts.length)];

  return [
    "## Fun Fact",
    `Today's fun fact: ${randomFact}`,
    "",
  ];
}
```

---

### Exercise 3: Debug a Tool Call (60 min)

**Objective:** Understand tool execution in detail

**Steps:**
1. Set breakpoint in `weatherTool` (from Project 2)
2. Send message: "What's the weather?"
3. Step through execution
4. Observe:
   - How AI decides to call tool
   - How parameters are passed
   - How result is returned
   - How AI uses result

**Debugging tips:**
- Use VS Code debugger
- Add breakpoints at key locations
- Inspect variables
- Step through line-by-line

---

## Common Pitfalls & Solutions

### Pitfall 1: TypeScript Errors

**Problem:** `Type 'X' is not assignable to type 'Y'`

**Solution:**
1. Read error message carefully
2. Check type definitions
3. Use type assertions if needed: `value as Type`
4. Consider if types are actually wrong

---

### Pitfall 2: Async/Await Confusion

**Problem:** Forgot `await`, got Promise instead of value

**Solution:**
```typescript
// ❌ Wrong
const data = loadData();  // data is Promise

// ✅ Right
const data = await loadData();  // data is actual value
```

---

### Pitfall 3: Module Imports

**Problem:** `Cannot find module './file.js'`

**Solution:**
- Use `.js` extension in imports (TypeScript requirement)
- Check file exists
- Check path is correct (relative vs. absolute)

---

### Pitfall 4: File Paths

**Problem:** Path issues on different OS

**Solution:**
```typescript
// ❌ Wrong
const filePath = dir + "/file.txt";  // Breaks on Windows

// ✅ Right
const filePath = path.join(dir, "file.txt");  // Works everywhere
```

---

## Resources

### Official Documentation
- [OpenClaw Docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Discord Community](https://discord.gg/clawd)

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Node.js Resources
- [Node.js Docs](https://nodejs.org/docs/latest/api/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### AI/LLM Resources
- [Anthropic Claude Docs](https://docs.anthropic.com/)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

### General Software Engineering
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Design Patterns](https://refactoring.guru/design-patterns)

---

## Certification Milestones

Track your progress with these milestones:

### 🥉 Bronze Level: OpenClaw Apprentice

**Requirements:**
- [ ] Completed Phase 1 (Foundations)
- [ ] Can explain architecture to others
- [ ] Successfully traced a message through the system
- [ ] Modified system prompt successfully
- [ ] Ran all tests successfully

**Skills:**
- Basic understanding of architecture
- Can navigate codebase
- Can make simple modifications

---

### 🥈 Silver Level: OpenClaw Developer

**Requirements:**
- [ ] Completed Phase 2 (Hands-On Projects)
- [ ] Built custom tool
- [ ] Created channel plugin
- [ ] Fixed a bug in the codebase
- [ ] Contributed documentation

**Skills:**
- Can build new features
- Understands data flows
- Can debug issues
- Writes clean code

---

### 🥇 Gold Level: OpenClaw Expert

**Requirements:**
- [ ] Completed Phase 3 (Advanced Topics)
- [ ] Built multi-agent system
- [ ] Optimized performance
- [ ] Contributed code to main repository
- [ ] Helped others in community

**Skills:**
- Deep system knowledge
- Can architect new features
- Performance optimization
- Mentors others

---

## Next Steps

After completing this guide, you can:

1. **Become a maintainer** - Help triage issues, review PRs
2. **Build extensions** - Create community plugins
3. **Write articles** - Share knowledge with others
4. **Create tutorials** - Help new developers learn
5. **Specialize deeply** - Become expert in one area

---

## Final Thoughts

**Learning is a journey, not a destination.** This codebase is complex, and that's okay! Take it step by step:

1. **Don't rush** - Understand each concept deeply before moving on
2. **Practice regularly** - Code every day, even if just for 30 minutes
3. **Ask questions** - Join Discord, engage with community
4. **Teach others** - Best way to solidify knowledge
5. **Contribute back** - Give back to the community

**Remember:** Every expert was once a beginner. You've got this! 🚀

---

**Good luck on your OpenClaw learning journey!** 🦞
