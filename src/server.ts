import "dotenv/config"
import { AgentMailClient } from "agentmail"
import express from "express"
import { Webhook } from "svix"
import { z } from "zod"
import { processSupportEvent } from "./process-event"
import { TriageStore } from "./store"
import type { TriageDecision } from "./triage"
import { MessageReceivedEventSchema } from "./wire"

const HeaderRecordSchema = z.record(z.string(), z.string())

export function createApp(input: {
    readonly inboxId: string
    readonly webhookSecret: string
    readonly agentMail: AgentMailClient
    readonly store: TriageStore
    readonly classify?: (email: {
        readonly from: string
        readonly subject: string
        readonly body: string
    }) => Promise<TriageDecision>
}) {
    const app = express()
    const verifier = new Webhook(input.webhookSecret)

    app.post(
        "/webhooks",
        express.raw({ type: "application/json", limit: "1mb" }),
        async (req, res) => {
            const payload = z.instanceof(Buffer).parse(req.body)
            const headers = HeaderRecordSchema.parse(
                Object.fromEntries(
                    Object.entries(req.headers).flatMap(([name, value]) =>
                        typeof value === "string" ? [[name, value]] : [],
                    ),
                ),
            )

            let verified: unknown
            try {
                verified = verifier.verify(payload, headers)
            } catch {
                res.status(400).json({ error: "invalid webhook signature" })
                return
            }

            const parsed = MessageReceivedEventSchema.safeParse(verified)
            if (!parsed.success) {
                res.status(400).json({
                    error: "malformed message.received payload",
                })
                return
            }
            if (parsed.data.message.inbox_id !== input.inboxId) {
                res.status(403).json({
                    error: "event delivered for another inbox",
                })
                return
            }

            try {
                await processSupportEvent({
                    event: parsed.data,
                    agentMail: input.agentMail,
                    store: input.store,
                    classify: input.classify,
                })
                res.status(204).send()
            } catch (error) {
                console.error("support triage failed", error)
                try {
                    await input.agentMail.inboxes.messages.update(
                        parsed.data.message.inbox_id,
                        parsed.data.message.message_id,
                        {
                            addLabels: [
                                "triage:error",
                                "triage:needs-human-review",
                                "triage:processed",
                            ],
                        },
                    )
                    res.status(204).send()
                } catch (labelError) {
                    console.error("support triage handoff failed", labelError)
                    res.status(500).json({ error: "triage handoff failed" })
                }
            }
        },
    )

    app.get("/health", (_req, res) => {
        res.json({ ok: true })
    })

    return app
}

if (import.meta.main) {
    const env = z
        .object({
            AGENTMAIL_API_KEY: z.string().min(1),
            AGENTMAIL_INBOX_ID: z.string().min(1),
            AGENTMAIL_WEBHOOK_SECRET: z.string().min(1),
            OPENAI_API_KEY: z.string().min(1),
            PORT: z.coerce.number().int().positive().default(3000),
        })
        .parse(process.env)
    const agentMail = new AgentMailClient({ apiKey: env.AGENTMAIL_API_KEY })
    const store = new TriageStore("triage.sqlite")
    createApp({
        inboxId: env.AGENTMAIL_INBOX_ID,
        webhookSecret: env.AGENTMAIL_WEBHOOK_SECRET,
        agentMail,
        store,
    }).listen(env.PORT, () => {
        console.log(`support triage listening on http://localhost:${env.PORT}`)
    })
}
