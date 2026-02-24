import { describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import { createCronStoreHarness, createNoopLogger } from "./service.test-harness.js";
import type { CronEvent } from "./service/state.js";

const noopLogger = createNoopLogger();
const { makeStorePath } = createCronStoreHarness();

function nodeCommand(code: string) {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(code)}`;
}

describe("CronService command payload jobs", () => {
  it("runs isolated command payloads and captures output telemetry", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const runIsolatedAgentJob = vi.fn(async () => ({ status: "ok" as const }));
    const events: CronEvent[] = [];

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
      onEvent: (evt) => events.push(evt),
    });

    try {
      const added = await cron.add({
        name: "command ok",
        enabled: true,
        schedule: { kind: "every", everyMs: 60_000 },
        sessionTarget: "isolated",
        wakeMode: "next-heartbeat",
        payload: {
          kind: "command",
          command: nodeCommand("process.stdout.write('command-ok')"),
          timeoutSeconds: 30,
        },
      });

      const run = await cron.run(added.id, "force");
      expect(run).toEqual({ ok: true, ran: true });

      const job = cron.getJob(added.id);
      expect(job?.state.lastStatus).toBe("ok");
      expect(job?.state.lastError).toBeUndefined();
      expect(runIsolatedAgentJob).not.toHaveBeenCalled();

      const finished = events
        .filter((evt) => evt.jobId === added.id && evt.action === "finished")
        .at(-1);
      expect(finished?.status).toBe("ok");
      expect(finished?.command).toContain("-e");
      expect(finished?.stdoutPreview).toContain("command-ok");
      expect(finished?.timedOut).toBe(false);
    } finally {
      cron.stop();
      await store.cleanup();
    }
  });

  it("marks command jobs as timed out when timeoutSeconds is exceeded", async () => {
    const store = await makeStorePath();
    const events: CronEvent[] = [];

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
      onEvent: (evt) => events.push(evt),
    });

    try {
      const added = await cron.add({
        name: "command timeout",
        enabled: true,
        schedule: { kind: "every", everyMs: 60_000 },
        sessionTarget: "isolated",
        wakeMode: "next-heartbeat",
        payload: {
          kind: "command",
          command: nodeCommand("setTimeout(() => process.stdout.write('late'), 5000)"),
          timeoutSeconds: 1,
        },
      });

      const run = await cron.run(added.id, "force");
      expect(run).toEqual({ ok: true, ran: true });

      const job = cron.getJob(added.id);
      expect(job?.state.lastStatus).toBe("error");
      expect(job?.state.lastError).toMatch(/timed out/i);

      const finished = events
        .filter((evt) => evt.jobId === added.id && evt.action === "finished")
        .at(-1);
      expect(finished?.status).toBe("error");
      expect(finished?.timedOut).toBe(true);
      expect(finished?.error).toMatch(/timed out/i);
    } finally {
      cron.stop();
      await store.cleanup();
    }
  });
});
