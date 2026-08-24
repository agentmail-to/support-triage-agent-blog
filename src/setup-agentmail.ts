import "dotenv/config";
import { AgentMailClient } from "agentmail";
import { z } from "zod";

const env = z
  .object({
    AGENTMAIL_API_KEY: z.string().min(1),
    WEBHOOK_URL: z.string().url(),
  })
  .parse(process.env);
const agentMail = new AgentMailClient({ apiKey: env.AGENTMAIL_API_KEY });

const inbox = await agentMail.inboxes.create({
  username: "support-triage-demo",
  displayName: "Support Triage",
  clientId: "support-triage-demo-inbox",
});
const webhook = await agentMail.webhooks.create({
  url: env.WEBHOOK_URL,
  eventTypes: ["message.received"],
  inboxIds: [inbox.inboxId],
  clientId: "support-triage-demo-webhook",
});

await Bun.write(
  ".env.agentmail.local",
  [
    `AGENTMAIL_INBOX_ID=${inbox.inboxId}`,
    `AGENTMAIL_WEBHOOK_SECRET=${webhook.secret}`,
    "",
  ].join("\n"),
);
console.log("Wrote the inbox ID and webhook secret to .env.agentmail.local");
