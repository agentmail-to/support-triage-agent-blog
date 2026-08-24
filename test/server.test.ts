import { AgentMailClient } from "agentmail";
import { describe, expect, it } from "bun:test";
import { Webhook } from "svix";
import { z } from "zod";
import { createApp } from "../src/server";
import { TriageStore } from "../src/store";

const AddressSchema = z.object({ port: z.number() });
const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const payload = JSON.stringify({
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

describe("webhook receiver", () => {
  it("rejects a body without a valid signature", async () => {
    const agentMail = new AgentMailClient({
      apiKey: "test-key",
      fetch: Object.assign(
        async () => Response.json({ error: "unexpected" }, { status: 500 }),
        { preconnect: fetch.preconnect },
      ),
    });
    const server = createApp({
      inboxId: "support@agentmail.to",
      webhookSecret: secret,
      agentMail,
      store: new TriageStore(":memory:"),
    }).listen(0);
    const { port } = AddressSchema.parse(server.address());

    const response = await fetch(`http://127.0.0.1:${port}/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    expect(response.status).toBe(400);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("accepts a signed event for an already processed message", async () => {
    const agentMail = new AgentMailClient({
      apiKey: "test-key",
      baseUrl: "https://agentmail.test",
      fetch: Object.assign(
        async () =>
          Response.json({
            inbox_id: "support@agentmail.to",
            thread_id: "thread-1",
            message_id: "message-1",
            labels: ["triage:processed"],
            timestamp: "2026-08-24T00:00:00.000Z",
            from: "customer@example.com",
            to: ["support@agentmail.to"],
            subject: "Export my data",
            text: "Where do I export my data?",
            size: 28,
            updated_at: "2026-08-24T00:00:00.000Z",
            created_at: "2026-08-24T00:00:00.000Z",
          }),
        { preconnect: fetch.preconnect },
      ),
    });
    const server = createApp({
      inboxId: "support@agentmail.to",
      webhookSecret: secret,
      agentMail,
      store: new TriageStore(":memory:"),
    }).listen(0);
    const { port } = AddressSchema.parse(server.address());
    const timestamp = new Date();
    const messageId = "msg_p5jXN8AQM9LWM0D4loKWxJek";
    const signature = new Webhook(secret).sign(messageId, timestamp, payload);

    const response = await fetch(`http://127.0.0.1:${port}/webhooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": messageId,
        "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "svix-signature": signature,
      },
      body: payload,
    });

    expect(response.status).toBe(204);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
