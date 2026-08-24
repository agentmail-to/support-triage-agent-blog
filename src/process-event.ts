import type { AgentMailClient } from "agentmail"
import { decideSupportAction } from "./policy"
import type { TriageStore } from "./store"
import { classifySupportEmail, type TriageDecision } from "./triage"
import type { MessageReceivedEvent } from "./wire"

export async function processSupportEvent(input: {
    readonly event: MessageReceivedEvent
    readonly agentMail: AgentMailClient
    readonly store: TriageStore
    readonly classify?: (email: {
        readonly from: string
        readonly subject: string
        readonly body: string
    }) => Promise<TriageDecision>
}) {
    const message = await input.agentMail.inboxes.messages.get(
        input.event.message.inbox_id,
        input.event.message.message_id,
    )
    if (message.labels.includes("triage:processed")) {
        return { kind: "already_processed" } satisfies {
            kind: "already_processed"
        }
    }

    let triage = input.store.get(input.event.event_id)
    if (triage === null) {
        const classify = input.classify ?? classifySupportEmail
        triage = await classify({
            from: input.event.message.from,
            subject: input.event.message.subject ?? "(no subject)",
            body:
                input.event.message.extracted_text ??
                input.event.message.text ??
                "(no plain-text body)",
        })
        input.store.put(input.event.event_id, triage)
    }

    const action = decideSupportAction(triage)
    if (action.kind === "draft_reply") {
        await input.agentMail.inboxes.drafts.create(
            input.event.message.inbox_id,
            {
                inReplyTo: input.event.message.message_id,
                text: action.text,
                labels: action.labels,
                clientId: `support-triage-${input.event.event_id}`,
            },
        )
    }

    await input.agentMail.inboxes.messages.update(
        input.event.message.inbox_id,
        input.event.message.message_id,
        { addLabels: [...action.labels, "triage:processed"] },
    )

    return action
}
