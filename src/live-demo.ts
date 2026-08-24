import "dotenv/config"
import { AgentMailClient } from "agentmail"
import { z } from "zod"

const env = z
    .object({
        AGENTMAIL_API_KEY: z.string().min(1),
        AGENTMAIL_INBOX_ID: z.string().min(1),
        AGENTMAIL_DEMO_SENDER_INBOX_ID: z.preprocess(
            (value) => (value === "" ? undefined : value),
            z.string().min(1).optional(),
        ),
    })
    .parse(process.env)
const agentMail = new AgentMailClient({ apiKey: env.AGENTMAIL_API_KEY })
const senderInboxId =
    env.AGENTMAIL_DEMO_SENDER_INBOX_ID ??
    (
        await agentMail.inboxes.create({
            displayName: "Support Triage Demo Sender",
            clientId: "support-triage-demo-sender",
        })
    ).inboxId
const runId = new Date().toISOString().replaceAll(/[^0-9]/g, "")
const routineSubject = `Support triage demo ${runId}: export my data`
const billingSubject = `Support triage demo ${runId}: duplicate charge`

await agentMail.inboxes.messages.send(
    senderInboxId,
    {
        to: [env.AGENTMAIL_INBOX_ID],
        subject: routineSubject,
        text: "Hi support, where do I export my account data?",
    },
    { idempotencyKey: `support-triage-routine-${runId}` },
)
await agentMail.inboxes.messages.send(
    senderInboxId,
    {
        to: [env.AGENTMAIL_INBOX_ID],
        subject: billingSubject,
        text: "I was charged twice. Please refund the duplicate charge.",
    },
    { idempotencyKey: `support-triage-billing-${runId}` },
)

const deadline = Date.now() + 60_000
let routineMessageId: string | null = null
let billingMessageId: string | null = null
while (Date.now() < deadline) {
    const response = await agentMail.inboxes.messages.list(
        env.AGENTMAIL_INBOX_ID,
        { limit: 100 },
    )
    const routine = response.messages.find(
        (message) => message.subject === routineSubject,
    )
    const billing = response.messages.find(
        (message) => message.subject === billingSubject,
    )
    if (
        routine?.labels.includes("triage:processed") &&
        billing?.labels.includes("triage:processed")
    ) {
        routineMessageId = routine.messageId
        billingMessageId = billing.messageId
        break
    }
    await Bun.sleep(1_000)
}

if (routineMessageId === null || billingMessageId === null) {
    throw new Error(
        "Timed out waiting for both support messages to be triaged.",
    )
}

const [routine, billing, drafts] = await Promise.all([
    agentMail.inboxes.messages.get(env.AGENTMAIL_INBOX_ID, routineMessageId),
    agentMail.inboxes.messages.get(env.AGENTMAIL_INBOX_ID, billingMessageId),
    agentMail.inboxes.drafts.list(env.AGENTMAIL_INBOX_ID, { limit: 100 }),
])
const routineDraft = drafts.drafts.find(
    (draft) => draft.inReplyTo === routineMessageId,
)
const billingDraft = drafts.drafts.find(
    (draft) => draft.inReplyTo === billingMessageId,
)

z.object({
    routine: z.object({
        labels: z.array(z.string()).superRefine((labels, context) => {
            for (const label of [
                "triage:category:how_to",
                "triage:priority:normal",
                "triage:draft-ready",
                "triage:processed",
            ]) {
                if (!labels.includes(label)) {
                    context.addIssue({
                        code: "custom",
                        message: `Missing ${label}`,
                    })
                }
            }
        }),
        draftId: z.string().min(1),
    }),
    billing: z.object({
        labels: z.array(z.string()).superRefine((labels, context) => {
            for (const label of [
                "triage:category:billing",
                "triage:priority:high",
                "triage:needs-human-review",
                "triage:processed",
            ]) {
                if (!labels.includes(label)) {
                    context.addIssue({
                        code: "custom",
                        message: `Missing ${label}`,
                    })
                }
            }
        }),
        draft: z.null(),
    }),
}).parse({
    routine: { labels: routine.labels, draftId: routineDraft?.draftId },
    billing: { labels: billing.labels, draft: billingDraft ?? null },
})

console.log(
    JSON.stringify(
        {
            inboxId: env.AGENTMAIL_INBOX_ID,
            routine: { subject: routineSubject, labels: routine.labels },
            billing: { subject: billingSubject, labels: billing.labels },
        },
        null,
        2,
    ),
)
