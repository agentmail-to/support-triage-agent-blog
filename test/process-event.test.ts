import { AgentMailClient } from "agentmail";
import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { processSupportEvent } from "../src/process-event";
import { TriageStore } from "../src/store";
import type { TriageDecision } from "../src/triage";
import { MessageReceivedEventSchema } from "../src/wire";

const RequestBodySchema = z.record(z.string(), z.unknown());

function createAgentMailHarness() {
  let labels: string[] = [];
  const draftBodies: Array<Record<string, unknown>> = [];
  const requests: Array<{ method: string; url: string }> = [];

  const fakeFetch = Object.assign(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method ?? "GET";
    requests.push({ method, url });

    if (method === "GET" && url.endsWith("/messages/message-1")) {
      return Response.json({
        inbox_id: "support@agentmail.to",
        thread_id: "thread-1",
        message_id: "message-1",
        labels,
        timestamp: "2026-08-24T00:00:00.000Z",
        from: "customer@example.com",
        to: ["support@agentmail.to"],
        subject: "Export my data",
        text: "Where do I export my data?",
        size: 28,
        updated_at: "2026-08-24T00:00:00.000Z",
        created_at: "2026-08-24T00:00:00.000Z",
      });
    }

    if (method === "POST" && url.endsWith("/drafts")) {
      const body = RequestBodySchema.parse(
        JSON.parse(typeof init?.body === "string" ? init.body : "{}"),
      );
      draftBodies.push(body);
      return Response.json({
        inbox_id: "support@agentmail.to",
        draft_id: "draft-1",
        client_id: body.client_id,
        labels: body.labels,
        text: body.text,
        in_reply_to: body.in_reply_to,
        updated_at: "2026-08-24T00:00:00.000Z",
        created_at: "2026-08-24T00:00:00.000Z",
      });
    }

    if (method === "PATCH" && url.endsWith("/messages/message-1")) {
      const body = RequestBodySchema.parse(
        JSON.parse(typeof init?.body === "string" ? init.body : "{}"),
      );
      labels = z.array(z.string()).parse(body.add_labels);
      return Response.json({ message_id: "message-1", labels });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  }, { preconnect: fetch.preconnect });
  const agentMail = new AgentMailClient({
    apiKey: "test-key",
    baseUrl: "https://agentmail.test",
    fetch: fakeFetch,
  });

  return {
    agentMail,
    draftBodies,
    requests,
    get labels() {
      return labels;
    },
  };
}

const event = MessageReceivedEventSchema.parse({
  type: "event",
  event_type: "message.received",
  event_id: "event-1",
  message: {
    inbox_id: "support@agentmail.to",
    thread_id: "thread-1",
    message_id: "message-1",
    labels: [],
    timestamp: "2026-08-24T00:00:00.000Z",
    from: "customer@example.com",
    to: ["support@agentmail.to"],
    subject: "Export my data",
    text: "Where do I export my data?",
  },
});

describe("processSupportEvent", () => {
  it("creates a same-thread draft for a low-risk known answer", async () => {
    const harness = createAgentMailHarness();
    const result = await processSupportEvent({
      event,
      agentMail: harness.agentMail,
      store: new TriageStore(":memory:"),
      classify: async (): Promise<TriageDecision> => ({
        category: "how_to",
        priority: "normal",
        summary: "Customer wants an account export.",
        knowledgeArticle: "export-data",
      }),
    });

    expect(result.kind).toBe("draft_reply");
    expect(harness.draftBodies).toHaveLength(1);
    expect(harness.draftBodies[0]).toMatchObject({
      in_reply_to: "message-1",
      client_id: "support-triage-event-1",
    });
    expect(harness.labels).toContain("triage:draft-ready");
    expect(harness.labels).toContain("triage:processed");
  });

  it("routes sensitive billing mail to a human without drafting", async () => {
    const harness = createAgentMailHarness();
    const result = await processSupportEvent({
      event,
      agentMail: harness.agentMail,
      store: new TriageStore(":memory:"),
      classify: async (): Promise<TriageDecision> => ({
        category: "billing",
        priority: "high",
        summary: "Customer disputes a charge.",
        knowledgeArticle: null,
      }),
    });

    expect(result.kind).toBe("human_review");
    expect(harness.draftBodies).toHaveLength(0);
    expect(harness.labels).toContain("triage:needs-human-review");
  });

  it("does no further work after the processed label is present", async () => {
    const harness = createAgentMailHarness();
    const store = new TriageStore(":memory:");
    const classify = async (): Promise<TriageDecision> => ({
      category: "how_to",
      priority: "normal",
      summary: "Customer wants an account export.",
      knowledgeArticle: "export-data",
    });
    await processSupportEvent({
      event,
      agentMail: harness.agentMail,
      store,
      classify,
    });
    const requestCount = harness.requests.length;

    const result = await processSupportEvent({
      event,
      agentMail: harness.agentMail,
      store,
      classify,
    });

    expect(result.kind).toBe("already_processed");
    expect(harness.draftBodies).toHaveLength(1);
    expect(harness.requests).toHaveLength(requestCount + 1);
  });
});
