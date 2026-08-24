import "dotenv/config"
import { AgentMailClient } from "agentmail"
import { z } from "zod"

const env = z
    .object({
        AGENTMAIL_SETUP_API_KEY: z.string().min(1),
        AGENTMAIL_INBOX_ID: z.string().min(1),
        WEBHOOK_URL: z.string().url(),
    })
    .parse(process.env)
const agentMail = new AgentMailClient({ apiKey: env.AGENTMAIL_SETUP_API_KEY })

const webhook = await agentMail.inboxes.webhooks.create(
    env.AGENTMAIL_INBOX_ID,
    {
        url: env.WEBHOOK_URL,
        eventTypes: ["message.received"],
        clientId: "support-triage-demo-webhook",
    },
)

await Bun.write(
    ".env.agentmail.local",
    [
        `AGENTMAIL_INBOX_ID=${env.AGENTMAIL_INBOX_ID}`,
        `AGENTMAIL_WEBHOOK_SECRET=${webhook.secret}`,
        "",
    ].join("\n"),
)
console.log("Wrote the inbox ID and webhook secret to .env.agentmail.local")
